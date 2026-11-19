import { useMemo, useState } from 'react'
import type { Store, Order } from '../data/types'
import { productById } from '../data/catalog'
import { money, kg, grams } from '../lib/format'
import { addDays, longDay, spNow, weekdayOf, type OpenState } from '../lib/time'
import { cart, useCart, lineTotal, whatsappMessage, newOrderCode, recordDemoOrder, type CheckoutInfo } from '../lib/cart'
import { ProductArt } from '../ui/CakeArt'
import { Icon } from '../ui/Icon'

export function CartSheet({ store, openState, onClose }: { store: Store; openState: OpenState; onClose: () => void }) {
  const lines = useCart()
  const hasEnc = lines.some((l) => l.mode === 'encomenda')
  const hasNow = lines.some((l) => l.mode === 'agora')
  const today = spNow().date
  const dates = useMemo(() => Array.from({ length: 10 }, (_, i) => addDays(today, i + 1)).filter((d) => store.hours[weekdayOf(d)]).slice(0, 6), [store.id])
  const [info, setInfo] = useState<CheckoutInfo>({ date: dates[0], period: 'tarde', fulfillment: 'retirada' })
  const [sent, setSent] = useState<{ code: string; text: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const total = lines.reduce((s, l) => s + lineTotal(l), 0)
  const readyNote = openState.open ? 'retirada hoje' : `retirada quando abrirmos, ${openState.reopens}`

  const code = useMemo(() => newOrderCode(store), [store.id, sent])
  const msg = whatsappMessage(store, lines, hasEnc ? info : { fulfillment: info.fulfillment }, code, readyNote)
  const url = `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(msg.text)}`

  function onSend() {
    const order: Order = {
      id: 'demo-' + code, code, store_id: store.id, created_at: new Date().toISOString(), channel: 'cardapio_whatsapp',
      mode: hasEnc ? 'encomenda' : 'agora', fulfillment: info.fulfillment, scheduled_for: hasEnc ? info.date : undefined, scheduled_period: hasEnc ? info.period : undefined,
      total: msg.total, status: 'aguardando_pagamento',
      items: lines.map((l) => ({ product_id: l.product_id, name: productById(l.product_id).name, qty: l.qty, format: l.format, weight_kg: l.weight_kg ?? (l.ready_weight_g ? l.ready_weight_g / 1000 : undefined), ready_item_id: l.ready_item_id, unit_price: l.unit_price, total: lineTotal(l), notes: l.notes })),
    }
    recordDemoOrder(order)
    setSent({ code, text: msg.text, url })
    cart.clear()
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true) } catch { setCopied(false) }
  }

  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet cart" role="dialog" aria-modal="true" aria-label="Seu pedido" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h3>{sent ? 'Pedido enviado' : 'Seu pedido'}</h3><button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="x" /></button></div>

        {sent ? (
          <div className="sent">
            <div className="sent-badge"><Icon name="check" size={28} /></div>
            <p className="sent-code">Pedido <strong>{sent.code}</strong></p>
            <p>Abrimos o WhatsApp da loja {store.name} com o pedido pronto. É só tocar em enviar e dizer seu nome.</p>
            <p className="field-hint">O WhatsApp não abriu? Use o botão abaixo ou copie a mensagem.</p>
            <div className="sent-actions">
              <a className="btn wa" href={sent.url} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" /> Abrir WhatsApp de novo</a>
              <button className="btn ghost" onClick={() => copy(sent.text)}><Icon name="copy" /> {copied ? 'Mensagem copiada' : 'Copiar mensagem'}</button>
            </div>
            <pre className="msg-preview">{sent.text}</pre>
          </div>
        ) : lines.length === 0 ? (
          <p className="empty">Seu pedido está vazio. Escolha um bolo no cardápio.</p>
        ) : (
          <>
            <ul className="lines">
              {lines.map((l) => { const p = productById(l.product_id); return (
                <li key={l.key}>
                  <ProductArt p={p} className="l-art" />
                  <div className="l-main">
                    <strong>{p.name}</strong>
                    <small>
                      {l.mode === 'agora' ? 'Pronta entrega' : 'Encomenda'}
                      {l.format && ` · ${l.format}`}{l.weight_kg && ` · ${kg(l.weight_kg)} · serve ${Math.round(l.weight_kg * 10)}`}{l.ready_weight_g && ` · ${grams(l.ready_weight_g)}`}
                    </small>
                    {l.notes && <small className="l-note">“{l.notes}”</small>}
                  </div>
                  <div className="l-side">
                    <span className="l-price">{money(lineTotal(l))}</span>
                    <div className="mini-step">
                      <button onClick={() => cart.setQty(l.key, l.qty - 1)} aria-label={l.qty === 1 ? 'Remover' : 'Menos'}>{l.qty === 1 ? <Icon name="x" size={14} /> : <Icon name="minus" size={14} />}</button>
                      <span>{l.qty}</span>
                      <button onClick={() => cart.setQty(l.key, l.qty + 1)} disabled={!!l.ready_item_id} aria-label="Mais"><Icon name="plus" size={14} /></button>
                    </div>
                  </div>
                </li>) })}
            </ul>

            {hasEnc && (
              <fieldset className="field">
                <legend>Para quando é a encomenda?</legend>
                <div className="date-chips">
                  {dates.map((d) => <button key={d} className={info.date === d ? 'on' : ''} onClick={() => setInfo({ ...info, date: d })}>{longDay(d)}</button>)}
                </div>
                <div className="seg mini">
                  <button className={info.period === 'manha' ? 'on' : ''} onClick={() => setInfo({ ...info, period: 'manha' })}>Manhã</button>
                  <button className={info.period === 'tarde' ? 'on' : ''} onClick={() => setInfo({ ...info, period: 'tarde' })}>Tarde</button>
                </div>
              </fieldset>
            )}
            {hasNow && <p className="field-hint now-note">Itens da vitrine: {readyNote}.</p>}

            <fieldset className="field">
              <legend>Como você quer receber?</legend>
              <div className="formats">
                <label className={'fmt ' + (info.fulfillment === 'retirada' ? 'on' : '')}>
                  <input type="radio" name="ful" id="ful-retirada" checked={info.fulfillment === 'retirada'} onChange={() => setInfo({ ...info, fulfillment: 'retirada' })} />
                  <Icon name="store" /><span><strong>Retirar na loja</strong><small>{store.name}</small></span>
                </label>
                <label className={'fmt ' + (info.fulfillment === 'entrega' ? 'on' : '')}>
                  <input type="radio" name="ful" id="ful-entrega" checked={info.fulfillment === 'entrega'} onChange={() => setInfo({ ...info, fulfillment: 'entrega' })} />
                  <Icon name="truck" /><span><strong>Entrega</strong><small>endereço no WhatsApp</small></span>
                </label>
              </div>
            </fieldset>

            <div className="cart-foot">
              <div className="total-row"><span>Total</span><strong>{money(total)}</strong></div>
              <a className="btn wa block" href={url} target="_blank" rel="noopener noreferrer" onClick={onSend}>
                <Icon name="whatsapp" size={20} /> Enviar pedido no WhatsApp
              </a>
              <p className="fine">Sem cadastro. Você confirma nome, entrega e pagamento com a loja na conversa.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
