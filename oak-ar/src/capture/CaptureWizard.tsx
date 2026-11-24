import { useEffect, useRef, useState } from 'react'
import { db, putFile, resolveAsset, useDB } from '../data/db'
import { DEMO_MODELS } from '../data/seed'
import type { Capture, CaptureQuality, Dish } from '../data/types'
import { DishViewer } from '../ui/DishViewer'
import { Icon } from '../ui/Icon'
import { analyzeImages, analyzeVideo } from './analyze'
import { CameraCapture } from './CameraCapture'
import { STAGES, serverConfig, startCapture, type ServerConfig } from './pipeline'

type Step = 'metodo' | 'app' | 'dicas' | 'camera' | 'analise' | 'acompanhar'

export function CaptureWizard({ dish, captureId, onClose }: { dish: Dish; captureId?: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>(captureId ? 'acompanhar' : 'metodo')
  const [capId, setCapId] = useState<string | undefined>(captureId)
  const [files, setFiles] = useState<File[]>([])
  const [kind, setKind] = useState<'video-camera' | 'video-arquivo' | 'fotos'>('video-arquivo')
  const [conf, setConf] = useState<ServerConfig | null>(null)
  useEffect(() => { serverConfig().then(setConf) }, [])
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && step !== 'camera' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [step])

  async function sendModelFiles(fs: File[]) {
    const c = await startCapture(dish, 'arquivo-3d', fs, undefined, undefined)
    setCapId(c.id); setStep('acompanhar')
  }

  if (step === 'camera') return <CameraCapture onCancel={() => setStep('dicas')} onDone={(f) => { setFiles([f]); setKind('video-camera'); setStep('analise') }} />

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label={`Criar 3D de ${dish.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><small>Criar 3D</small><h2>{dish.name}</h2></div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
        </div>

        {step === 'metodo' && (
          <div className="methods">
            <button className="method rec" onClick={() => setStep('app')}>
              <span className="method-badge">Recomendado · sem custo por prato</span>
              <Icon name="cube" size={28} />
              <strong>Escanear com um app e enviar o arquivo</strong>
              <span>Use um app grátis como o Scaniverse (Android e iPhone) ou o Object Capture do iPhone. Envie o .glb (e o .usdz, se tiver). O painel ajusta tamanho, posição e peso do arquivo sozinho.</span>
            </button>
            <button className="method" onClick={() => { setKind('video-camera'); setStep('dicas') }}>
              <Icon name="video" size={28} />
              <strong>Gravar vídeo agora</strong>
              <span>Grave duas voltas em volta do prato com o celular. O servidor de fotogrametria gera o 3D.</span>
              {conf?.provider === 'demo' && <span className="pill warn">Modo demonstração</span>}
            </button>
            <label className="method">
              <Icon name="upload" size={28} />
              <strong>Enviar vídeo ou fotos</strong>
              <span>Um vídeo de 30 a 60 s ou de 40 a 100 fotos do prato, de todos os lados.</span>
              {conf?.provider === 'demo' && <span className="pill warn">Modo demonstração</span>}
              <input type="file" accept="video/*,image/*" multiple hidden onChange={(e) => {
                const fs = Array.from(e.target.files ?? []); if (!fs.length) return
                setFiles(fs); setKind(fs[0].type.startsWith('image/') ? 'fotos' : 'video-arquivo'); setStep('analise')
              }} />
            </label>
          </div>
        )}

        {step === 'app' && <AppGuide onBack={() => setStep('metodo')} onFiles={sendModelFiles} />}

        {step === 'dicas' && (
          <div className="tips">
            <TipsArt />
            <ol>
              <li><strong>Prato no centro de uma mesa livre</strong>, sem outros objetos em volta. Toalha lisa ajuda.</li>
              <li><strong>Luz boa e uniforme</strong>, de preferência natural. Sem flash e sem sombra forte.</li>
              <li><strong>Duas voltas devagar</strong>: uma de cima (uns 45°) e outra mais baixa, quase na altura da mesa.</li>
              <li><strong>Não mexa no prato</strong> durante a gravação. Quem se move é você.</li>
              <li>De 30 a 60 segundos, em 1080p ou 4K.</li>
            </ol>
            <div className="row-end">
              <button className="btn ghost" onClick={() => setStep('metodo')}>Voltar</button>
              <button className="btn primary" onClick={() => setStep('camera')}><Icon name="camera" /> Abrir a câmera</button>
            </div>
          </div>
        )}

        {step === 'analise' && <Analysis files={files} kind={kind} provider={conf?.provider ?? 'demo'} onRetry={() => setStep('metodo')}
          onSend={async (q, thumb) => { const c = await startCapture(dish, kind, files, q, thumb); setCapId(c.id); setStep('acompanhar') }} />}

        {step === 'acompanhar' && capId && <Track dish={dish} capId={capId} onClose={onClose} onRestart={() => { setCapId(undefined); setStep('metodo') }} />}
      </div>
    </div>
  )
}

function AppGuide({ onBack, onFiles }: { onBack: () => void; onFiles: (f: File[]) => void }) {
  const [drag, setDrag] = useState(false)
  const pick = (list: FileList | null) => { const fs = Array.from(list ?? []).filter((f) => /\.(glb|gltf|usdz)$/i.test(f.name)); if (fs.length) onFiles(fs) }
  return (
    <div className="app-guide">
      <div className="apps">
        <div className="app-card best"><span className="pill">Grátis · recomendado</span><strong>Scaniverse</strong><span>Android e iPhone. Escaneie em modo malha (“Mesh”), dando a volta no prato, e exporte em <b>GLB</b> (e <b>USDZ</b> para iPhone). Sem custo e sem limite.</span></div>
        <div className="app-card"><span className="pill">Grátis · iPhone</span><strong>Object Capture</strong><span>Pelo app Reality Composer da Apple. Qualidade excelente em iPhones recentes. Exporta <b>USDZ</b>; envie junto um GLB (o Scaniverse converte).</span></div>
        <div className="app-card"><span className="pill">Plano grátis limitado</span><strong>KIRI Engine</strong><span>Android e iPhone. Modo “Photo Scan”. O plano grátis tem poucas exportações por semana; o Pro libera sem limite.</span></div>
      </div>
      <p className="muted">Dica: no app, recorte o prato (remova a mesa em volta) antes de exportar. Se o arquivo ficar pesado, não tem problema: o painel reduz para abrir rápido no celular.</p>
      <label className={`drop ${drag ? 'on' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files) }}>
        <Icon name="upload" size={28} />
        <strong>Solte aqui o .glb (e o .usdz, se tiver)</strong>
        <span>ou toque para escolher o arquivo</span>
        <input type="file" accept=".glb,.gltf,.usdz,model/gltf-binary" multiple hidden onChange={(e) => pick(e.target.files)} />
      </label>
      <div className="row-end"><button className="btn ghost" onClick={onBack}>Voltar</button></div>
    </div>
  )
}

