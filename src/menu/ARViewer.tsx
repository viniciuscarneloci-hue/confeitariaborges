import { useEffect, useRef, useState } from 'react'
import type { Product, CakeFormat } from '../data/types'
import { kg } from '../lib/format'
import { Icon } from '../ui/Icon'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX { interface IntrinsicElements { 'model-viewer': any } }
}

const TOPPING: Record<string, string> = { morango: '#D7263D', frutas: '#B0223A', pistache: '#7FA34A', coco: '#FFFFFF', chocolate: '#4A2A1C', brigadeiro: '#4A2A1C', nozes: '#9B6B3E', ovomaltine: '#8A5A2B', limao: '#C9DB4E', maracuja: '#F2B632', abacaxi: '#F0C43A', ameixa: '#3B1E2E', nenhum: '#F3DFA9' }

/** Tamanho do bolo: 1 kg redondo ≈ 20 cm; 1 kg quadrado ≈ 18 × 14 cm. Cresce em área, altura fixa. */
export function cakeScale(weightKg: number) { return Math.sqrt(weightKg) }

export function ARViewer({ product: p, format, weightKg, onClose }: { product: Product; format: CakeFormat; weightKg: number; onClose: () => void }) {
  const ref = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [lib, setLib] = useState(false)
  const [arOk, setArOk] = useState<boolean | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    // Na Vercel os .glb são servidos de /models (necessário para a RA nativa do Android/iPhone).
    // No preview do Claude (que não serve .glb) os modelos vão embutidos: build com VITE_EMBED_MODELS=1.
    if (import.meta.env.VITE_EMBED_MODELS !== '1') { import('@google/model-viewer').then(() => setLib(true)); return }
    Promise.all([import('@google/model-viewer'), import('./cakeModels')]).then(([, m]) => {
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
    mv.addEventListener('load', onLoad)
    return () => mv.removeEventListener('load', onLoad)
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
          scale={`${s} 1 ${s}`} ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" ar-placement="floor" interaction-prompt="none" class="mv">
          <button slot="ar-button" className="btn primary ar-go"><Icon name="cube" /> Colocar na minha mesa</button>
        </model-viewer>
      )}
      {!ready && <div className="ar-loading">Carregando o bolo em 3D…</div>}
      <div className="ar-tip">
        {arOk === false
          ? <p>Arraste para girar e use dois dedos para aproximar. No celular, o botão <strong>Colocar na minha mesa</strong> mostra o bolo em tamanho real pela câmera.</p>
          : <p>Toque em <strong>Colocar na minha mesa</strong> e aponte a câmera para a mesa. O bolo aparece em tamanho real.</p>}
      </div>
    </div>
  )
}
