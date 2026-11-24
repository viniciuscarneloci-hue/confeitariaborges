import { db, getDB, putFile, uid } from '../data/db'
import { DEMO_MODELS } from '../data/seed'
import type { Capture, CaptureQuality, CaptureSource, Dish } from '../data/types'

/**
 * Orquestra a geração do 3D de um prato.
 *
 * Caminho principal (custo zero por prato):
 *  app de escaneamento (KIRI, Polycam, Object Capture) ──▶ .glb/.usdz ──▶ acabamento no navegador ──▶ revisão + escala real ──▶ publicar
 *
 * Caminho por vídeo (provedor trocável):
 *  vídeo/fotos ──▶ análise no navegador ──▶ upload direto para o storage ──▶ /api/captures ──▶ worker de fotogrametria
 *  painel ◀── revisão + calibração de escala ◀── /api/captures/status ◀── worker devolve .glb otimizado
 *
 * Provedores do caminho por vídeo:
 *  - "proprio": worker próprio COLMAP + OpenMVS (worker/), ativado quando o servidor tem PHOTOGRAMMETRY_WORKER_URL.
 *  - "demo": sem worker, as etapas são simuladas e o resultado é um modelo de exemplo, para demonstrar o fluxo.
 *  Um serviço pago (KIRI API, etc.) entra como outro provedor em api/_lib/providers.ts, sem mudar as telas.
 */

export interface ServerConfig { provider: 'proprio' | 'demo'; storage: boolean }
let cfg: Promise<ServerConfig> | null = null
export function serverConfig(): Promise<ServerConfig> {
  return (cfg ??= fetch('api/config').then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => ({ provider: j.provider === 'proprio' ? 'proprio' : 'demo', storage: !!j.storage }) as ServerConfig)
    .catch(() => ({ provider: 'demo', storage: false })))
}

/** Etapas mostradas ao dono (iguais para o provedor real e para a simulação). */
export const STAGES = [
  { key: 'enviando', label: 'Enviando o vídeo', until: 12 },
  { key: 'na-fila', label: 'Na fila do processamento', until: 18 },
  { key: 'alinhando', label: 'Alinhando os quadros e calculando as posições da câmera', until: 45 },
  { key: 'malha', label: 'Reconstruindo a superfície do prato', until: 72 },
  { key: 'textura', label: 'Aplicando as cores e texturas reais', until: 88 },
  { key: 'otimizando', label: 'Otimizando para abrir rápido no celular (Android e iPhone)', until: 100 },
] as const

export function stageFor(p: number) { return STAGES.find((s) => p < s.until) ?? STAGES[STAGES.length - 1] }

const DEMO_DURATION_MS = 45000
const demoStarts = new Map<string, number>()

export async function startCapture(dish: Dish, source: CaptureSource, files: File[], quality: CaptureQuality | undefined, thumb: string | undefined): Promise<Capture> {
  const conf = await serverConfig()
  const c: Capture = {
    id: uid('cap'), restaurant_id: dish.restaurant_id, dish_id: dish.id, created_at: new Date().toISOString(), source,
    provider: source === 'arquivo-3d' ? 'arquivo' : conf.provider, status: 'enviando', stage: STAGES[0].label, progress: 1, quality, thumb,
  }
  db.saveCapture(c)

  if (source === 'arquivo-3d') { void ingestModelFile(c, files); return c }

  if (conf.provider === 'demo') {
    demoStarts.set(c.id, Date.now())
    return c
  }

  // Provedor real: upload direto para o storage (não passa pelo servidor) e cria a tarefa.
  void (async () => {
    try {
      const sign = await fetch('api/uploads', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ restaurant_id: dish.restaurant_id, capture_id: c.id, files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })) }) }).then(ok)
      let sent = 0; const total = files.reduce((a, f) => a + f.size, 0)
      for (let i = 0; i < files.length; i++) {
        await put(sign.uploads[i].url, files[i], (n) => db.patchCapture(c.id, { progress: Math.round(1 + ((sent + n) / total) * 11) }))
        sent += files[i].size
      }
      const job = await fetch('api/captures', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ capture_id: c.id, kind: source === 'fotos' ? 'fotos' : 'video', paths: sign.uploads.map((u: any) => u.path) }) }).then(ok)
      db.patchCapture(c.id, { provider_task: job.task, status: 'na-fila', progress: 13, stage: STAGES[1].label })
    } catch (e: any) {
      db.patchCapture(c.id, { status: 'falhou', error: `Não foi possível enviar: ${e?.message ?? e}` })
    }
  })()
  return c
}