function Analysis({ files, kind, provider, onRetry, onSend }: { files: File[]; kind: string; provider: string; onRetry: () => void; onSend: (q: CaptureQuality, thumb?: string) => void }) {
  const [p, setP] = useState(0)
  const [res, setRes] = useState<{ quality: CaptureQuality; thumb?: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const run = kind === 'fotos' ? analyzeImages(files, setP) : analyzeVideo(files[0], setP)
    run.then(setRes).catch(() => setErr('Não conseguimos ler este vídeo no navegador (alguns formatos do iPhone, como HEVC, não abrem no computador). Você pode enviar mesmo assim.'))
  }, [])
  const q = res?.quality
  const grade = !q ? '' : q.score >= 75 ? 'bom' : q.score >= 50 ? 'medio' : 'ruim'
  return (
    <div className="analysis">
      {!res && !err && <div className="analysing"><span className="spinner" /> Conferindo nitidez, luz e cobertura… {Math.round(p * 100)}%</div>}
      {err && <p className="note warn">{err}</p>}
      {q && (
        <div className="quality">
          {res?.thumb && <img src={res.thumb} alt="Quadro do vídeo" />}
          <div>
            <div className={`score ${grade}`}><b>{q.score}</b><span>/100</span><em>{grade === 'bom' ? 'Boa captura' : grade === 'medio' ? 'Dá para usar' : 'Melhor gravar de novo'}</em></div>
            <dl className="metrics">
              {q.duration_s != null && <><dt>Duração</dt><dd>{Math.round(q.duration_s)} s</dd></>}
              {q.width ? <><dt>Resolução</dt><dd>{q.width}×{q.height}</dd></> : null}
              <dt>{kind === 'fotos' ? 'Fotos nítidas' : 'Quadros nítidos'}</dt><dd>{kind === 'fotos' ? `${q.frames_used} de ${q.frames_total}` : `${Math.round(q.sharpness * 100)}%`}</dd>
              <dt>Iluminação</dt><dd>{Math.round(q.brightness * 100)}%</dd>
            </dl>
            <ul className="qtips">{q.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      )}
      {provider === 'demo' && (res || err) && <p className="note">Modo demonstração: este protótipo ainda não tem o servidor de fotogrametria ligado. As etapas são simuladas e o resultado é um modelo de exemplo. Para o 3D real do seu prato agora, use “Escanear com um app”.</p>}
      <div className="row-end">
        <button className="btn ghost" onClick={onRetry}>Gravar de novo</button>
        <button className="btn primary" disabled={(!res && !err) || busy} onClick={() => { setBusy(true); onSend(q ?? { frames_total: 0, frames_used: 0, sharpness: 0, brightness: 0, score: 0, tips: [] }, res?.thumb) }}>
          <Icon name="sparkle" /> Gerar 3D
        </button>
      </div>
    </div>
  )
}

