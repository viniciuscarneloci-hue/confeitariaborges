import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { db, uid, useDB } from '../data/db'
import type { Capture, Dish, DishTag, Restaurant } from '../data/types'
import { ago, brl } from '../lib/format'
import { Icon } from '../ui/Icon'
import { CaptureWizard, Progress } from '../capture/CaptureWizard'
import { serverConfig, tick } from '../capture/pipeline'
import { DishThumb, TAG_LABEL } from '../menu/MenuApp'

type Tab = 'pratos' | 'capturas' | 'desempenho' | 'restaurante'

const RID_KEY = 'oak-admin-restaurant'

export function AdminApp() {
  const data = useDB()
  const [rid, setRid] = useState(() => { try { return localStorage.getItem(RID_KEY) || data.restaurants[0].id } catch { return data.restaurants[0].id } })
  const r = data.restaurants.find((x) => x.id === rid) ?? data.restaurants[0]
  const [tab, setTab] = useState<Tab>('pratos')
  const [wizard, setWizard] = useState<{ dish: Dish; capture?: string } | null>(null)
  const [editing, setEditing] = useState<Dish | null>(null)
  const [provider, setProvider] = useState<string>('demo')
  useEffect(() => { try { localStorage.setItem(RID_KEY, r.id) } catch { /* ignore */ } document.title = `${r.name} · Painel Oak AR` }, [r.id])
  useEffect(() => { serverConfig().then((c) => setProvider(c.provider)) }, [])
  // avança as capturas em andamento enquanto o painel estiver aberto
  useEffect(() => { const iv = setInterval(tick, 1000); return () => clearInterval(iv) }, [])

  const captures = data.captures.filter((c) => c.restaurant_id === r.id)
  const pending = captures.filter((c) => c.status === 'revisao').length
  const running = captures.filter((c) => ['enviando', 'na-fila', 'processando', 'otimizando'].includes(c.status)).length

  return (
    <div className="admin" style={{ ['--accent' as any]: r.accent }}>
      <aside className="admin-side">
        <a className="brand" href="#/"><span className="brand-mark">◆</span> Oak AR</a>
        <label className="rest-switch">
          <small>Restaurante</small>
          <select value={r.id} onChange={(e) => setRid(e.target.value)}>
            {data.restaurants.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <nav>
          {([['pratos', 'menu', 'Pratos'], ['capturas', 'cube', 'Capturas 3D'], ['desempenho', 'chart', 'Desempenho'], ['restaurante', 'store', 'Restaurante e QR']] as const).map(([k, ic, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              <Icon name={ic} size={18} /> {label}
              {k === 'capturas' && (pending + running) > 0 && <span className="count">{pending + running}</span>}
            </button>
          ))}
        </nav>
        <a className="btn ghost sm open-menu" href={`#/r/${r.slug}`} target="_blank" rel="noreferrer"><Icon name="external" size={16} /> Abrir cardápio</a>
      </aside>

      <main className="admin-main">
        {pending > 0 && tab !== 'capturas' && (
          <button className="banner" onClick={() => setTab('capturas')}><Icon name="sparkle" /> {pending === 1 ? '1 modelo 3D pronto para revisar' : `${pending} modelos 3D prontos para revisar`} <span>Revisar</span></button>
        )}
        {tab === 'pratos' && <Dishes r={r} onCapture={(d) => setWizard({ dish: d })} onEdit={setEditing} onReview={(d, c) => setWizard({ dish: d, capture: c })} />}
        {tab === 'capturas' && <Captures r={r} captures={captures} provider={provider} onOpen={(d, c) => setWizard({ dish: d, capture: c })} />}
        {tab === 'desempenho' && <Stats r={r} />}
        {tab === 'restaurante' && <Settings r={r} onCreated={setRid} />}
      </main>

      {wizard && <CaptureWizard dish={wizard.dish} captureId={wizard.capture} onClose={() => setWizard(null)} />}
      {editing && <DishForm r={r} dish={editing} onClose={() => setEditing(null)} onCapture={(d) => { setEditing(null); setWizard({ dish: d }) }} />}
    </div>
  )
}

function lastCapture(captures: Capture[], dishId: string) { return captures.filter((c) => c.dish_id === dishId && c.status !== 'descartado').sort((a, b) => b.created_at.localeCompare(a.created_at))[0] }

function Dishes({ r, onCapture, onEdit, onReview }: { r: Restaurant; onCapture: (d: Dish) => void; onEdit: (d: Dish) => void; onReview: (d: Dish, capId: string) => void }) {
  const data = useDB()
  const cats = data.categories.filter((c) => c.restaurant_id === r.id).sort((a, b) => a.sort - b.sort)
  const dishes = data.dishes.filter((d) => d.restaurant_id === r.id)
  const caps = data.captures.filter((c) => c.restaurant_id === r.id)
  const with3d = dishes.filter((d) => d.model).length
  const blank = (): Dish => ({ id: uid('d'), restaurant_id: r.id, category_id: cats[0]?.id ?? '', name: '', description: '', price: 0, tags: [], available: true, sort: 99 })
  return (
    <>
      <div className="page-head">
        <div><h1>Pratos</h1><p className="muted">{dishes.length} pratos · {with3d} com 3D publicado</p></div>
        <button className="btn primary" onClick={() => onEdit(blank())}><Icon name="plus" /> Novo prato</button>
      </div>
      <div className="meter"><span style={{ width: `${(with3d / Math.max(1, dishes.length)) * 100}%` }} /></div>
      {cats.map((c) => {
        const list = dishes.filter((d) => d.category_id === c.id).sort((a, b) => a.sort - b.sort)
        if (!list.length) return null
        return (
          <section key={c.id} className="admin-sec">
            <h2>{c.name}</h2>
            <div className="rows">
              {list.map((d) => {
                const cap = lastCapture(caps, d.id)
                const live = cap && ['enviando', 'na-fila', 'processando', 'otimizando'].includes(cap.status)
                const review = cap?.status === 'revisao'
                return (
                  <div key={d.id} className={`row ${d.available ? '' : 'off'}`}>
                    <DishThumb d={d} />
                    <div className="row-main">
                      <strong>{d.name}</strong>
                      <span className="muted">{brl(d.price)}{d.plate_cm ? ` · prato de ${d.plate_cm} cm` : ''}</span>
                    </div>
                    <div className="row-status">
                      {live ? <span className="status run"><span className="spinner sm" /> Gerando 3D · {cap!.progress}%</span>
                        : review ? <span className="status rev">Pronto para revisar</span>
                        : d.model ? <span className="status ok"><Icon name="check" size={14} /> 3D publicado</span>
                        : <span className="status none">Sem 3D</span>}
                    </div>
                    <div className="row-actions">
                      {review ? <button className="btn primary sm" onClick={() => onReview(d, cap!.id)}>Revisar</button>
                        : live ? <button className="btn sm" onClick={() => onReview(d, cap!.id)}>Acompanhar</button>
                        : <button className={`btn sm ${d.model ? '' : 'primary'}`} onClick={() => onCapture(d)}><Icon name="cube" size={16} /> {d.model ? 'Refazer 3D' : 'Criar 3D'}</button>}
                      <button className="icon-btn" onClick={() => onEdit(d)} aria-label={`Editar ${d.name}`}><Icon name="edit" size={18} /></button>
                      <label className="switch" title={d.available ? 'Disponível no cardápio' : 'Oculto do cardápio'}>
                        <input type="checkbox" checked={d.available} onChange={(e) => db.patchDish(d.id, { available: e.target.checked })} aria-label="Disponível" />
                        <span />
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </>
  )
}

const ALL_TAGS: DishTag[] = ['mais-pedido', 'novo', 'vegetariano', 'vegano', 'sem-gluten', 'picante']

function DishForm({ r, dish, onClose, onCapture }: { r: Restaurant; dish: Dish; onClose: () => void; onCapture: (d: Dish) => void }) {
  const data = useDB()
  const cats = data.categories.filter((c) => c.restaurant_id === r.id).sort((a, b) => a.sort - b.sort)
  const [d, setD] = useState<Dish>(dish)
  const [newCat, setNewCat] = useState('')
  const isNew = !data.dishes.some((x) => x.id === dish.id)
  const set = (p: Partial<Dish>) => setD((x) => ({ ...x, ...p }))
  const valid = d.name.trim() && d.price > 0 && (d.category_id || newCat.trim())
  function save(then?: (d: Dish) => void) {
    let cat = d.category_id
    if (newCat.trim()) { cat = uid('c'); db.saveCategory({ id: cat, restaurant_id: r.id, name: newCat.trim(), sort: cats.length + 1 }) }
    const out = { ...d, category_id: cat, name: d.name.trim() }
    db.saveDish(out); then ? then(out) : onClose()
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (valid) save() }}>
        <div className="modal-head"><h2>{isNew ? 'Novo prato' : 'Editar prato'}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button></div>
        <div className="form">
          <label className="field"><span>Nome</span><input required value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Risoto de camarão" /></label>
          <label className="field"><span>Descrição</span><textarea rows={3} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ingredientes e como é servido" /></label>
          <div className="grid2">
            <label className="field"><span>Preço (R$)</span><input type="number" min={0} step={0.5} value={d.price || ''} onChange={(e) => set({ price: Number(e.target.value) })} /></label>
            <label className="field"><span>Diâmetro do prato (cm)</span><input type="number" min={0} step={0.5} value={d.plate_cm || ''} onChange={(e) => set({ plate_cm: Number(e.target.value) || undefined })} placeholder="Para o tamanho real na RA" /></label>
          </div>
          <div className="grid2">
            <label className="field"><span>Categoria</span>
              <select value={newCat ? '__new' : d.category_id} onChange={(e) => { if (e.target.value === '__new') setNewCat(' '); else { setNewCat(''); set({ category_id: e.target.value }) } }}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new">+ Nova categoria…</option>
              </select>
            </label>
            {newCat ? <label className="field"><span>Nome da categoria</span><input autoFocus value={newCat.trimStart()} onChange={(e) => setNewCat(e.target.value || ' ')} /></label>
              : <label className="field"><span>Porção</span><input value={d.serves ?? ''} onChange={(e) => set({ serves: e.target.value })} placeholder="Serve 1 pessoa" /></label>}
          </div>
          <div className="field"><span>Selos</span>
            <div className="tag-pick">{ALL_TAGS.map((t) => <button type="button" key={t} className={`chip ${d.tags.includes(t) ? 'on' : ''}`} onClick={() => set({ tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t] })}>{TAG_LABEL[t]}</button>)}</div>
          </div>
        </div>
        <div className="modal-foot">
          {!isNew && <button type="button" className="btn ghost danger" onClick={() => { if (confirm(`Excluir “${d.name}”?`)) { db.deleteDish(d.id); onClose() } }}><Icon name="trash" size={16} /> Excluir</button>}
          <span className="grow" />
          <button type="button" className="btn" disabled={!valid} onClick={() => save(onCapture)}><Icon name="cube" size={16} /> Salvar e criar 3D</button>
          <button type="submit" className="btn primary" disabled={!valid}>Salvar</button>
        </div>
      </form>
    </div>
  )
}

const STATUS_LABEL: Record<Capture['status'], string> = { enviando: 'Enviando', 'na-fila': 'Na fila', processando: 'Processando', otimizando: 'Otimizando', revisao: 'Pronto para revisar', publicado: 'Publicado', falhou: 'Falhou', descartado: 'Descartado' }
const SOURCE_LABEL: Record<Capture['source'], string> = { 'video-camera': 'Vídeo gravado no painel', 'video-arquivo': 'Vídeo enviado', fotos: 'Fotos enviadas', 'arquivo-3d': 'Arquivo de app de scan' }

function Captures({ r, captures, provider, onOpen }: { r: Restaurant; captures: Capture[]; provider: string; onOpen: (d: Dish, c: string) => void }) {
  const data = useDB()
  const list = captures.filter((c) => c.status !== 'descartado')
  return (
    <>
      <div className="page-head"><div><h1>Capturas 3D</h1><p className="muted">Cada envio de scan, vídeo ou fotos de um prato.</p></div></div>
      <div className="explain">
        <div><Icon name="cube" /><strong>Arquivo de app de scan</strong><span>Scaniverse, Object Capture ou KIRI. Acabamento automático no navegador. Custo zero por prato.</span></div>
        <div><Icon name="video" /><strong>Vídeo ou fotos</strong><span>{provider === 'proprio' ? 'Processado no servidor próprio de fotogrametria (COLMAP + OpenMVS).' : 'Servidor de fotogrametria ainda não ligado: roda em modo demonstração.'}</span></div>
      </div>
      {!list.length && <div className="empty"><Icon name="cube" size={32} /><p>Nenhuma captura ainda. Em “Pratos”, toque em <strong>Criar 3D</strong> em um prato.</p></div>}
      <div className="cap-list">
        {list.map((c) => {
          const d = data.dishes.find((x) => x.id === c.dish_id); if (!d) return null
          const live = ['enviando', 'na-fila', 'processando', 'otimizando'].includes(c.status)
          return (
            <div key={c.id} className="cap">
              {c.thumb ? <img src={c.thumb} alt="" /> : <DishThumb d={d} />}
              <div className="cap-main">
                <strong>{d.name}</strong>
                <span className="muted">{SOURCE_LABEL[c.source]} · {ago(c.created_at)}{c.provider === 'demo' ? ' · demonstração' : ''}{c.quality ? ` · qualidade ${c.quality.score}/100` : ''}</span>
                {live && <Progress c={c} />}
                {c.status === 'falhou' && <span className="err">{c.error}</span>}
              </div>
              <span className={`status s-${c.status}`}>{STATUS_LABEL[c.status]}</span>
              {c.status === 'revisao' && <button className="btn primary sm" onClick={() => onOpen(d, c.id)}>Revisar</button>}
            </div>
          )
        })}
      </div>
    </>
  )
}

function Stats({ r }: { r: Restaurant }) {
  const data = useDB()
  const ev = data.events.filter((e) => e.restaurant_id === r.id && Date.now() - new Date(e.at).getTime() < 14 * 86400000)
  const dishes = data.dishes.filter((d) => d.restaurant_id === r.id)
  const by = (t: string, id?: string) => ev.filter((e) => e.type === t && (!id || e.dish_id === id)).length
  const rows = useMemo(() => dishes.map((d) => {
    const opens = by('prato_aberto', d.id), v3 = by('ver_3d', d.id), ar = by('ver_ra', d.id), add = by('adicionou', d.id)
    return { d, opens, v3, ar, add, conv: opens ? add / opens : 0 }
  }).sort((a, b) => b.opens - a.opens), [ev.length, dishes.length])
  const grp = (has: boolean) => { const g = rows.filter((x) => !!x.d.model === has); const o = g.reduce((s, x) => s + x.opens, 0); return o ? g.reduce((s, x) => s + x.add, 0) / o : 0 }
  const c3 = grp(true), c0 = grp(false)
  const max = Math.max(1, ...rows.map((x) => x.opens))
  return (
    <>
      <div className="page-head"><div><h1>Desempenho</h1><p className="muted">Últimos 14 dias · {r.name}</p></div></div>
      <div className="kpis">
        <div className="kpi"><small>Cardápio aberto</small><b>{by('menu_aberto').toLocaleString('pt-BR')}</b></div>
        <div className="kpi"><small>Pratos vistos</small><b>{by('prato_aberto').toLocaleString('pt-BR')}</b></div>
        <div className="kpi"><small>Visualizações 3D</small><b>{by('ver_3d').toLocaleString('pt-BR')}</b></div>
        <div className="kpi"><small>Vistos na mesa (RA)</small><b>{by('ver_ra').toLocaleString('pt-BR')}</b></div>
      </div>
      {c0 > 0 && c3 > 0 && (
        <div className="insight">
          <Icon name="sparkle" />
          <p>Pratos com 3D foram adicionados ao pedido em <b>{Math.round(c3 * 100)}%</b> das vezes em que foram abertos, contra <b>{Math.round(c0 * 100)}%</b> dos pratos sem 3D.</p>
        </div>
      )}
      <div className="table">
        <div className="tr th"><span>Prato</span><span>Aberturas</span><span>3D</span><span>RA</span><span>Adicionou</span></div>
        {rows.map(({ d, opens, v3, ar, add, conv }) => (
          <div key={d.id} className="tr">
            <span className="td-name">{d.model && <Icon name="cube" size={14} />} {d.name}<i className="hbar"><em style={{ width: `${(opens / max) * 100}%` }} /></i></span>
            <span>{opens}</span><span>{d.model ? v3 : '—'}</span><span>{d.model ? ar : '—'}</span><span>{add} <small className="muted">({Math.round(conv * 100)}%)</small></span>
          </div>
        ))}
      </div>
      <p className="muted small">Os números anteriores a hoje são simulados para a demonstração. As visitas feitas no cardápio de demonstração entram de verdade.</p>
    </>
  )
}

function Settings({ r, onCreated }: { r: Restaurant; onCreated: (id: string) => void }) {
  const [table, setTable] = useState('')
  const [qr, setQr] = useState('')
  const [creating, setCreating] = useState(false)
  const base = `${location.origin}${location.pathname}`
  const link = `${base}#/r/${r.slug}${table ? `?mesa=${encodeURIComponent(table)}` : ''}`
  useEffect(() => { QRCode.toDataURL(link, { margin: 1, width: 640, color: { dark: '#111111', light: '#ffffff' } }).then(setQr) }, [link])
  return (
    <>
      <div className="page-head"><div><h1>Restaurante e QR</h1><p className="muted">Um único QR code para o cardápio inteiro. Coloque nas mesas, na porta ou na comanda.</p></div>
        <button className="btn" onClick={() => setCreating(true)}><Icon name="plus" /> Novo restaurante</button></div>
      <div className="settings">
        <div className="card">
          <h3>Dados do cardápio</h3>
          <label className="field"><span>Nome</span><input value={r.name} onChange={(e) => db.updateRestaurant(r.id, { name: e.target.value })} /></label>
          <label className="field"><span>Frase de destaque</span><input value={r.tagline} onChange={(e) => db.updateRestaurant(r.id, { tagline: e.target.value })} /></label>
          <div className="grid2">
            <label className="field"><span>Cor da marca</span><input type="color" value={r.accent} onChange={(e) => db.updateRestaurant(r.id, { accent: e.target.value })} /></label>
            <label className="field"><span>WhatsApp (opcional)</span><input value={r.whatsapp ?? ''} placeholder="5511999999999" onChange={(e) => db.updateRestaurant(r.id, { whatsapp: e.target.value.replace(/\D/g, '') || undefined })} /></label>
          </div>
        </div>
        <div className="card qr-card">
          <h3>QR code do cardápio</h3>
          {qr && <img src={qr} alt={`QR code do cardápio de ${r.name}`} />}
          <label className="field"><span>Número da mesa (opcional)</span><input value={table} onChange={(e) => setTable(e.target.value)} placeholder="Ex.: 12" /></label>
          <code className="link-box">{link}</code>
          <div className="row-end">
            <button className="btn sm" onClick={() => navigator.clipboard?.writeText(link)}>Copiar link</button>
            <a className="btn primary sm" href={qr} download={`qr-${r.slug}${table ? `-mesa-${table}` : ''}.png`}>Baixar QR</a>
          </div>
        </div>
      </div>
      <div className="card danger-zone">
        <div><strong>Restaurar demonstração</strong><p className="muted small">Volta os pratos, modelos e números ao estado inicial deste protótipo.</p></div>
        <button className="btn ghost danger sm" onClick={() => { if (confirm('Restaurar todos os dados de demonstração?')) db.resetDemo() }}>Restaurar</button>
      </div>
      {creating && <NewRestaurant onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); onCreated(id) }} />}
    </>
  )
}

function NewRestaurant({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const data = useDB()
  const [name, setName] = useState('')
  const [cuisine, setCuisine] = useState('')
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const taken = data.restaurants.some((x) => x.slug === slug)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!slug || taken) return
        onCreated(db.createRestaurant({ slug, name: name.trim(), tagline: cuisine ? `Cozinha ${cuisine.toLowerCase()}` : 'Bem-vindo!', cuisine, accent: '#2F5D8A', city: '' })) }}>
        <div className="modal-head"><h2>Novo restaurante</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button></div>
        <div className="form">
          <label className="field"><span>Nome</span><input autoFocus required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>Tipo de cozinha</span><input value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Japonesa, italiana…" /></label>
          {slug && <p className="muted small">Endereço do cardápio: #/r/{slug} {taken && <b className="err">(já existe)</b>}</p>}
        </div>
        <div className="modal-foot"><span className="grow" /><button className="btn primary" disabled={!slug || taken}>Criar</button></div>
      </form>
    </div>
  )
}
