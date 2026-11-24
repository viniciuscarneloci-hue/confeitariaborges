# Oak AR — cardápio em realidade aumentada (protótipo)

Plataforma genérica e multi-restaurante: o cliente abre o cardápio pelo QR code da mesa e vê o prato em 3D e em tamanho real sobre a mesa, sem instalar app. O dono do restaurante cria o 3D do prato no painel e publica em minutos.

- `#/` apresentação · `#/r/<restaurante>?mesa=7` cardápio do cliente · `#/admin` painel do dono
- Demonstração com dois restaurantes (Casa Oak e Brasa Burger) e quatro pratos em 3D (pizza, hambúrguer, poke e petit gâteau).

## Rodar e publicar

```bash
cd oak-ar
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/
```

**Vercel:** New Project > importe o repositório > *Root Directory* `oak-ar` > Framework Vite. Pronto. Sem nenhuma variável de ambiente o protótipo funciona inteiro (dados no navegador; vídeo em modo demonstração). A RA pela câmera exige HTTPS, o que a Vercel já dá.

## Como o restaurante cria o 3D

**Caminho principal, custo zero por prato:** o dono escaneia o prato com um app grátis e envia o arquivo no painel.

| App | Plataforma | Exporta | Custo |
|---|---|---|---|
| **Scaniverse** (recomendado) | Android e iPhone | GLB, USDZ | grátis |
| Object Capture (app Reality Composer) | iPhone | USDZ | grátis |
| KIRI Engine | Android e iPhone | GLB, USDZ | grátis com poucas exportações por semana; Pro US$ 79/ano |

No painel (*Criar 3D > Escanear com um app*), o arquivo passa por um **acabamento automático no navegador** (`src/capture/optimize.ts`, com gltf-transform + meshoptimizer): remove dados duplicados, reduz a malha para até 120 mil triângulos, reduz texturas acima de 2048 px, centraliza e apoia a base do prato no chão. Na revisão o dono informa o **diâmetro real do prato** (a fotogrametria sem LiDAR não sabe a escala), gira a "frente" para o cliente e publica. O pôster do cardápio é gerado na hora. Para o iPhone, o USDZ enviado é usado; sem ele, o model-viewer gera o USDZ a partir do GLB.

**Vídeo ou fotos direto no painel (provedor trocável):** o painel grava o vídeo com guia de duas voltas (bússola do celular ou tempo), confere nitidez, luz, duração e movimento no próprio navegador (`src/capture/analyze.ts`) e envia direto ao storage. O processamento é feito por um provedor plugável (`api/_lib/providers.ts`):

- **demo** (padrão): etapas simuladas e modelo de exemplo, para demonstrar o fluxo.
- **proprio**: worker com COLMAP + OpenMVS numa máquina com GPU (`worker/`). Sem custo por prato; paga-se a máquina. Ativado com as variáveis abaixo.
- Um serviço pago por chamada (ex.: API da KIRI, ~US$ 1 por modelo) pode entrar como outro provedor, sem mudar as telas.

### Ligar o pipeline próprio de vídeo (opcional)

1. Supabase: crie o projeto, rode `supabase/schema.sql` e crie o bucket `capturas`.
2. Worker: `cd worker && docker build -t oak-worker . && docker run --gpus all -p 8080:8080 --env-file .env oak-worker` (veja `.env.example`). Qualquer GPU NVIDIA com 8 GB ou mais (AWS g4dn/g5, RunPod, Vast.ai). Cada prato leva de 10 a 20 minutos.
3. Vercel, variáveis: `PHOTOGRAMMETRY_WORKER_URL`, `PHOTOGRAMMETRY_WORKER_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET`.

O worker ainda não foi executado de ponta a ponta neste protótipo; falta também o recorte automático da mesa em volta do prato (marcado como TODO em `worker/reconstruct.sh`).

## Arquitetura

```
Cliente (celular)                    Painel do dono                          Servidor (opcional)
cardápio #/r/<slug>  ◀── dados ──▶  #/admin  ── vídeo/fotos ──▶ Storage ──▶ api/captures ──▶ worker COLMAP+OpenMVS
model-viewer: WebXR,                 scan .glb ──▶ acabamento no navegador ──▶ revisão + escala ──▶ publica
Scene Viewer, Quick Look
```

- Front estático (Vite + React + `@google/model-viewer`). RA: WebXR no Android (fica dentro da página), Scene Viewer como reserva, Quick Look no iPhone. Prato em tamanho real (`ar-scale="fixed"`) e parado onde foi colocado.
- Dados: no protótipo ficam no navegador (`src/data/db.ts`: localStorage + IndexedDB para arquivos), com as mesmas tabelas do Supabase (`src/data/types.ts`, `supabase/schema.sql`). Cardápio e painel abertos ao mesmo tempo se atualizam na hora.
- Multi-restaurante: um banco, `restaurant_id` em toda tabela e RLS por membro do restaurante. Um QR code por restaurante (com número da mesa opcional), nunca por prato.
- Métricas: aberturas do cardápio, pratos vistos, visualizações 3D, RA e adições ao pedido, comparando pratos com e sem 3D.

Para produção falta: login do dono (Supabase Auth), trocar `db.ts` por chamadas ao Supabase e guardar os modelos publicados num bucket público com CDN.

## Modelos de demonstração

`npm run models` gera os quatro pratos em `public/models/` (`tools/make_dishes.py`, só numpy e Pillow). São modelos procedurais em escala real, feitos só para a demonstração; em uso real cada prato vem do scan do restaurante.