function Track({ dish, capId, onClose, onRestart }: { dish: Dish; capId: string; onClose: () => void; onRestart: () => void }) {
  const data = useDB()
  const c = data.captures.find((x) => x.id === capId)
  const d = data.dishes.find((x) => x.id === dish.id) ?? dish
  if (!c) return null
  if (c.status === 'revisao' && c.result) return <Review c={c} dish={d} onDone={onClose} onRestart={onRestart} />
  if (c.status === 'publicado') return <div className="done"><Icon name="check" size={40} /><h3>Publicado no cardápio</h3><p>Os clientes já podem ver “{d.name}” em 3D e na mesa.</p><button className="btn primary" onClick={onClose}>Concluir</button></div>
  if (c.status === 'falhou') return <div className="done fail"><Icon name="alert" size={40} /><h3>Não deu certo desta vez</h3><p>{c.error}</p><button className="btn primary" onClick={onRestart}>Tentar de novo</button></div>
  return <Progress c={c} onClose={onClose} />
}

export function Progress({ c, onClose }: { c: Capture; onClose?: () => void }) {
  const idx = STAGES.findIndex((s) => c.progress < s.until)
  const isFile = c.provider === 'arquivo'
  return (
    <div className="progress">
      <div className="bar"><span style={{ width: `${c.progress}%` }} /></div>
      <p className="progress-label">{c.stage} · {c.progress}%</p>
      {!isFile && (
        <ol className="stages">
          {STAGES.map((s, i) => <li key={s.key} className={i < idx ? 'ok' : i === idx ? 'now' : ''}>{i < idx ? <Icon name="check" size={16} /> : <span className="dot" />} {s.label}</li>)}
        </ol>
      )}
      {onClose && !isFile && <p className="muted">Pode fechar esta janela: o processamento continua e o prato aparece em “Capturas 3D” quando estiver pronto para revisar.</p>}
      {onClose && !isFile && <div className="row-end"><button className="btn" onClick={onClose}>Fechar e continuar depois</button></div>}
    </div>
  )
}

