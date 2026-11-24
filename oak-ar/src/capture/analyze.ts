import type { CaptureQuality } from '../data/types'

/**
 * Análise da captura feita no próprio navegador, antes de enviar.
 * Evita o pior cenário da fotogrametria: esperar minutos para descobrir que o vídeo estava tremido ou escuro.
 *
 * Mede em quadros amostrados: nitidez (variância do Laplaciano), iluminação e quanto a câmera se moveu
 * (a fotogrametria precisa de vistas de vários ângulos; vídeo parado não serve).
 */

const W = 256

function frameStats(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const { data } = ctx.getImageData(0, 0, w, h)
  const g = new Float32Array(w * h)
  let sum = 0
  for (let i = 0; i < w * h; i++) { const v = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255; g[i] = v; sum += v }
  let lsum = 0, lsq = 0, n = 0
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x
    const l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]
    lsum += l; lsq += l * l; n++
  }
  const mean = lsum / n
  return { gray: g, brightness: sum / (w * h), lapVar: lsq / n - mean * mean }
}

/** Nitidez: variância do Laplaciano mapeada para 0..1 (≈0.002 já é um quadro aceitável em 256 px). */
const sharpScore = (v: number) => Math.max(0, Math.min(1, Math.log10(v / 0.0004) / Math.log10(0.01 / 0.0004)))

function diff(a: Float32Array, b: Float32Array) { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length }

function finish(stats: { brightness: number; sharp: number; gray: Float32Array }[], extra: { duration_s?: number; width?: number; height?: number }, total: number, kind: 'video' | 'fotos'): CaptureQuality {
  const tips: string[] = []
  const good = stats.filter((s) => s.sharp >= 0.35)
  const sharpness = stats.reduce((a, s) => a + s.sharp, 0) / Math.max(1, stats.length)
  const brightness = stats.reduce((a, s) => a + s.brightness, 0) / Math.max(1, stats.length)
  let motion = 0
  for (let i = 1; i < stats.length; i++) motion += diff(stats[i - 1].gray, stats[i].gray)
  motion /= Math.max(1, stats.length - 1)

  let score = 100
  if (kind === 'video' && extra.duration_s != null) {
    if (extra.duration_s < 15) { score -= 30; tips.push('O vídeo está curto. Grave de 30 a 60 segundos, dando duas voltas no prato (uma mais alta e outra mais baixa).') }
    else if (extra.duration_s > 150) { score -= 10; tips.push('O vídeo está longo. Até 90 segundos já é suficiente e envia mais rápido.') }
  }
  if (kind === 'fotos' && total < 30) { score -= 30; tips.push('Poucas fotos. Use de 40 a 100 fotos, cobrindo o prato por todos os lados.') }
  const minSide = Math.min(extra.width ?? 0, extra.height ?? 0)
  if (minSide && minSide < 720) { score -= 20; tips.push('Resolução baixa. Grave em 1080p ou 4K.') }
  if (sharpness < 0.35) { score -= 25; tips.push('Muitos quadros tremidos. Ande mais devagar e mantenha o celular firme.') }
  else if (sharpness < 0.5) { score -= 10; tips.push('Alguns quadros tremidos. Movimentos mais lentos melhoram o resultado.') }
  if (brightness < 0.28) { score -= 20; tips.push('Imagem escura. Use luz natural ou mais luz no ambiente, sem flash.') }
  else if (brightness > 0.85) { score -= 10; tips.push('Imagem muito clara. Evite luz direta forte em cima do prato.') }
  if (kind === 'video' && motion < 0.02) { score -= 25; tips.push('A câmera quase não se moveu. Caminhe em volta do prato para mostrar todos os lados.') }
  if (!tips.length) tips.push('Ótima captura: nítida, bem iluminada e com boa cobertura.')
  return { ...extra, frames_total: total, frames_used: good.length, sharpness, brightness, score: Math.max(0, Math.min(100, Math.round(score))), tips }
}

export async function analyzeVideo(file: Blob, onProgress?: (p: number) => void): Promise<{ quality: CaptureQuality; thumb?: string }> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url
  try {
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('formato')); setTimeout(() => rej(new Error('tempo')), 15000) })
    const duration = isFinite(v.duration) ? v.duration : await fixDuration(v)
    const h = Math.round(W * v.videoHeight / v.videoWidth) || W
    const c = document.createElement('canvas'); c.width = W; c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    const N = 20
    const stats: { brightness: number; sharp: number; gray: Float32Array }[] = []
    let thumb: string | undefined
    for (let i = 0; i < N; i++) {
      const t = (duration * (i + 0.5)) / N
      await new Promise<void>((res) => { const done = () => { v.removeEventListener('seeked', done); res() }; v.addEventListener('seeked', done); v.currentTime = t; setTimeout(done, 3000) })
      ctx.drawImage(v, 0, 0, W, h)
      const s = frameStats(ctx, W, h)
      stats.push({ brightness: s.brightness, sharp: sharpScore(s.lapVar), gray: s.gray })
      if (i === Math.floor(N / 3)) thumb = c.toDataURL('image/jpeg', 0.7)
      onProgress?.((i + 1) / N)
    }
    const fps = 30
    return { quality: finish(stats, { duration_s: duration, width: v.videoWidth, height: v.videoHeight }, Math.round(duration * fps), 'video'), thumb }
  } finally { URL.revokeObjectURL(url) }
}

/** Vídeos gravados com MediaRecorder às vezes vêm com duração "Infinity" até serem percorridos. */
async function fixDuration(v: HTMLVideoElement): Promise<number> {
  return new Promise((res) => {
    const done = () => { v.removeEventListener('durationchange', done); const d = v.duration; v.currentTime = 0; res(isFinite(d) ? d : 1) }
    v.addEventListener('durationchange', done); v.currentTime = 1e7; setTimeout(done, 3000)
  })
}

export async function analyzeImages(files: File[], onProgress?: (p: number) => void): Promise<{ quality: CaptureQuality; thumb?: string }> {
  const pick = files.length <= 24 ? files : Array.from({ length: 24 }, (_, i) => files[Math.floor((i * files.length) / 24)])
  const stats: { brightness: number; sharp: number; gray: Float32Array }[] = []
  let thumb: string | undefined, width = 0, height = 0
  for (let i = 0; i < pick.length; i++) {
    const bmp = await createImageBitmap(pick[i])
    width = bmp.width; height = bmp.height
    const h = Math.round(W * bmp.height / bmp.width)
    const c = document.createElement('canvas'); c.width = W; c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bmp, 0, 0, W, h)
    const s = frameStats(ctx, W, h)
    stats.push({ brightness: s.brightness, sharp: sharpScore(s.lapVar), gray: s.gray })
    if (i === 0) thumb = c.toDataURL('image/jpeg', 0.7)
    onProgress?.((i + 1) / pick.length)
  }
  const q = finish(stats, { width, height }, files.length, 'fotos')
  q.frames_used = Math.round(files.length * (stats.filter((s) => s.sharp >= 0.35).length / Math.max(1, stats.length)))
  return { quality: q, thumb }
}
