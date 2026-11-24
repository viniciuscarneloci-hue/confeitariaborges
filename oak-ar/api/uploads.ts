import { hasStorage } from './_lib/env'
import { signedUpload } from './_lib/storage'

/** Gera URLs assinadas para o navegador enviar vídeo/fotos direto ao storage (sem passar pelo limite de 4,5 MB da função). */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!hasStorage()) return res.status(503).send('Storage não configurado')
  const { restaurant_id, capture_id, files } = req.body ?? {}
  if (!/^[\w-]+$/.test(restaurant_id ?? '') || !/^[\w-]+$/.test(capture_id ?? '') || !Array.isArray(files) || !files.length || files.length > 400)
    return res.status(400).send('Pedido inválido')
  // TODO produção: validar a sessão do dono (Supabase Auth) e se restaurant_id pertence a ele.
  const uploads = await Promise.all(files.map(async (f: { name: string }, i: number) => {
    const ext = (String(f.name).match(/\.(\w{2,5})$/)?.[1] ?? 'bin').toLowerCase()
    const path = `${restaurant_id}/${capture_id}/entrada/${String(i).padStart(4, '0')}.${ext}`
    return { path, url: await signedUpload(path) }
  }))
  res.status(200).json({ uploads })
}
