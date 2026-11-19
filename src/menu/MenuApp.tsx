import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, PRODUCTS, productById } from '../data/catalog'
import { STORES, storeById, PILOT_STORE } from '../data/stores'
import { readyItems, readyPrice } from '../data/mock'
import type { Product, ReadyItem, CategoryId } from '../data/types'
import { money, grams } from '../lib/format'
import { storeOpenState, hoursSummary } from '../lib/time'
import { useCart, lineTotal } from '../lib/cart'
import { load, save } from '../lib/storage'
import { ProductArt } from '../ui/CakeArt'
import { ProductSheet } from './ProductSheet'
import { CartSheet } from './CartSheet'
import { Icon } from '../ui/Icon'
import { Brand } from '../ui/Brand'

type Tab = 'encomenda' | 'pronta'

export function MenuApp() {
  const [storeId, setStoreId] = useState(() => load('store', PILOT_STORE))
  const store = storeById(storeId)
  const state = storeOpenState(store)
  const [tab, setTab] = useState<Tab>(() => (state.open ? 'pronta' : 'encomenda'))
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<{ p: Product; ready?: ReadyItem } | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [storePicker, setStorePicker] = useState(false)
  const [activeCat, setActiveCat] = useState<CategoryId>('bolos-brancos')
  const lines = useCart()
  const ready = useMemo(() => readyItems(store.id), [store.id])
  useEffect(() => save('store', storeId), [storeId])

  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const match = (p: Product) => !q || norm(p.name + ' ' + p.description).includes(norm(q))

  type Row = { p: Product; ready?: ReadyItem }
  const sections = CATEGORIES.map((c) => {
    let rows: Row[]
    if (tab === 'pronta') {
      const cakes = ready.filter((r) => productById(r.product_id).category_id === c.id).map((r) => ({ p: productById(r.product_id), ready: r }))
      const units = PRODUCTS.filter((p) => p.category_id === c.id && p.pricing === 'unidade' && p.channels.includes('pronta')).map((p) => ({ p }))
      rows = [...cakes, ...units]
    } else rows = PRODUCTS.filter((p) => p.category_id === c.id && p.channels.includes('encomenda')).map((p) => ({ p }))
    return { c, rows: rows.filter((r) => match(r.p)) }
  }).filter((s) => s.rows.length)

  // destaca a categoria visível
  const secRefs = useRef<Record<string, HTMLElement | null>>({})
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (vis) setActiveCat(vis.target.id.replace('cat-', '') as CategoryId)
    }, { rootMargin: '-140px 0px -60% 0px' })
    Object.values(secRefs.current).forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [tab, q, store.id])
  const chipsRef = useRef<HTMLDivElement>(null)
  useEffect(() => { chipsRef.current?.querySelector(`[data-cat="${activeCat}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }) }, [activeCat])

  const count = lines.reduce((s, l) => s + l.qty, 0)
  const total = lines.reduce((s, l) => s + lineTotal(l), 0)
  const readyCount = ready.filter((r) => r.status === 'disponivel').length

  return (
    <div className="menu">
      <header className="m-head">
        <div className="m-head-in">
          <Brand sub="Cardápio" />
          <button className="store-btn" onClick={() => setStorePicker(true)} aria-label={`Loja ${store.name}. Trocar loja`}>
            <span className={'dot ' + (state.open ? 'on' : 'off')} />
            <span className="store-name">{store.name}</span>
            <Icon name="chevron" />
          </button>
        </div>
      </header>

      {!state.open && (
        <div className="closed-strip" role="status">
          <div className="wrap closed-in">
            <strong>Fechado agora.</strong> Abrimos {state.reopens}. <span className="closed-ok">Encomendas abertas normalmente.</span>
          </div>
        </div>
      )}

      <div className="m-intro wrap">
        <label className="search">
          <Icon name="search" />
          <input id="busca" type="search" placeholder="Buscar sabor, ex.: pistache" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="seg" role="tablist" aria-label="Tipo de pedido">
          <button role="tab" aria-selected={tab === 'pronta'} className={tab === 'pronta' ? 'on' : ''} onClick={() => setTab('pronta')}>
            <span className="seg-t">Pronta entrega</span>
            <span className="seg-s">{readyCount} bolos na vitrine hoje</span>
          </button>
          <button role="tab" aria-selected={tab === 'encomenda'} className={tab === 'encomenda' ? 'on' : ''} onClick={() => setTab('encomenda')}>
            <span className="seg-t">Encomendas</span>
            <span className="seg-s">Escolha formato e peso</span>
          </button>
        </div>
        {tab === 'pronta' && !state.open && <p className="hint">A vitrine abre {state.reopens}. Você pode reservar agora e retirar quando abrirmos.</p>}
      </div>

      <nav className="chips" ref={chipsRef} aria-label="Categorias">
        <div className="chips-in">
          {sections.map(({ c }) => (
            <button key={c.id} data-cat={c.id} className={activeCat === c.id ? 'chip on' : 'chip'}
              onClick={(e) => { e.preventDefault(); const el = secRefs.current[c.id]; if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 118, behavior: "smooth" }) }}>{c.name}</button>
          ))}
        </div>
      </nav>

      <main className="wrap list">
        {sections.length === 0 && <p className="empty">Nada encontrado para “{q}”. Tente outro sabor.</p>}
        {sections.map(({ c, rows }) => (
          <section key={c.id} id={'cat-' + c.id} ref={(el) => { secRefs.current[c.id] = el }} className="cat">
            <h2>{c.name}</h2>
            <div className="grid">
              {rows.map(({ p, ready: r }) => (
                <button key={r?.id ?? p.id} className="item" onClick={() => setOpen({ p, ready: r })}>
                  <div className="item-txt">
                    <h3>{p.name}</h3>
                    {r && <span className="unit-tag">1 un · {grams(r.weight_g)} · {r.format}</span>}
                    <p className="desc">{p.description}</p>
                    {p.pricing === 'kg' && !r && <p className="serves">1 kg serve {p.serves_per_kg} pessoas</p>}
                    <p className="price">
                      {r ? (<>
                        <span>{money(readyPrice(r))}</span>
                        {r.discount_pct > 0 && <><s>{money(readyPrice({ ...r, discount_pct: 0 }))}</s><em className="off">−{Math.round(r.discount_pct * 100)}%</em></>}
                      </>) : (<span>{money(p.price)}{p.pricing === 'kg' && <small>/kg</small>}</span>)}
                    </p>
                  </div>
                  <div className="item-art">
                    <ProductArt p={p} />
                    {p.model_3d && <span className="ar-badge" title="Disponível em 3D"><Icon name="cube" />3D</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
        <footer className="m-foot">
          <div>
            <h4>{store.name}</h4>
            <p>{store.city}</p>
            <ul className="hours">{hoursSummary(store).map((h) => <li key={h.day}><span>{h.day}</span><span>{h.text}</span></li>)}</ul>
          </div>
          <p className="fine">Pedidos sem cadastro: você finaliza pelo WhatsApp da loja.</p>
        </footer>
      </main>

      {count > 0 && !cartOpen && (
        <div className="cartbar">
          <button className="cartbar-btn" onClick={() => setCartOpen(true)}>
            <span className="cb-count">{count}</span>
            <span>Ver pedido</span>
            <span className="cb-total">{money(total)}</span>
          </button>
        </div>
      )}

      {open && <ProductSheet tab={tab} product={open.p} ready={open.ready} readyAll={ready} store={store} openState={state} onClose={() => setOpen(null)} onAdded={() => setOpen(null)} />}
      {cartOpen && <CartSheet store={store} openState={state} onClose={() => setCartOpen(false)} />}
      {storePicker && (
        <div className="sheet-wrap" onClick={() => setStorePicker(false)}>
          <div className="sheet small" role="dialog" aria-label="Escolher loja" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><h3>Escolha a loja</h3><button className="icon-btn" onClick={() => setStorePicker(false)} aria-label="Fechar"><Icon name="x" /></button></div>
            <ul className="store-list">
              {STORES.map((s) => { const st = storeOpenState(s); return (
                <li key={s.id}><button className={s.id === store.id ? 'on' : ''} onClick={() => { setStoreId(s.id); setStorePicker(false) }}>
                  <span><strong>{s.name}</strong><small>{s.city}</small></span>
                  <span className={'pill ' + (st.open ? 'ok' : 'muted')}>{st.open ? `Aberta até ${st.closesAt}` : `Abre ${st.reopensShort}`}</span>
                </button></li>) })}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
