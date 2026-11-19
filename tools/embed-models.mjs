// Gera src/menu/cakeModels.ts com os .glb em base64 (só para o preview do Claude).
import { readFileSync, writeFileSync } from 'node:fs'
const b = (f) => readFileSync(`public/models/${f}`).toString('base64')
writeFileSync('src/menu/cakeModels.ts', `// gerado por tools/embed-models.mjs\nexport const MODELS: Record<string, string> = {\n  'models/bolo-redondo.glb': '${b('bolo-redondo.glb')}',\n  'models/bolo-quadrado.glb': '${b('bolo-quadrado.glb')}',\n}\n`)
