/** Configuração do servidor (variáveis de ambiente na Vercel). Todas são opcionais no protótipo. */
export const env = {
  /** URL do worker de fotogrametria próprio (worker/). Sem ela, o vídeo roda em modo demonstração. */
  workerUrl: process.env.PHOTOGRAMMETRY_WORKER_URL?.replace(/\/$/, ''),
  workerToken: process.env.PHOTOGRAMMETRY_WORKER_TOKEN,
  /** Supabase Storage: onde vídeos, fotos e modelos ficam guardados. */
  supabaseUrl: process.env.SUPABASE_URL?.replace(/\/$/, ''),
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.STORAGE_BUCKET || 'capturas',
}
export const hasStorage = () => !!(env.supabaseUrl && env.supabaseKey)
