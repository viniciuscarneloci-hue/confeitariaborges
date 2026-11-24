import { signedDownload } from '../_lib/storage'
import { provider } from '../_lib/providers'

/** Cria a tarefa de fotogrametria a partir dos arquivos já enviados ao storage. */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end()
  const p = provider(); if (!p) return res.status(503).send('Servidor de fotogrametria não configurado')
  const { capture_id, kind, paths } = req.body ?? {}
  if (!/^[\w-]+$/.test(capture_id ?? '') || !['video', 'fotos'].includes(kind) || !Array.isArray(paths) || !paths.length) return res.status(400).send('Pedido inválido')
  if (paths.some((x: string) => !/^[\w-]+\/[\w-]+\/entrada\/\d{4}\.\w{2,5}$/.test(x))) return res.status(400).send('Caminho inválido')
  const urls = await Promise.all(paths.map((x: string) => signedDownload(x)))
  const prefix = paths[0].split('/entrada/')[0]
  const task = await p.create({ capture_id, kind, urls, output_prefix: `${prefix}/saida` })
  res.status(200).json({ task, provider: p.name })
}
