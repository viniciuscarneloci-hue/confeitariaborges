import { useEffect, useMemo, useRef, useState } from 'react'
import { db, useAsset, useDB } from '../data/db'
import type { Dish, DishTag, Restaurant } from '../data/types'
import { brl, norm } from '../lib/format'
import { Icon } from '../ui/Icon'
import { DishViewer, loadViewer, type ArState } from '../ui/DishViewer'

export const TAG_LABEL: Record<DishTag, string> = { vegetariano: 'Vegetariano', vegano: 'Vegano', 'sem-gluten': 'Sem glúten', picante: 'Picante', 'mais-pedido': 'Mais pedido', novo: 'Novo' }

type Cart = Record<string, number>
const cartKey = (r: string) => `oak-cart-${r}`
function useCart(rid: string) {
  const [cart, setCart] = useState<Cart>(() => { try { return JSON.parse(sessionStorage.getItem(cartKey(rid)) || '{}') } catch { return {} } })
  useEffect(() => { try { sessionStorage.setItem(cartKey(rid), JSON.stringify(cart)) } catch { /* ignore */ } }, [cart, rid])
  const add = (id: string, n = 1) => setCart((c) => { const q = Math.max(0, (c[id] ?? 0) + n); const o = { ...c, [id]: q }; if (!q) delete o[id]; return o })
  return { cart, add, clear: () => setCart({}) }
}

export function MenuApp({ slug, table }: { slug: string; table?: string }) {
  const data = useDB()
  const r = data.restaurants.find((x) => x.slug === slug)
  if (!r) return <div className="empty-page"><h1>Cardápio não encontrado</h1><p>Confira o link ou o QR code da mesa.</p><a className="btn" href="#/">Voltar</a></div>
  return <Menu r={r} table={table} />
}

