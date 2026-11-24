import { hasStorage } from './_lib/env'
import { provider } from './_lib/providers'

export default function handler(_req: any, res: any) {
  res.setHeader('cache-control', 'no-store')
  res.status(200).json({ provider: provider() && hasStorage() ? 'proprio' : 'demo', storage: hasStorage() })
}