const ok = (r: Response) => (r.ok ? r.json() : r.text().then((t) => Promise.reject(new Error(t || r.statusText))))

function put(url: string, file: Blob, onProgress: (n: number) => void) {
  return new Promise<void>((res, rej) => {
    const x = new XMLHttpRequest()
    x.open('PUT', url); x.setRequestHeader('content-type', file.type || 'application/octet-stream')
    x.upload.onprogress = (e) => onProgress(e.loaded)
    x.onload = () => (x.status < 300 ? res() : rej(new Error(`upload ${x.status}`))); x.onerror = () => rej(new Error('rede'))
    x.send(file)
  })
}

/** Arquivo 3D pronto: guarda, limpa e mede no navegador (gltf-transform), e já vai para revisão. */
async function ingestModelFile(c: Capture, files: File[]) {
  try {
    const glbFile = files.find((f) => /\.(glb|gltf)$/i.test(f.name))
    const usdzFile = files.find((f) => /\.usdz$/i.test(f.name))
    if (!glbFile) throw new Error('Envie um arquivo .glb (o .usdz para iPhone é opcional).')
    db.patchCapture(c.id, { status: 'otimizando', progress: 40, stage: 'Limpando e otimizando o modelo' })
    const { optimizeGlb } = await import('./optimize')
    const out = await optimizeGlb(new Uint8Array(await glbFile.arrayBuffer()))
    const glb = await putFile(new Blob([out.glb], { type: 'model/gltf-binary' }))
    const usdz = usdzFile ? await putFile(usdzFile) : undefined
    db.patchCapture(c.id, { status: 'revisao', progress: 100, stage: 'Pronto para revisar', result: { glb, usdz, triangles: out.triangles, size_kb: Math.round(out.glb.byteLength / 1024) } })
  } catch (e: any) {
    db.patchCapture(c.id, { status: 'falhou', error: e?.message ?? String(e) })
  }
}

/**
 * Avança as capturas em andamento. Chamado a cada poucos segundos enquanto o painel está aberto.
 * Em produção o avanço vem do webhook do provedor gravando na tabela captures; aqui o painel consulta.
 */
export async function tick() {
  const live = getDB().captures.filter((c) => ['enviando', 'na-fila', 'processando', 'otimizando'].includes(c.status))
  for (const c of live) {
    if (c.provider === 'demo') {
      const t0 = demoStarts.get(c.id) ?? new Date(c.created_at).getTime()
      const p = Math.min(100, Math.round(((Date.now() - t0) / DEMO_DURATION_MS) * 100))
      if (p >= 100) {
        const dish = getDB().dishes.find((d) => d.id === c.dish_id)
        const demo = DEMO_MODELS[dish?.demo_model ?? ''] ?? DEMO_MODELS.dessert
        db.patchCapture(c.id, { status: 'revisao', progress: 100, stage: 'Pronto para revisar', result: { glb: demo.glb, triangles: undefined } })
      } else {
        const st = stageFor(p)
        db.patchCapture(c.id, { progress: Math.max(p, 1), stage: st.label, status: p < 12 ? 'enviando' : p < 18 ? 'na-fila' : p < 88 ? 'processando' : 'otimizando' })
      }
    } else if (c.provider === 'proprio' && c.provider_task) {
      try {
        const dish = getDB().dishes.find((d) => d.id === c.dish_id)
        const s = await fetch(`api/captures/status?task=${encodeURIComponent(c.provider_task)}&capture=${c.id}&restaurant=${c.restaurant_id}&plate_cm=${dish?.plate_cm ?? ''}`).then(ok)
        if (s.status === 'pronto') db.patchCapture(c.id, { status: 'revisao', progress: 100, stage: 'Pronto para revisar', result: s.result })
        else if (s.status === 'falhou') db.patchCapture(c.id, { status: 'falhou', error: s.error ?? 'A fotogrametria não conseguiu reconstruir o prato. Tente gravar de novo seguindo as dicas.' })
        else {
          // sem porcentagem do worker, estimamos pelo tempo (≈ 10 a 20 min por modelo numa GPU)
          const mins = (Date.now() - new Date(c.created_at).getTime()) / 60000
          const p = typeof s.progress === 'number' ? s.progress : s.status === 'na-fila' ? 15 : Math.min(95, Math.round(18 + (mins / 15) * 77))
          db.patchCapture(c.id, { status: s.status === 'na-fila' ? 'na-fila' : 'processando', progress: p, stage: stageFor(p).label })
        }
      } catch { /* rede instável: tenta de novo no próximo ciclo */ }
    }
  }
}
