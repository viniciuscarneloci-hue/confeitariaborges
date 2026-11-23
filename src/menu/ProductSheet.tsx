import { useEffect, useState } from 'react'
import type { Product, ReadyItem, Store, CakeFormat } from '../data/types'
import { readyPrice } from '../data/mock'
import type { OpenState } from '../lib/time'
import { money, kg, grams } from '../lib/format'
import { cart } from '../lib/cart'
import { ProductArt } from '../ui/CakeArt'
import { Icon } from '../ui/Icon'
import { ARViewer, preloadViewer } from './ARViewer'

export function ProductSheet({ product: p, ready, readyAll, tab, onClose, onAdded }: {
  product: Product; tab: 'encomenda' | 'pronta'; ready?: ReadyItem; readyAll: ReadyItem[]; store: Store; openState: OpenState; onClose: () => void; onAdded: () => void
}) {
  const units = readyAll.filter((r) => r.product_id === p.id && r.status === 'disponivel')
  const [mode, setMode] = useState<'encomenda' | 'agora'>(ready ? 'agora' : 'encomenda')
  const [format, setFormat] = useState<CakeFormat>(ready?.format ?? p.default_format ?? 'quadrado')
  const [weight, setWeight] = useState(1)
  const [pick, setPick] = useState<string | undefined>(ready?.id ?? units[0]?.id)
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [ar, setAr] = useState(false)
  const isCake = p.pricing === 'kg'
  useEffect(() => { if (p.model_3d) preloadViewer() }, [])
  const fr = p.formats?.find((f) => f.format === format)
  useEffect(() => { if (fr && weight > fr.max_kg) setWeight(fr.max_kg) }, [format])
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && (ar ? setAr(false) : onClose()); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [ar])
  const chosen = units.find((u) => u.id === pick)
  const serves = Math.round(weight * (p.serves_per_kg ?? 10))

  const price = !isCake ? p.price * qty : mode === 'agora' ? (chosen ? readyPrice(chosen) : 0) : Math.round(p.price * weight * 100) / 100
  const canAdd = !isCake || mode === 'encomenda' || !!chosen

  function add() {
    if (!isCake) cart.add({ product_id: p.id, mode: tab === 'pronta' ? 'agora' : 'encomenda', qty, unit_price: p.price, notes: notes || undefined })
    else if (mode === 'agora' && chosen) cart.add({ product_id: p.id, mode: 'agora', qty: 1, format: chosen.format, ready_item_id: chosen.id, ready_weight_g: chosen.weight_g, unit_price: readyPrice(chosen), notes: notes || undefined })
    else cart.add({ product_id: p.id, mode: 'encomenda', qty: 1, format, weight_kg: weight, unit_price: Math.round(p.price * weight * 100) / 100, notes: notes || undefined })
    onAdded()
  }
  const arFormat = mode === 'agora' && chosen ? chosen.format : format
  const arWeight = mode === 'agora' && chosen ? chosen.weight_g / 1000 : weight

  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet product" role="dialog" aria-modal="true" aria-label={p.name} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn close-float" onClick={onClose} aria-label="Fechar"><Icon name="x" /></button>
        <div className="p-grid">
          <div className="p-hero">
            <ProductArt p={p} className="p-art" />
            {p.model_3d && (
              <button className="ar-btn" onClick={() => setAr(true)}>
                <Icon name="cube" size={20} />
                <span><strong>Ver na mesa</strong><small>em 3D e tamanho real</small></span>
              </button>
            )}
          </div>
          <div className="p-body">
            <h2 className="p-name">{p.name}</h2>
            <p className="p-price">{money(p.price)}{isCake && <small>/kg</small>}</p>
            <p className="p-desc">{p.description}</p>

            {isCake && units.length > 0 && (
              <div className="mode" role="radiogroup" aria-label="Como você quer">
                <button role="radio" aria-checked={mode === 'agora'} className={mode === 'agora' ? 'on' : ''} onClick={() => setMode('agora')}>
                  <strong>Quero agora</strong><small>{units.length} na vitrine</small>
                </button>
                <button role="radio" aria-checked={mode === 'encomenda'} className={mode === 'encomenda' ? 'on' : ''} onClick={() => setMode('encomenda')}>
                  <strong>Encomendar</strong><small>do seu jeito, com data</small>
                </button>
              </div>
            )}

            {isCake && mode === 'encomenda' && (
              <>
                <fieldset className="field">
                  <legend>Formato</legend>
                  <div className="formats">
                    {p.formats!.map((f) => (
                      <label key={f.format} className={'fmt ' + (format === f.format ? 'on' : '')}>
                        <input type="radio" name="fmt" id={'fmt-' + f.format} checked={format === f.format} onChange={() => setFormat(f.format)} />
                        <span className={'shape ' + f.format} aria-hidden="true" />
                        <span><strong>{f.format === 'quadrado' ? 'Quadrado' : 'Redondo'}</strong><small>{f.min_kg} a {f.max_kg} kg</small></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="field">
                  <legend>Peso</legend>
                  <div className="weight">
                    <button className="step" onClick={() => setWeight((w) => Math.max(fr!.min_kg, w - 0.5))} disabled={weight <= fr!.min_kg} aria-label="Diminuir peso"><Icon name="minus" /></button>
                    <output className="w-val">{kg(weight)}</output>
                    <button className="step" onClick={() => setWeight((w) => Math.min(fr!.max_kg, w + 0.5))} disabled={weight >= fr!.max_kg} aria-label="Aumentar peso"><Icon name="plus" /></button>
                  </div>
                  <input id="peso" className="range" type="range" min={fr!.min_kg} max={fr!.max_kg} step={0.5} value={weight} onChange={(e) => setWeight(+e.target.value)} aria-label="Peso em kg" />
                  <div className="serves-meter" aria-label={`Serve ${serves} pessoas`}>
                    <div className="dots" aria-hidden="true">{Array.from({ length: Math.min(serves, 100) }, (_, i) => <i key={i} />)}</div>
                    <p><strong>Serve {serves} pessoas</strong> <span>(fatias de 100 g)</span></p>
                  </div>
                </fieldset>
              </>
            )}

            {isCake && mode === 'agora' && (
              <fieldset className="field">
                <legend>Escolha o bolo da vitrine</legend>
                <p className="field-hint">Cada bolo tem peso real. O preço já está calculado.</p>
                <div className="units">
                  {units.map((u) => (
                    <label key={u.id} className={'unit ' + (pick === u.id ? 'on' : '')}>
                      <input type="radio" name="unit" id={'u-' + u.id} checked={pick === u.id} onChange={() => setPick(u.id)} />
                      <span className={'shape sm ' + u.format} aria-hidden="true" />
                      <span className="u-main"><strong>{grams(u.weight_g)}</strong><small>{u.format} · serve {Math.round(u.weight_g / 100)}</small></span>
                      <span className="u-price">{money(readyPrice(u))}{u.discount_pct > 0 && <em className="off">−{Math.round(u.discount_pct * 100)}%</em>}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {!isCake && (
              <div className="field">
                <div className="weight">
                  <button className="step" onClick={() => setQty((x) => Math.max(1, x - 1))} disabled={qty <= 1} aria-label="Menos"><Icon name="minus" /></button>
                  <output className="w-val">{qty}</output>
                  <button className="step" onClick={() => setQty((x) => x + 1)} aria-label="Mais"><Icon name="plus" /></button>
                </div>
              </div>
            )}

            {showNotes ? (
              <label className="field notes">
                <span className="legend">Anotações</span>
                <textarea id="notas" rows={3} autoFocus value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isCake ? 'Ex.: escrever “Feliz aniversário, Ana” · sem nozes' : 'Ex.: sabor guaraná'} />
              </label>
            ) : (
              <button className="link-btn" onClick={() => setShowNotes(true)}><Icon name="edit" size={16} /> Adicionar anotação</button>
            )}
          </div>
        </div>
        <div className="p-foot">
          <button className="btn primary block" disabled={!canAdd} onClick={add}>
            <span>Adicionar ao pedido</span><span className="btn-price">{money(price)}</span>
          </button>
        </div>
      </div>
      {ar && p.look && <ARViewer product={p} format={arFormat} weightKg={arWeight} onClose={() => setAr(false)} />}
    </div>
  )
}
