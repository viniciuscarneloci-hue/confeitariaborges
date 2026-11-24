"""
Worker de fotogrametria do Oak AR (roda numa máquina com GPU NVIDIA).

API mínima usada pelo painel (via api/_lib/providers.ts):
  POST /jobs        {capture_id, kind, urls[], output_prefix}  -> {id}
  GET  /jobs/<id>   -> {status: na-fila|processando|pronto|falhou, progress, result: {glb}, error}

Processa uma tarefa por vez (uma GPU). Baixa as entradas por URL assinada, roda reconstruct.sh,
envia o .glb para o Supabase Storage e devolve uma URL pública/assinada.
Só biblioteca padrão do Python: nada para instalar além do que o Dockerfile já traz.
"""
import json, os, queue, re, shutil, subprocess, threading, urllib.request, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ.get('WORKER_TOKEN', '')
SUPA = os.environ.get('SUPABASE_URL', '').rstrip('/')
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
BUCKET = os.environ.get('STORAGE_BUCKET', 'capturas')
ROOT = os.environ.get('WORK_DIR', '/tmp/oak-jobs')
jobs, q = {}, queue.Queue()

def upload(local, path):
    data = open(local, 'rb').read()
    req = urllib.request.Request(f'{SUPA}/storage/v1/object/{BUCKET}/{path}', data=data, method='POST',
        headers={'authorization': f'Bearer {KEY}', 'apikey': KEY, 'content-type': 'model/gltf-binary', 'x-upsert': 'true'})
    urllib.request.urlopen(req).read()
    req = urllib.request.Request(f'{SUPA}/storage/v1/object/sign/{BUCKET}/{path}', data=json.dumps({'expiresIn': 60 * 60 * 24 * 365}).encode(),
        method='POST', headers={'authorization': f'Bearer {KEY}', 'apikey': KEY, 'content-type': 'application/json'})
    return SUPA + '/storage/v1' + json.loads(urllib.request.urlopen(req).read())['signedURL']

def run(job_id):
    j = jobs[job_id]; j['status'] = 'processando'; j['progress'] = 15
    base = os.path.join(ROOT, job_id); inp = os.path.join(base, 'entrada'); os.makedirs(inp, exist_ok=True)
    try:
        for i, u in enumerate(j['input']['urls']):
            ext = re.search(r'\.(\w{2,5})(\?|$)', u); ext = ext.group(1) if ext else 'bin'
            urllib.request.urlretrieve(u, os.path.join(inp, f'{i:04d}.{ext}'))
        p = subprocess.Popen(['bash', os.path.join(os.path.dirname(__file__), 'reconstruct.sh'), inp, os.path.join(base, 'trabalho')],
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        tail = []
        for line in p.stdout:
            tail = (tail + [line.strip()])[-30:]
            m = re.match(r'PROGRESSO (\d+)', line)
            if m: j['progress'] = int(m.group(1))
        if p.wait() != 0:
            raise RuntimeError(next((l[5:] for l in reversed(tail) if l.startswith('ERRO')), 'falha na reconstrução'))
        glb = os.path.join(base, 'trabalho', 'prato.glb')
        url = upload(glb, f"{j['input']['output_prefix']}/prato.glb")
        j.update(status='pronto', progress=100, result={'glb': url, 'size_kb': os.path.getsize(glb) // 1024})
    except Exception as e:  # noqa: BLE001
        j.update(status='falhou', error=str(e))
    finally:
        shutil.rmtree(base, ignore_errors=True)

def loop():
    while True: run(q.get())

class H(BaseHTTPRequestHandler):
    def _ok(self):
        if TOKEN and self.headers.get('authorization') != f'Bearer {TOKEN}':
            self.send_response(401); self.end_headers(); return False
        return True
    def _json(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header('content-type', 'application/json'); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        if not self._ok(): return
        if self.path != '/jobs': return self._json(404, {})
        body = json.loads(self.rfile.read(int(self.headers.get('content-length', 0))) or b'{}')
        jid = uuid.uuid4().hex[:12]; jobs[jid] = {'status': 'na-fila', 'progress': 13, 'input': body}; q.put(jid)
        self._json(200, {'id': jid})
    def do_GET(self):
        if not self._ok(): return
        m = re.match(r'^/jobs/(\w+)$', self.path)
        j = jobs.get(m.group(1)) if m else None
        if not j: return self._json(404, {'status': 'falhou', 'error': 'tarefa não encontrada'})
        self._json(200, {k: v for k, v in j.items() if k != 'input'})

if __name__ == '__main__':
    threading.Thread(target=loop, daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', 8080))), H).serve_forever()
