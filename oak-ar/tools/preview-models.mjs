// Só para a prévia hospedada no Claude (que não serve .glb): converte cada .glb em .glb.b64.json.
import { readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
const dir = process.argv[2]
for (const f of readdirSync(dir).filter((x) => x.endsWith('.glb'))) {
  writeFileSync(`${dir}/${f}.b64.json`, JSON.stringify({ data: readFileSync(`${dir}/${f}`).toString('base64') }))
  rmSync(`${dir}/${f}`)
}