function Menu({ r, table }: { r: Restaurant; table?: string }) {
  const data = useDB()
  const cats = data.categories.filter((c) => c.restaurant_id === r.id).sort((a, b) => a.sort - b.sort)
  const dishes = data.dishes.filter((d) => d.restaurant_id === r.id && d.available)
  const [q, setQ] = useState('')
  const [only3d, setOnly3d] = useState(false)
  const [open, setOpen] = useState<Dish | null>(null)
  const [showCart, setShowCart] = useState(false)
  const [activeCat, setActiveCat] = useState(cats[0]?.id)
  const { cart, add, clear } = useCart(r.id)
  const with3d = dishes.filter((d) => d.model).length

  useEffect(() => { document.title = `${r.name} · Cardápio`; db.track({ restaurant_id: r.id, type: 'menu_aberto' }) }, [r.id])
  // pré-carrega o visualizador 3D depois que o cardápio aparece, para o prato abrir na hora
  useEffect(() => { const t = setTimeout(loadViewer, 1200); return () => clearTimeout(t) }, [])

  const filtered = useMemo(() => dishes.filter((d) => (!only3d || d.model) && (!q || norm(d.name + ' ' + d.description).includes(norm(q)))), [dishes, q, only3d])
  const count = Object.values(cart).reduce((a, b) => a + b, 0)
  const total = Object.entries(cart).reduce((s, [id, n]) => s + (dishes.find((d) => d.id === id)?.price ?? 0) * n, 0)

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  useEffect(() => {
    const io = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActiveCat(v.target.id.replace('cat-', '')) }, { rootMargin: '-120px 0px -60% 0px' })
    Object.values(sectionRefs.current).forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [filtered.length])

  const openDish = (d: Dish) => { setOpen(d); db.track({ restaurant_id: r.id, dish_id: d.id, type: 'prato_aberto' }) }

  return (
    <div className="menu" style={{ ['--accent' as any]: r.accent }}>
      <header className="menu-hero">
        <div className="menu-hero-inner">
          <div className="logo-badge">{r.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
          <div>
            <h1>{r.name}</h1>
            <p>{r.tagline}</p>
            {table && <span className="table-pill">Mesa {table}</span>}
          </div>
        </div>
      </header>

      <div className="menu-sticky">
        <label className="search">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" />
          {q && <button onClick={() => setQ('')} aria-label="Limpar busca"><Icon name="close" size={16} /></button>}
        </label>
        <nav className="chips" aria-label="Categorias">
          {with3d > 0 && <button className={`chip chip-3d ${only3d ? 'on' : ''}`} onClick={() => setOnly3d((x) => !x)}><Icon name="cube" size={15} /> Ver em 3D</button>}
          {cats.map((c) => (
            <button key={c.id} className={`chip ${activeCat === c.id ? 'on' : ''}`} onClick={() => sectionRefs.current[c.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{c.name}</button>
          ))}
        </nav>
      </div>

      {with3d > 0 && !q && !only3d && (
        <div className="ar-callout">
          <Icon name="sparkle" size={22} />
          <div><strong>Veja o prato na sua mesa antes de pedir</strong><span>Toque em um prato com o selo 3D e depois em “Ver na minha mesa”. Ele aparece em tamanho real pela câmera.</span></div>
        </div>
      )}

      <main className="menu-list">
        {cats.map((c) => {
          const list = filtered.filter((d) => d.category_id === c.id).sort((a, b) => a.sort - b.sort)
          if (!list.length) return null
          return (
            <section key={c.id} id={`cat-${c.id}`} ref={(el) => { sectionRefs.current[c.id] = el }}>
              <h2>{c.name}</h2>
              <div className="dish-grid">
                {list.map((d) => <DishCard key={d.id} d={d} qty={cart[d.id] ?? 0} onOpen={() => openDish(d)} />)}
              </div>
            </section>
          )
        })}
        {!filtered.length && <p className="muted center pad">Nenhum prato encontrado.</p>}
      </main>

      <footer className="menu-foot">Cardápio em realidade aumentada · <strong>Oak AR</strong></footer>

      {count > 0 && (
        <button className="cart-bar" onClick={() => setShowCart(true)}>
          <span className="cart-count">{count}</span> Ver meu pedido <strong>{brl(total)}</strong>
        </button>
      )}
      {open && <DishSheet r={r} d={open} qty={cart[open.id] ?? 0} onAdd={(n) => { add(open.id, n); if (n > 0) db.track({ restaurant_id: r.id, dish_id: open.id, type: 'adicionou' }) }} onClose={() => setOpen(null)} />}
      {showCart && <CartSheet r={r} table={table} cart={cart} dishes={dishes} add={add} clear={clear} onClose={() => setShowCart(false)} />}
    </div>
  )
}

export function DishThumb({ d, big }: { d: Dish; big?: boolean }) {
  const poster = useAsset(d.model?.poster)
  if (poster) return <img className={`thumb ${big ? 'big' : ''}`} src={poster} alt="" loading="lazy" />
  return <div className={`thumb thumb-ph ${big ? 'big' : ''}`} aria-hidden="true"><span>{d.name.slice(0, 1)}</span></div>
}

function DishCard({ d, qty, onOpen }: { d: Dish; qty: number; onOpen: () => void }) {
  return (
    <button className="dish-card" onClick={onOpen}>
      <div className="dish-card-media">
        <DishThumb d={d} />
        {d.model && <span className="badge-3d"><Icon name="cube" size={13} /> 3D</span>}
        {qty > 0 && <span className="qty-dot">{qty}</span>}
      </div>
      <div className="dish-card-body">
        <h3>{d.name}</h3>
        <p>{d.description}</p>
        <div className="dish-card-foot">
          <strong>{brl(d.price)}</strong>
          {d.tags.slice(0, 2).map((t) => <span key={t} className={`tag tag-${t}`}>{TAG_LABEL[t]}</span>)}
        </div>
      </div>
    </button>
  )
}

function DishSheet({ r, d, qty, onAdd, onClose }: { r: Restaurant; d: Dish; qty: number; onAdd: (n: number) => void; onClose: () => void }) {
  const mvRef = useRef<any>(null)
  const [ar, setAr] = useState<ArState>('off')
  const [canAr, setCanAr] = useState<boolean | null>(null)
  const [hint, setHint] = useState(false)
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [])
  const m = d.model
  const goAr = () => {
    const mv = mvRef.current
    if (mv?.canActivateAR) mv.activateAR()
    else setHint(true)
  }
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={d.name} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn sheet-close" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
        {m ? (
          <div className="sheet-viewer">
            <DishViewer model={m} alt={`${d.name} em 3D`}
              onLoad={(mv) => { mvRef.current = mv; setCanAr(!!mv.canActivateAR); db.track({ restaurant_id: r.id, dish_id: d.id, type: 'ver_3d' }) }}
              onArStatus={(s) => { setAr(s); if (s === 'tracking') db.track({ restaurant_id: r.id, dish_id: d.id, type: 'ver_ra' }) }}>
              <button slot="ar-button" style={{ display: 'none' }} />
              <div slot="ar-prompt" className="ar-prompt">Aponte para a mesa e mova o celular devagar</div>
              {ar !== 'off' && <div className="ar-status">{ar === 'placed' ? 'Pronto! Arraste com um dedo para mudar de lugar.' : ar === 'failed' ? 'Não deu para abrir a câmera neste aparelho.' : 'Procurando a mesa…'}</div>}
            </DishViewer>
            <span className="viewer-hint"><Icon name="rotate" size={14} /> Arraste para girar</span>
          </div>
        ) : (
          <div className="sheet-viewer no-model"><DishThumb d={d} big /><span className="viewer-hint">Foto 3D em breve</span></div>
        )}
        <div className="sheet-body">
          <div className="sheet-title">
            <h2>{d.name}</h2>
            <strong>{brl(d.price)}</strong>
          </div>
          <div className="tags">{d.tags.map((t) => <span key={t} className={`tag tag-${t}`}>{TAG_LABEL[t]}</span>)}</div>
          <p className="desc">{d.description}</p>
          <ul className="facts">
            {d.serves && <li>{d.serves}</li>}
            {m && <li><Icon name="ruler" size={14} /> {Math.round(m.size_cm.w)} × {Math.round(m.size_cm.d)} cm · altura {Math.round(m.size_cm.h)} cm</li>}
          </ul>
          {m && (
            <button className="btn primary block ar-btn" onClick={goAr}>
              <Icon name="cube" /> Ver na minha mesa
            </button>
          )}
          {m && (hint || canAr === false) && (
            <p className="note">{hint ? 'Abra este cardápio no celular para ver o prato pela câmera, no tamanho real. Aqui você pode girar o prato em 3D.' : 'No celular, “Ver na minha mesa” mostra o prato pela câmera, em tamanho real.'}</p>
          )}
          <div className="qty-row">
            {qty > 0 ? (
              <div className="stepper">
                <button onClick={() => onAdd(-1)} aria-label="Remover um"><Icon name="minus" /></button>
                <span>{qty}</span>
                <button onClick={() => onAdd(1)} aria-label="Adicionar mais um"><Icon name="plus" /></button>
              </div>
            ) : null}
            <button className="btn dark block" onClick={() => { onAdd(1); if (!qty) onClose() }}>
              {qty ? 'Adicionar mais um' : `Adicionar ao pedido · ${brl(d.price)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CartSheet({ r, table, cart, dishes, add, clear, onClose }: { r: Restaurant; table?: string; cart: Cart; dishes: Dish[]; add: (id: string, n: number) => void; clear: () => void; onClose: () => void }) {
  const [waiter, setWaiter] = useState(false)
  const items = Object.entries(cart).map(([id, n]) => ({ d: dishes.find((x) => x.id === id)!, n })).filter((x) => x.d)
  const total = items.reduce((s, x) => s + x.d.price * x.n, 0)
  const text = `Pedido${table ? ` · Mesa ${table}` : ''}\n` + items.map((x) => `${x.n}× ${x.d.name}`).join('\n') + `\nTotal: ${brl(total)}`
  if (waiter) return (
    <div className="waiter" onClick={() => setWaiter(false)}>
      <small>{r.name}{table ? ` · Mesa ${table}` : ''}</small>
      {items.map((x) => <div key={x.d.id} className="waiter-row"><b>{x.n}×</b> {x.d.name}</div>)}
      <div className="waiter-total">{brl(total)}</div>
      <small>Toque para voltar</small>
    </div>
  )
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet cart" role="dialog" aria-modal="true" aria-label="Meu pedido" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h2>Meu pedido</h2><button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button></div>
        <div className="cart-items">
          {items.map(({ d, n }) => (
            <div key={d.id} className="cart-item">
              <DishThumb d={d} />
              <div><strong>{d.name}</strong><span>{brl(d.price * n)}</span></div>
              <div className="stepper sm">
                <button onClick={() => add(d.id, -1)} aria-label="Remover um"><Icon name="minus" size={16} /></button>
                <span>{n}</span>
                <button onClick={() => add(d.id, 1)} aria-label="Adicionar um"><Icon name="plus" size={16} /></button>
              </div>
            </div>
          ))}
          {!items.length && <p className="muted center pad">Seu pedido está vazio.</p>}
        </div>
        {items.length > 0 && <>
          <div className="cart-total"><span>Total</span><strong>{brl(total)}</strong></div>
          <button className="btn primary block" onClick={() => setWaiter(true)}><Icon name="eye" /> Mostrar ao garçom</button>
          {r.whatsapp && <a className="btn block" href={`https://wa.me/${r.whatsapp}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Enviar pelo WhatsApp</a>}
          <button className="btn ghost block" onClick={clear}>Limpar pedido</button>
        </>}
      </div>
    </div>
  )
}
