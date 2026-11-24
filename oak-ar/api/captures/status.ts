import { provider } from '../_lib/providers'

/** Consulta o andamento. Em produção o worker também avisa por webhook e grava na tabela captures. */
export default async function handler(req: any, res: any) {
  const p = provider(); if (!p) return res.status(503).send('Servidor de fotogrametria não configurado')
  const task = String(req.query.task ?? '')
  if (!task) return res.status(400).send('task obrigatório')
  res.setHeader('cache-control', 'no-store')
  res.status(200).json(await p.status(task))
}
