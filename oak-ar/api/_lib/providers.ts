import { env } from './env'

/**
 * Provedores de fotogrametria por vídeo/fotos. Todos falam a mesma "língua" com o painel:
 *   create(inputs) -> id da tarefa;  status(id) -> na-fila | processando | pronto (com URL do .glb) | falhou
 * Para trocar de provedor (ex.: um serviço pago no futuro), basta implementar esta interface.
 */
export interface JobStatus { status: 'na-fila' | 'processando' | 'pronto' | 'falhou'; progress?: number; result?: { glb: string; usdz?: string; triangles?: number; size_kb?: number }; error?: string }
export interface Provider {
  name: string
  create(input: { capture_id: string; kind: 'video' | 'fotos'; urls: string[]; output_prefix: string }): Promise<string>
  status(task: string): Promise<JobStatus>
}

/** Worker próprio (worker/ — COLMAP + OpenMVS numa máquina com GPU). */
export const selfHosted: Provider = {
  name: 'proprio',
  async create(input) {
    const r = await fetch(`${env.workerUrl}/jobs`, { method: 'POST', headers: auth(), body: JSON.stringify(input) })
    if (!r.ok) throw new Error(`worker ${r.status}: ${await r.text()}`)
    return ((await r.json()) as { id: string }).id
  },
  async status(task) {
    const r = await fetch(`${env.workerUrl}/jobs/${encodeURIComponent(task)}`, { headers: auth() })
    if (!r.ok) throw new Error(`worker ${r.status}`)
    return (await r.json()) as JobStatus
  },
}
const auth = () => ({ 'content-type': 'application/json', ...(env.workerToken ? { authorization: `Bearer ${env.workerToken}` } : {}) })

export function provider(): Provider | null { return env.workerUrl ? selfHosted : null }
