#!/usr/bin/env bash
# Fotogrametria de um prato: vídeo ou fotos -> .glb texturizado e otimizado para celular.
# Uso: reconstruct.sh <pasta_entrada> <pasta_trabalho>   (gera <pasta_trabalho>/prato.glb)
# Etapas: quadros nítidos (ffmpeg) -> poses de câmera (COLMAP) -> nuvem densa, malha e textura (OpenMVS) -> otimização (gltf-transform)
set -euo pipefail
IN="$1"; W="$2"; mkdir -p "$W/imagens" "$W/sparse" "$W/mvs"

# 1. quadros: 3 por segundo do vídeo, no máximo 2000 px; fotos são copiadas
shopt -s nullglob nocaseglob
for v in "$IN"/*.{mp4,mov,webm,m4v}; do
  ffmpeg -loglevel error -i "$v" -vf "fps=3,scale='min(2000,iw)':-2" -q:v 2 "$W/imagens/q_%05d.jpg"
done
for f in "$IN"/*.{jpg,jpeg,png,heic}; do cp "$f" "$W/imagens/"; done
N=$(ls "$W/imagens" | wc -l); echo "PROGRESSO 20 $N imagens"
[ "$N" -ge 20 ] || { echo "ERRO poucas imagens ($N)"; exit 2; }

# 2. COLMAP: posições das câmeras (matcher sequencial é rápido e serve para vídeo em volta do prato)
colmap feature_extractor --database_path "$W/db.db" --image_path "$W/imagens" --ImageReader.single_camera 1 --ImageReader.camera_model OPENCV
colmap sequential_matcher --database_path "$W/db.db" --SequentialMatching.overlap 15 --SequentialMatching.loop_detection 0
colmap mapper --database_path "$W/db.db" --image_path "$W/imagens" --output_path "$W/sparse"
echo "PROGRESSO 45 alinhamento"
colmap image_undistorter --image_path "$W/imagens" --input_path "$W/sparse/0" --output_path "$W/und" --output_type COLMAP

# 3. OpenMVS: nuvem densa, malha, refinamento e textura
cd "$W/mvs"
InterfaceCOLMAP -i "$W/und" -o cena.mvs --image-folder "$W/und/images"
DensifyPointCloud cena.mvs --resolution-level 1 --max-resolution 2048
echo "PROGRESSO 62 nuvem densa"
ReconstructMesh cena_dense.mvs -p cena_dense.ply
RefineMesh cena_dense.mvs -m cena_dense_mesh.ply -o cena_refine.mvs --max-face-area 16
echo "PROGRESSO 78 malha"
TextureMesh cena_dense.mvs -m cena_refine.ply -o prato --export-type glb --decimate 0.5
echo "PROGRESSO 88 textura"

# 4. Otimização: malha até 120 mil triângulos, texturas webp até 2048 px. A escala real e a
#    rotação são calibradas pelo dono na revisão do painel.
# TODO: recorte automático do prato (detectar o plano da mesa por RANSAC e cortar o que estiver fora do prato).
gltf-transform optimize prato.glb "$W/prato.glb" --compress false --simplify-ratio 0.5 --texture-compress webp --texture-size 2048
echo "PROGRESSO 98 otimizado"
