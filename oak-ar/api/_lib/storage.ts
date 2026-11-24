import { env } from './env'

/** Supabase Storage via REST (sem SDK). O navegador envia direto para o storage com uma URL assinada. */
const h = () => ({ authorization: `Bearer ${env.supabaseKey}`, apikey: env.supabaseKey! })

export async function signedUpload(path: string): Promise<string> {
  const r = await fetch(`${env.supabaseUrl}/storage/v1/object/upload/sign/${env.bucket}/${path}`, { method: 'POST', headers: h() })
  if (!r.ok) throw new Error(`storage sign upload ${r.status}: ${await r.text()}`)
  const j = (await r.json()) as { url: string }
  return `${env.supabaseUrl}/storage/v1${j.url}`
}

export async function signedDownload(path: string, expiresIn = 6 * 3600): Promise<string> {
  const r = await fetch(`${env.supabaseUrl}/storage/v1/object/sign/${env.bucket}/${path}`, {
    method: 'POST', headers: { ...h(), 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn }) })
  if (!r.ok) throw new Error(`storage sign download ${r.status}: ${await r.text()}`)
  const j = (await r.json()) as { signedURL: string }
  return `${env.supabaseUrl}/storage/v1${j.signedURL}`
}