/** Revisão: o dono confere o 3D, calibra o tamanho real pelo diâmetro do prato, vira a "frente" e publica. */
function Review({ c, dish, onDone, onRestart }: { c: Capture; dish: Dish; onDone: () => void; onRestart: () => void }) {
  const [base, setBase] = useState<{ w: number; h: number; d: number } | null>(null)
  const [diam, setDiam] = useState<number>(dish.plate_cm ?? 0)
  const [yaw, setYaw] = useState(0)
  const [busy, setBusy] = useState(false)
  const mv = useRef<any>(null)
  useEffect(() => {
    resolveAsset(c.result!.glb).then(async (u) => {
      if (!u) return
      const { measureGlb } = await import('./optimize')
      const b = await measureGlb(new URL(u, location.href).href)
      setBase(b)
      if (!dish.plate_cm) setDiam(Math.round(Math.max(b.w, b.d) * 100))
    }).catch(() => setBase(null))
  }, [c.result?.glb])
  const longest = base ? Math.max(base.w, base.d) : 0
  const scale = base && diam > 0 && longest > 0 ? diam / (longest * 100) : 1
  const size = base ? { w: base.w * scale * 100, h: base.h * scale * 100, d: base.d * scale * 100 } : null
  const isDemo = c.provider === 'demo'
  const demoPoster = Object.values(DEMO_MODELS).find((m) => m.glb === c.result!.glb)?.poster

  async function publish() {
    setBusy(true)
    let poster: string | undefined = demoPoster
    try {
      if (!poster && mv.current?.toBlob) poster = await putFile(await mv.current.toBlob({ mimeType: 'image/webp', qualityArgument: 0.85, idealAspect: false }))
    } catch { /* sem pôster: o cardápio mostra a inicial do prato */ }
    db.patchDish(dish.id, { plate_cm: diam || dish.plate_cm, model: {
      glb: c.result!.glb, usdz: c.result!.usdz, poster, scale, yaw, size_cm: size ?? { w: diam, h: 0, d: diam },
      source: c.provider === 'arquivo' ? 'arquivo' : isDemo ? 'demonstracao' : 'fotogrametria', capture_id: c.id, published_at: new Date().toISOString() } })
    db.patchCapture(c.id, { status: 'publicado' })
    setBusy(false)
  }

  return (
    <div className="review">
      <div className="review-viewer">
        <DishViewer model={{ glb: c.result!.glb, usdz: c.result!.usdz, scale, yaw }} alt={`Prévia 3D de ${dish.name}`} autoRotate={false} onLoad={(m) => (mv.current = m)} />
      </div>
      <div className="review-side">
        {isDemo && <p className="note">Modo demonstração: este é um modelo de exemplo no lugar do scan do seu vídeo.</p>}
        <h3>Confira e ajuste</h3>
        <label className="field">
          <span>Diâmetro real do prato (cm)</span>
          <div className="input-unit"><input type="number" min={3} max={120} step={0.5} value={diam || ''} onChange={(e) => setDiam(Number(e.target.value))} /><em>cm</em></div>
          <small>Meça com uma régua a borda do prato ou da tábua. É o que garante o tamanho real na mesa.</small>
        </label>
        {size && <p className="size-out"><Icon name="ruler" size={16} /> Na mesa: {size.w.toFixed(1)} × {size.d.toFixed(1)} cm, altura {size.h.toFixed(1)} cm</p>}
        <label className="field">
          <span>Girar para a frente do prato ficar virada para o cliente</span>
          <input type="range" min={-180} max={180} step={5} value={yaw} onChange={(e) => setYaw(Number(e.target.value))} />
        </label>
        {c.result?.triangles ? <p className="muted small">{c.result.triangles.toLocaleString('pt-BR')} triângulos{c.result.size_kb ? ` · ${(c.result.size_kb / 1024).toFixed(1)} MB` : ''}</p> : null}
        <div className="row-end">
          <button className="btn ghost" onClick={() => { db.patchCapture(c.id, { status: 'descartado' }); onRestart() }}>Descartar</button>
          <button className="btn primary" disabled={busy || !diam} onClick={publish}><Icon name="check" /> Publicar no cardápio</button>
        </div>
        {dish.model && <p className="muted small">Isto substitui o 3D publicado hoje.</p>}
        <button className="link" onClick={onDone}>Revisar depois</button>
      </div>
    </div>
  )
}

function TipsArt() {
  return (
    <svg viewBox="0 0 320 150" className="tips-art" aria-hidden="true">
      <ellipse cx="160" cy="105" rx="120" ry="30" fill="var(--line)" />
      <ellipse cx="160" cy="98" rx="46" ry="13" fill="#fff" stroke="var(--ink-3)" />
      <ellipse cx="160" cy="94" rx="26" ry="8" fill="var(--accent)" opacity=".85" />
      <ellipse cx="160" cy="98" rx="100" ry="32" fill="none" stroke="var(--accent)" strokeDasharray="6 6" strokeWidth="2" />
      <ellipse cx="160" cy="70" rx="85" ry="22" fill="none" stroke="var(--ink-2)" strokeDasharray="6 6" strokeWidth="2" />
      <rect x="236" y="52" width="16" height="26" rx="3" fill="var(--ink)" />
      <rect x="252" y="96" width="16" height="26" rx="3" fill="var(--accent)" />
      <text x="20" y="40" fontSize="12" fill="var(--ink-2)">Volta 1: de cima</text>
      <text x="20" y="140" fontSize="12" fill="var(--accent)">Volta 2: mais baixo</text>
    </svg>
  )
}
