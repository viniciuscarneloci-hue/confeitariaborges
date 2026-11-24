import { WebIO, type Document, type Texture } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { center, dedup, getBounds, prune, simplify, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'

/**
 * Acabamento automático de um scan, feito no navegador do dono (sem servidor e sem custo):
 *  1. remove dados duplicados e não usados;
 *  2. reduz a malha quando passa do limite do celular (escaneamentos chegam com 300 mil a 1 milhão de triângulos);
 *  3. reduz texturas maiores que 2048 px;
 *  4. centraliza o prato e apoia a base no chão (y = 0), para ele "sentar" na mesa na RA;
 *  5. mede o tamanho para a calibração de escala.
 */

const MAX_TRIANGLES = 120_000
const MAX_TEXTURE = 2048

export interface OptimizeResult { glb: Uint8Array; triangles: number; size_m: { w: number; h: number; d: number } }

async function io() {
  await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready
  return new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
}

function countTriangles(doc: Document) {
  let n = 0
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices(); const pos = p.getAttribute('POSITION')
    if (p.getMode() === 4) n += (idx ? idx.getCount() : pos?.getCount() ?? 0) / 3
  }
  return Math.round(n)
}

async function shrinkTexture(t: Texture) {
  const img = t.getImage(); const type = t.getMimeType()
  if (!img || !/image\/(png|jpeg|webp)/.test(type)) return
  const bmp = await createImageBitmap(new Blob([img], { type }))
  if (Math.max(bmp.width, bmp.height) <= MAX_TEXTURE && img.byteLength < 3_000_000) return
  const k = Math.min(1, MAX_TEXTURE / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  // mapas de normal/rugosidade não podem perder canal: PNG; cor vai em JPEG
  const isColor = type === 'image/jpeg'
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), isColor ? 'image/jpeg' : 'image/png', 0.88))
  t.setImage(new Uint8Array(await blob.arrayBuffer())).setMimeType(blob.type)
}

export async function optimizeGlb(input: Uint8Array): Promise<OptimizeResult> {
  const reader = await io()
  const doc = await reader.readBinary(input)
  await doc.transform(dedup(), prune(), weld())
  const tris = countTriangles(doc)
  if (tris > MAX_TRIANGLES) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIANGLES / tris, error: 0.002 }), prune())
  for (const t of doc.getRoot().listTextures()) await shrinkTexture(t)
  await doc.transform(center({ pivot: 'below' }))
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
  const b = getBounds(scene)
  const out = await reader.writeBinary(doc)
  return { glb: out, triangles: countTriangles(doc), size_m: { w: b.max[0] - b.min[0], h: b.max[1] - b.min[1], d: b.max[2] - b.min[2] } }
}

/** Mede um .glb já pronto (para calibrar a escala na revisão). */
export async function measureGlb(url: string): Promise<{ w: number; h: number; d: number }> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer())
  const doc = await (await io()).readBinary(buf)
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
  const b = getBounds(scene)
  return { w: b.max[0] - b.min[0], h: b.max[1] - b.min[1], d: b.max[2] - b.min[2] }
}
