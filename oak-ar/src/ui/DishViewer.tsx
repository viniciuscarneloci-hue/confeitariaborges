import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DishModel } from '../data/types'
import { useAsset } from '../data/db'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX { interface IntrinsicElements { 'model-viewer': any } }
}

let lib: Promise<unknown> | null = null
/** Carrega o model-viewer sob demanda (fica fora do pacote inicial do cardápio). */
export const loadViewer = () => (lib ??= import('@google/model-viewer'))

export type ArState = 'off' | 'tracking' | 'placed' | 'failed'

/**
 * Visualizador 3D + RA de um prato.
 * - Android: WebXR (fica dentro da página) e, como reserva, Scene Viewer.
 * - iPhone: Quick Look com o .usdz enviado ou, se não houver, gerado na hora a partir do .glb.
 * - O prato aparece no tamanho real (ar-scale="fixed") e fica parado onde foi colocado.
 */
export function DishViewer({ model, alt, ar = true, autoRotate = true, scaleOverride, yawOverride, onLoad, onArStatus, children, className }: {
  model: Pick<DishModel, 'glb' | 'usdz' | 'poster' | 'scale' | 'yaw'>
  alt: string
  ar?: boolean
  autoRotate?: boolean
  scaleOverride?: number
  yawOverride?: number
  onLoad?: (mv: any) => void
  onArStatus?: (s: ArState) => void
  children?: ReactNode
  className?: string
}) {
  const ref = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const src = useAsset(model.glb)
  const usdz = useAsset(model.usdz)
  const poster = useAsset(model.poster)
  useEffect(() => { loadViewer().then(() => setReady(true)) }, [])
  const s = scaleOverride ?? model.scale ?? 1
  const yaw = yawOverride ?? model.yaw ?? 0
  // Scene Viewer (Android nativo) só abre arquivos com URL pública; para blobs locais ficamos no WebXR.
  const publicUrl = !!src && !src.startsWith('blob:')
  const modes = publicUrl ? 'webxr scene-viewer quick-look' : 'webxr quick-look'

  useEffect(() => {
    const mv = ref.current; if (!mv) return
    const load = () => { setLoaded(true); onLoad?.(mv) }
    const status = (e: any) => {
      const st = e.detail.status
      if (st === 'session-started') { mv.autoRotate = false; mv.resetTurntableRotation?.(0); onArStatus?.('tracking') }
      else if (st === 'object-placed') onArStatus?.('placed')
      else if (st === 'failed') onArStatus?.('failed')
      else if (st === 'not-presenting') { mv.autoRotate = autoRotate; onArStatus?.('off') }
    }
    mv.addEventListener('load', load); mv.addEventListener('ar-status', status)
    return () => { mv.removeEventListener('load', load); mv.removeEventListener('ar-status', status) }
  }, [ready, src])

  return (
    <div className={`viewer ${className ?? ''}`}>
      {ready && src && (
        <model-viewer ref={ref} src={src} ios-src={usdz} poster={poster} alt={alt}
          camera-controls touch-action="pan-y" auto-rotate={autoRotate ? '' : undefined} auto-rotate-delay="600" rotation-per-second="18deg"
          shadow-intensity="1" shadow-softness="0.9" exposure="1.05" environment-image="neutral" tone-mapping="aces"
          camera-orbit="25deg 58deg auto" min-camera-orbit="auto 10deg auto" max-camera-orbit="auto 88deg auto"
          scale={`${s} ${s} ${s}`} orientation={`0deg 0deg ${yaw}deg`}
          ar={ar ? '' : undefined} ar-modes={modes} ar-scale="fixed" ar-placement="floor" xr-environment
          interaction-prompt="none" loading="eager" style={{ width: '100%', height: '100%' }}>
          {children}
        </model-viewer>
      )}
      {!loaded && (poster ? <img className="viewer-poster" src={poster} alt="" /> : null)}
      {!loaded && <div className="viewer-loading"><span className="spinner" /> Carregando 3D…</div>}
    </div>
  )
}
