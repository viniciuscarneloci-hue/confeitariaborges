import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui/Icon'

/**
 * Gravação guiada do vídeo de fotogrametria, direto no navegador do celular.
 * Um anel mostra o quanto o dono já andou em volta do prato (pela bússola do aparelho quando disponível,
 * senão pelo tempo). São duas voltas: uma de cima (~45°) e outra mais baixa, quase na altura da mesa.
 */

const LAP_SECONDS = 25

export function CameraCapture({ onDone, onCancel }: { onDone: (f: File) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [rec, setRec] = useState(false)
  const [turn, setTurn] = useState(0) // 0..2 voltas
  const [secs, setSecs] = useState(0)
  const heading = useRef<{ last: number | null; acc: number; compass: boolean }>({ last: null, acc: 0, compass: false })

  useEffect(() => {
    let on = true
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => { if (!on) { s.getTracks().forEach((t) => t.stop()); return } streamRef.current = s; if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}) } })
      .catch(() => setErr('Não foi possível abrir a câmera. Permita o acesso à câmera ou use “Enviar vídeo”.'))
    return () => { on = false; streamRef.current?.getTracks().forEach((t) => t.stop()); removeEventListener('deviceorientation', onOrient) }
  }, [])

  function onOrient(e: DeviceOrientationEvent) {
    const a = (e as any).webkitCompassHeading ?? e.alpha
    if (a == null) return
    const h = heading.current
    if (h.last != null) { let d = a - h.last; if (d > 180) d -= 360; if (d < -180) d += 360; h.acc += Math.abs(d) }
    h.last = a; h.compass = true
  }

  async function start() {
    const s = streamRef.current; if (!s) return
    try { const DO: any = (window as any).DeviceOrientationEvent; if (DO?.requestPermission) await DO.requestPermission() } catch { /* sem bússola: usamos o tempo */ }
    addEventListener('deviceorientation', onOrient)
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
    const mimeType = types.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t))
    const r = new MediaRecorder(s, { mimeType, videoBitsPerSecond: 12_000_000 })
    chunks.current = []
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
    r.onstop = () => {
      const type = r.mimeType || 'video/webm'
      onDone(new File(chunks.current, `captura-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type }))
    }
    r.start(1000); recRef.current = r; setRec(true)
    const t0 = Date.now()
    const iv = setInterval(() => {
      const el = (Date.now() - t0) / 1000; setSecs(el)
      const h = heading.current
      const t = h.compass && h.acc > 5 ? h.acc / 360 : el / LAP_SECONDS
      setTurn(Math.min(2, t))
      if (t >= 2 || el > 120) { clearInterval(iv); stop() }
    }, 200)
    ;(recRef as any).iv = iv
  }
  function stop() {
    clearInterval((recRef as any).iv)
    removeEventListener('deviceorientation', onOrient)
    if (recRef.current?.state === 'recording') recRef.current.stop()
    setRec(false)
  }

  const lap = turn < 1 ? 1 : 2
  const frac = turn < 1 ? turn : turn - 1
  const R = 120, C = 2 * Math.PI * R
  return (
    <div className="cam">
      <video ref={videoRef} playsInline muted className="cam-video" />
      {err ? <div className="cam-err"><Icon name="alert" /> <p>{err}</p><button className="btn" onClick={onCancel}>Voltar</button></div> : <>
        <svg className="cam-ring" viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r={R} className="ring-bg" />
          <circle cx="150" cy="150" r={R} className="ring-lap1" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, turn))} />
          {turn > 1 && <circle cx="150" cy="150" r={R - 14} className="ring-lap2" strokeDasharray={2 * Math.PI * (R - 14)} strokeDashoffset={2 * Math.PI * (R - 14) * (1 - frac)} />}
        </svg>
        <div className="cam-top">
          <button className="icon-btn light" onClick={() => { stop(); onCancel() }} aria-label="Cancelar"><Icon name="close" /></button>
          <span>{rec ? `Gravando · ${Math.floor(secs)} s` : 'Centralize o prato no círculo'}</span>
        </div>
        <div className="cam-guide">
          {rec
            ? <p><strong>Volta {lap} de 2:</strong> {lap === 1 ? 'câmera mais alta, olhando o prato de cima (uns 45°).' : 'agora mais baixo, quase na altura da mesa.'} Ande devagar em volta do prato.</p>
            : <p>Prato no centro de uma mesa livre, com boa luz e sem flash. Você vai dar <strong>duas voltas</strong> em volta dele.</p>}
        </div>
        <div className="cam-actions">
          {rec ? <button className="rec-btn on" onClick={stop} aria-label="Parar"><span /></button>
               : <button className="rec-btn" onClick={start} aria-label="Começar a gravar"><span /></button>}
        </div>
      </>}
    </div>
  )
}
