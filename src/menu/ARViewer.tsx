import { useEffect, useRef, useState } from 'react'
import type { Product, CakeFormat } from '../data/types'
import { kg } from '../lib/format'
import { Icon } from '../ui/Icon'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX { interface IntrinsicElements { 'model-viewer': any } }
}

/** WebXR primeiro (mantém sabor e tamanho escolhidos); depois RA nativa do Android e do iPhone. */
const AR_MODES = import.meta.env.VITE_EMBED_MODELS === '1' ? 'webxr quick-look' : 'webxr scene-viewer quick-look'
const TOPPING: Record<string, string> = { morango: '#D7263D', frutas: '#B0223A', pistache: '#7FA34A', coco: '#FFFFFF', chocolate: '#4A2A1C', brigadeiro: '#4A2A1C', nozes: '#9B6B3E', ovomaltine: '#8A5A2B', limao: '#C9DB4E', maracuja: '#F2B632', abacaxi: '#F0C43A', ameixa: '#3B1E2E', nenhum: '#F3DFA9' }

/** Tamanho do bolo: 1 kg redondo ≈ 20 cm; 1 kg quadrado ≈ 18 × 14 cm. Cresce em área, altura fixa. */
export function cakeScale(weightKg: number) { return Math.sqrt(weightKg) }

/** Carrega o visualizador 3D antes do clique em "Ver na mesa", para abrir na hora. */
let _lib: Promise<unknown> | null = null
export const preloadViewer = () => (_lib ??= import('@google/model-viewer'))

export function ARViewer({ product: p, format, weightKg, onClose }: { product: Product; format: CakeFormat; weightKg: number; onClose: () => void }) {
  const ref = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [lib, setLib] = useState(false)
  const [arOk, setArOk] = useState<boolean | null>(null)
  const [arState, setArState] = useState<'off' | 'tracking' | 'placed' | 'failed'>('off')
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    // Na Vercel os .glb são servidos de /models (necessário para a RA nativa do Android/iPhone).
    // No preview do Claude (que não serve .glb) os modelos vão embutidos: build com VITE_EMBED_MODELS=1.
    if (import.meta.env.VITE_EMBED_MODELS !== '1') { preloadViewer().then(() => setLib(true)); return }
    Promise.all([preloadViewer(), import('./cakeModels')]).then(([, m]) => {
      const out: Record<string, string> = {}
      for (const [k, b64] of Object.entries(m.MODELS)) {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
        out[k] = URL.createObjectURL(new Blob([bin], { type: 'model/gltf-binary' }))
      }
      setUrls(out); setLib(true)
    })
  }, [])
  const s = cakeScale(weightKg)
  const src = import.meta.env.VITE_EMBED_MODELS === '1' ? urls[p.model_3d![format]] : p.model_3d![format]
  const size = format === 'redondo' ? `${Math.round(20 * s)} cm de diâmetro` : `${Math.round(18 * s)} × ${Math.round(14 * s)} cm`

  useEffect(() => {
    const mv = ref.current; if (!mv || !lib) return
    const onLoad = () => {
      const look = p.look!
      const set = (name: string, hex: string) => mv.model?.materials.find((m: any) => m.name === name)?.pbrMetallicRoughness.setBaseColorFactor(hex)
      set('massa', look.massa); set('recheio', look.recheio); set('cobertura', look.cobertura); set('decoracao', TOPPING[look.topping])
      setReady(true); setArOk(!!mv.canActivateAR)
    }
    // Na RA o bolo fica parado onde foi colocado: sem giro automático e sem mudar de tamanho (ar-scale fixed).
    const onStatus = (e: any) => {
      const st = e.detail.status
      if (st === 'session-started') { mv.autoRotate = false; mv.resetTurntableRotation?.(0); setArState('tracking') }
      else if (st === 'object-placed') setArState('placed')
      else if (st === 'failed') setArState('failed')
      else if (st === 'not-presenting') { mv.autoRotate = true; setArState((x) => (x === 'failed' ? x : 'off')) }
    }
    mv.addEventListener('load', onLoad); mv.addEventListener('ar-status', onStatus)
    return () => { mv.removeEventListener('load', onLoad); mv.removeEventListener('ar-status', onStatus) }
  }, [lib, src])

  return (
    <div className="ar-wrap" role="dialog" aria-modal="true" aria-label={`${p.name} em 3D`} onClick={(e) => e.stopPropagation()}>
      <div className="ar-top">
        <button className="icon-btn" onClick={onClose} aria-label="Voltar"><Icon name="back" /></button>
        <div><strong>{p.name}</strong><small>{format === 'redondo' ? 'Redondo' : 'Quadrado'} · {kg(Math.round(weightKg * 100) / 100)} · {size}</small></div>
      </div>
      {lib && (
        <model-viewer ref={ref} src={src} alt={`Bolo ${p.name} em 3D`} camera-controls touch-action="pan-y" auto-rotate auto-rotate-delay="800"
          shadow-intensity="1.1" shadow-softness="0.8" exposure="1.05" environment-image="neutral" camera-orbit="50deg 64deg auto"
          scale={`${s} 1 ${s}`} ar ar-modes={AR_MODES} ar-scale="fixed" ar-placement="floor" xr-environment interaction-prompt="none" loading="eager" class="mv">
          <button slot="ar-button" className="btn primary ar-go"><Icon name="cube" /> Colocar na minha mesa</button>
          <div slot="ar-prompt" className="ar-prompt">Aponte para a mesa e mova o celular devagar até o bolo aparecer</div>
        </model-viewer>
      )}
      {!ready && <div className="ar-loading">Carregando o bolo em 3D…</div>}
      <div className="ar-tip">
        {arState === 'failed' ? <p>Não deu para abrir a câmera neste aparelho. Você ainda pode girar o bolo em 3D aqui.</p>
        : arState === 'placed' ? <p>Pronto! O bolo fica parado nesse lugar. Para mudar de lugar, arraste o bolo com um dedo.</p>
        : arOk === false
          ? <p>Arraste para girar e use dois dedos para aproximar. No celular, o botão <strong>Colocar na minha mesa</strong> mostra o bolo em tamanho real pela câmera.</p>
          : <p>Toque em <strong>Colocar na minha mesa</strong> e aponte a câmera para a mesa. O bolo aparece em tamanho real.</p>}
      </div>
    </div>
  )
}
