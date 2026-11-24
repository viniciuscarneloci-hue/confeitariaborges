// Gera dist-preview/: a mesma página pronta para a prévia hospedada no Claude,
// que não serve .glb nem caminhos absolutos. Modelos viram models/<id>.glb.b64.json.
import { cpSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist-preview';
rmSync(out, { recursive: true, force: true });
cpSync('dist', out, { recursive: true });

const walk = d => readdirSync(d).flatMap(f => statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]);
for (const f of walk(out)) {
  if (f.endsWith('.glb')) {
    writeFileSync(f + '.b64.json', JSON.stringify(readFileSync(f).toString('base64')));
    rmSync(f);
  } else if (/\.(html|js|css)$/.test(f)) {
    let s = readFileSync(f, 'utf8').replace(/(["'(=])\/(_astro|posters|models|favicon)/g, '$1$2');
    if (f.endsWith('index.html')) s = s.replace('<html lang="pt-BR"', '<html lang="pt-BR" data-preview');
    writeFileSync(f, s);
  }
}
console.log(walk(out).map(f => f.slice(out.length + 1)).join('\n'));
