import { useMemo, useState } from 'react'
import { STORES, storeById, PILOT_STORE } from '../data/stores'
import { productById } from '../data/catalog'
import { recentOrders, recentPayments, COST_LABEL, TODAY, reconcile } from '../data/mock'
import type { Order, Payment, Store, Cost, CostCategory } from '../data/types'
import { money, moneyShort, int, pct, kg } from '../lib/format'
import { longDay, dayLabel } from '../lib/time'
import { demoOrders, saveDemoOrders } from '../lib/cart'
import { load, save } from '../lib/storage'
import { summarize, previous, PERIODS, type Period, monthCostEntries, productTotals } from './analytics'
import { CATEGORIES } from '../data/catalog'
import type { CategoryId } from '../data/types'
import { Columns, HBars, Segmented } from './charts'
import { Icon } from '../ui/Icon'
import { Brand } from '../ui/Brand'

type Role = 'franqueado' | 'franqueadora'
type View = 'geral' | 'produtos' | 'pedidos' | 'custos' | 'rede'
const SESSION_KEY = 'painel-sessao'

export function PanelApp() {
  const [session, setSession] = useState<{ role: Role; store: string } | null>(() => load(SESSION_KEY, null))
  if (!session) return <Login onEnter={(s) => { save(SESSION_KEY, s); setSession(s) }} />
  return <Shell session={session} onLogout={() => { save(SESSION_KEY, null); setSession(null) }} />
}

function Login({ onEnter }: { onEnter: (s: { role: Role; store: string }) => void }) {
  const [role, setRole] = useState<Role>('franqueado')
  const [email, setEmail] = useState('santoandre@confeitariaborges.com.br')
  const [pass, setPass] = useState('••••••••••')
  const [code, setCode] = useState('482913')
  return (
    <div className="login">
      <form className="login-card" onSubmit={(e) => { e.preventDefault(); onEnter({ role, store: PILOT_STORE }) }}>
        <Brand sub="Gestão da rede" />
        <h1>Entrar no painel</h1>
        <p className="muted">Acesso restrito a franqueados e à franqueadora.</p>
        <div className="seg mini" role="radiogroup" aria-label="Perfil">
          <button type="button" className={role === 'franqueado' ? 'on' : ''} onClick={() => { setRole('franqueado'); setEmail('santoandre@confeitariaborges.com.br') }}>Franqueado</button>
          <button type="button" className={role === 'franqueadora' ? 'on' : ''} onClick={() => { setRole('franqueadora'); setEmail('diretoria@confeitariaborges.com.br') }}>Franqueadora</button>
        </div>
        <label className="lf"><span>E-mail</span><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="lf"><span>Senha</span><input id="senha" type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
        <label className="lf"><span>Código do app autenticador</span><input id="codigo" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} /></label>
        <button className="btn primary block" type="submit"><Icon name="lock" /> Entrar</button>
        <p className="fine">Piloto: dados de demonstração, login simulado. Em produção: Supabase Auth com verificação em duas etapas e cada loja isolada por RLS.</p>
      </form>
    </div>
  )
}

function Shell({ session, onLogout }: { session: { role: Role; store: string }; onLogout: () => void }) {
  const isHQ = session.role === 'franqueadora'
  const [view, setView] = useState<View>(isHQ ? 'rede' : 'geral')
  const [storeId, setStoreId] = useState(session.store)
  const [period, setPeriod] = useState<Period>('30d')
  const store = storeById(storeId === '__rede' ? PILOT_STORE : storeId)
  const nav: { id: View; label: string }[] = [
    ...(isHQ ? [{ id: 'rede' as View, label: 'Rede' }] : []),
    { id: 'geral', label: isHQ ? 'Loja' : 'Visão geral' }, { id: 'produtos', label: 'Produtos vendidos' }, { id: 'pedidos', label: 'Pedidos e pagamentos' }, { id: 'custos', label: 'Custos' },
  ]
  return (
    <div className="panel">
      <aside className="p-side">
        <Brand sub={isHQ ? 'Franqueadora' : `Loja ${store.name}`} />
        <nav className="p-nav">{nav.map((n) => <button key={n.id} className={view === n.id ? 'on' : ''} onClick={() => { if (n.id !== 'produtos' && storeId === '__rede') setStoreId(session.store); setView(n.id) }}>{n.label}</button>)}</nav>
        <button className="p-out" onClick={onLogout}><Icon name="out" /> Sair</button>
      </aside>
      <div className="p-main">
        <div className="p-bar">
          <div className="p-title">
            <h1>{view === 'rede' ? 'Rede Confeitaria Borges' : view === 'produtos' ? 'Produtos vendidos' : view === 'pedidos' ? 'Pedidos e pagamentos' : view === 'custos' ? 'Custos' : `Loja ${store.name}`}</h1>
            {isHQ && view !== 'rede' && (
              <select id="loja" value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Loja">
                {view === 'produtos' && <option value="__rede">Rede toda</option>}
                {STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          {(view === 'geral' || view === 'rede' || view === 'produtos') && (
            <div className="seg mini periods" role="tablist" aria-label="Período">
              {PERIODS.map((p) => <button key={p.id} className={period === p.id ? 'on' : ''} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
            </div>
          )}
        </div>
        {view === 'rede' && <Network period={period} onOpen={(id) => { setStoreId(id); setView('geral') }} />}
        {view === 'geral' && <Overview store={store} period={period} />}
        {view === 'produtos' && <Products stores={storeId === '__rede' ? STORES : [store]} period={period} />}
        {view === 'pedidos' && <Orders store={store} />}
        {view === 'custos' && <Costs store={store} />}
      </div>
    </div>
  )
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return null
  const d = (now - before) / before
  return <span className={'delta ' + (d >= 0 ? 'up' : 'down')}>{d >= 0 ? '▲' : '▼'} {pct(Math.abs(d))}</span>
}

function Overview({ store, period }: { store: Store; period: Period }) {
  const s = useMemo(() => summarize(store, period), [store.id, period])
  const prev = useMemo(() => (period === 'hoje' ? null : previous(store, period)), [store.id, period])
  const plong = PERIODS.find((p) => p.id === period)!.long
  const hourly = useMemo(() => {
    if (period !== 'hoje') return null
    const hrs = Array.from({ length: 14 }, (_, i) => ({ label: `${i + 8}h`, value: 0 }))
    for (const o of recentOrders()) if (o.store_id === store.id && o.created_at.startsWith(TODAY) && o.status === 'pago') { const h = +o.created_at.slice(11, 13) - 8; if (hrs[h]) hrs[h].value += 1 }
    return hrs
  }, [store.id, period])
  const costRows = (Object.entries(s.costsByCat) as [CostCategory, number][]).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ id: c, label: COST_LABEL[c], value: v }))
  const margin = s.revenue ? s.profit / s.revenue : 0
  return (
    <div className="p-content">
      <section className="kpis">
        <div className="kpi main"><span className="k-l">Faturamento {plong}</span><span className="k-v">{money(s.revenue)}</span>{prev && <Delta now={s.revenue} before={prev.revenue} />}<span className="k-s">só pagamentos que caíram na conta</span></div>
        <div className="kpi"><span className="k-l">Lucro</span><span className="k-v">{money(s.profit)}</span><span className="k-s">margem de {pct(margin)}</span></div>
        <div className="kpi"><span className="k-l">Custos</span><span className="k-v">{money(s.costs)}</span><span className="k-s">{pct(s.revenue ? s.costs / s.revenue : 0)} do faturamento</span></div>
        <div className="kpi"><span className="k-l">Pedidos pagos</span><span className="k-v">{int(s.paid)}</span>{prev && <Delta now={s.paid} before={prev.paid} />}<span className="k-s">de {int(s.sent)} enviados pelo cardápio</span></div>
        <div className="kpi"><span className="k-l">Ticket médio</span><span className="k-v">{money(s.ticket)}</span><span className="k-s">pedidos do cardápio</span></div>
      </section>

      <section className="card span2">
        <header><h2>{period === 'hoje' ? 'Pedidos pagos por hora, hoje' : 'Faturamento ' + plong}</h2><p className="muted">{period === 'hoje' ? 'Hora do pedido' : 'Cardápio + balcão, pela data do pagamento'}</p></header>
        {hourly ? <Columns data={hourly} format={(v) => `${v} pedidos`} tickFormat={(v) => String(v)} ariaLabel="Pedidos pagos por hora" />
          : <Columns data={s.series.map((x) => ({ label: x.label, value: x.value, sub: `${int(x.orders)} pedidos pagos` }))} format={money} tickFormat={(v) => (v === 0 ? '0' : moneyShort(v).replace(/R\$\s?/, ''))} ariaLabel={'Faturamento ' + plong} />}
      </section>

      <section className="card">
        <header><h2>Conciliação dos pedidos</h2><p className="muted">Pedido só vira faturamento quando o pagamento aparece na conta</p></header>
        <Segmented parts={[
          { label: 'Pagos', value: s.paid, cls: 's-paid', fmt: int(s.paid) },
          { label: 'Sem pagamento', value: s.unpaidCount, cls: 's-unpaid', fmt: int(s.unpaidCount) },
        ]} />
        <div className="callout">
          <strong>{money(s.unpaidValue)}</strong> em pedidos que foram ao WhatsApp e não viraram pagamento. Eles ficam fora do faturamento, então o número acima é o que realmente entrou.
        </div>
        <dl className="split">
          <div><dt>Pedidos do cardápio</dt><dd>{money(s.ordersRevenue)}</dd></div>
          <div><dt>Balcão (maquininha)</dt><dd>{money(s.counterRevenue)}</dd></div>
        </dl>
      </section>

      <section className="card">
        <header><h2>Bolos mais vendidos</h2><p className="muted">Pedidos pagos {plong}</p></header>
        <HBars rows={s.top.slice(0, 7).map((t) => ({ id: t.id, label: productById(t.id).name, value: t.qty }))} format={(v) => int(v)} />
      </section>

      <section className="card">
        <header><h2>Para onde vai o dinheiro</h2><p className="muted">Custos {plong}</p></header>
        <HBars tone="gold" rows={costRows} format={moneyShort} />
      </section>
    </div>
  )
}

function Network({ period, onOpen }: { period: Period; onOpen: (id: string) => void }) {
  const rows = useMemo(() => STORES.map((st) => ({ st, s: summarize(st, period) })).sort((a, b) => b.s.revenue - a.s.revenue), [period])
  const plong = PERIODS.find((p) => p.id === period)!.long
  const tot = rows.reduce((a, { s }) => ({ revenue: a.revenue + s.revenue, profit: a.profit + s.profit, paid: a.paid + s.paid, sent: a.sent + s.sent, unpaid: a.unpaid + s.unpaidValue }), { revenue: 0, profit: 0, paid: 0, sent: 0, unpaid: 0 })
  const netTop: Record<string, number> = {}
  rows.forEach(({ s }) => s.top.forEach((t) => (netTop[t.id] = (netTop[t.id] ?? 0) + t.qty)))
  const royalties = tot.revenue * 0.05
  return (
    <div className="p-content">
      <section className="kpis">
        <div className="kpi main"><span className="k-l">Faturamento da rede {plong}</span><span className="k-v">{money(tot.revenue)}</span><span className="k-s">12 lojas, pagamentos conciliados</span></div>
        <div className="kpi"><span className="k-l">Lucro somado das lojas</span><span className="k-v">{money(tot.profit)}</span><span className="k-s">margem de {pct(tot.profit / tot.revenue)}</span></div>
        <div className="kpi"><span className="k-l">Royalties a receber</span><span className="k-v">{money(royalties)}</span><span className="k-s">5% do faturamento</span></div>
        <div className="kpi"><span className="k-l">Pedidos pagos</span><span className="k-v">{int(tot.paid)}</span><span className="k-s">conversão de {pct(tot.paid / tot.sent)}</span></div>
        <div className="kpi"><span className="k-l">Fora do faturamento</span><span className="k-v">{money(tot.unpaid)}</span><span className="k-s">pedidos sem pagamento</span></div>
      </section>
      <section className="card span2">
        <header><h2>Faturamento por loja</h2><p className="muted">{plong[0].toUpperCase() + plong.slice(1)}. Toque numa loja para abrir o painel dela.</p></header>
        <div className="table-scroll">
          <table className="tbl">
            <thead><tr><th>Loja</th><th className="r">Faturamento</th><th className="bar-col" aria-label="Comparativo" /><th className="r">Pedidos pagos</th><th className="r">Conversão</th><th className="r">Ticket</th><th className="r">Lucro</th><th className="r">Margem</th><th>Mais vendido</th></tr></thead>
            <tbody>
              {rows.map(({ st, s }) => (
                <tr key={st.id} onClick={() => onOpen(st.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(st.id)}>
                  <td><strong>{st.name}</strong>{st.is_flagship && <span className="pill ok sm">matriz</span>}{st.id === PILOT_STORE && <span className="pill sky sm">piloto</span>}</td>
                  <td className="r num">{money(s.revenue)}</td>
                  <td className="bar-col"><span className="inbar"><span style={{ width: `${(s.revenue / rows[0].s.revenue) * 100}%` }} /></span></td>
                  <td className="r num">{int(s.paid)}</td>
                  <td className="r num">{pct(s.sent ? s.paid / s.sent : 0)}</td>
                  <td className="r num">{money(s.ticket)}</td>
                  <td className={'r num ' + (s.profit < 0 ? 'neg' : '')}>{money(s.profit)}</td>
                  <td className="r num">{pct(s.revenue ? s.profit / s.revenue : 0)}</td>
                  <td>{s.top[0] ? productById(s.top[0].id).name : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <header><h2>Mais vendidos na rede</h2><p className="muted">Bolos, pedidos pagos {plong}</p></header>
        <HBars rows={Object.entries(netTop).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, v]) => ({ id, label: productById(id).name, value: v }))} format={(v) => int(v)} />
      </section>
      <section className="card">
        <header><h2>Pedidos que não viraram venda</h2><p className="muted">Valor enviado ao WhatsApp sem pagamento, {plong}</p></header>
        <HBars tone="gold" rows={[...rows].sort((a, b) => b.s.unpaidValue - a.s.unpaidValue).slice(0, 8).map(({ st, s }) => ({ id: st.id, label: st.name, value: s.unpaidValue, note: pct(s.sent ? (s.sent - s.paid) / s.sent : 0) + ' dos pedidos' }))} format={moneyShort} />
      </section>
    </div>
  )
}

// ---------- Pedidos e conciliação ----------
const STATUS: Record<Order['status'], { label: string; cls: string }> = {
  aguardando_pagamento: { label: 'Aguardando pagamento', cls: 'wait' }, pago: { label: 'Pago', cls: 'ok' },
  sem_pagamento: { label: 'Sem pagamento', cls: 'muted' }, cancelado: { label: 'Cancelado', cls: 'muted' },
}
const METHOD: Record<Payment['method'], string> = { pix: 'Pix', credito: 'Crédito', debito: 'Débito' }

function Orders({ store }: { store: Store }) {
  const [filter, setFilter] = useState<'todos' | Order['status']>('todos')
  const [limit, setLimit] = useState(15)
  const [demo, setDemo] = useState<Order[]>(() => demoOrders())
  const [demoPays, setDemoPays] = useState<Payment[]>(() => load('demo-pays', []))
  const mine = demo.filter((o) => o.store_id === store.id)
  const base = recentOrders().filter((o) => o.store_id === store.id)
  const all = [...mine, ...[...base].sort((a, b) => b.created_at.localeCompare(a.created_at))]
  const pays = [...demoPays.filter((p) => p.store_id === store.id), ...recentPayments().filter((p) => p.store_id === store.id)].sort((a, b) => b.received_at.localeCompare(a.received_at))
  const payById = new Map(pays.map((p) => [p.id, p]))
  const list = all.filter((o) => filter === 'todos' || o.status === filter).slice(0, limit)
  const counts = { aguardando_pagamento: 0, pago: 0, sem_pagamento: 0, cancelado: 0 } as Record<Order['status'], number>
  all.forEach((o) => counts[o.status]++)

  function simulatePix(o: Order) {
    const p: Payment = { id: 'demo-pay-' + o.code, store_id: o.store_id, received_at: new Date().toISOString(), amount: o.total, method: 'pix', source: 'asaas', reference: `Pedido ${o.code}` }
    const next = demo.map((x) => ({ ...x })); reconcile(next, [p])
    setDemo(next); saveDemoOrders(next); const np = [p, ...demoPays]; setDemoPays(np); save('demo-pays', np)
  }
  function expire(o: Order) { const next = demo.map((x) => (x.id === o.id ? { ...x, status: 'sem_pagamento' as const } : x)); setDemo(next); saveDemoOrders(next) }

  return (
    <div className="p-content">
      <section className="card span2 how">
        <h2>Como o painel evita faturamento falso</h2>
        <ol className="flow">
          <li><strong>Cliente envia o pedido</strong><span>O cardápio gera um código (ex.: SA-4827) e o pedido entra aqui como <em>aguardando pagamento</em>.</span></li>
          <li><strong>Dinheiro cai na conta</strong><span>Asaas (Pix e link de cartão) e Open Finance (conta da loja e maquininha) informam só valor, horário e descrição.</span></li>
          <li><strong>O sistema casa os dois</strong><span>Pelo código no Pix ou pelo mesmo valor no mesmo período. Casou: <em>pago</em> e entra no faturamento.</span></li>
          <li><strong>Desistiu?</strong><span>Sem pagamento em 24 h, o pedido sai da conta. Nada de faturamento inflado.</span></li>
        </ol>
      </section>

      {mine.length > 0 && (
        <section className="card span2 demo-box">
          <header><h2>Pedidos que você enviou pelo cardápio</h2><p className="muted">Teste a conciliação: simule o Pix do cliente ou a desistência.</p></header>
          <ul className="olist">
            {mine.map((o) => <OrderRow key={o.id} o={o} pay={o.payment_id ? payById.get(o.payment_id) : undefined} actions={o.status === 'aguardando_pagamento' ? (
              <div className="row-actions"><button className="btn primary sm" onClick={() => simulatePix(o)}>Simular Pix recebido</button><button className="btn ghost sm" onClick={() => expire(o)}>Cliente desistiu</button></div>) : null} />)}
          </ul>
        </section>
      )}

      <section className="card span2">
        <header className="row"><div><h2>Últimos 7 dias</h2><p className="muted">Pedidos do cardápio de {store.name}</p></div>
          <div className="filters">
            {(['todos', 'aguardando_pagamento', 'pago', 'sem_pagamento'] as const).map((f) => (
              <button key={f} className={'fchip ' + (filter === f ? 'on' : '')} onClick={() => setFilter(f)}>{f === 'todos' ? 'Todos' : STATUS[f].label} <span>{f === 'todos' ? all.length : counts[f]}</span></button>
            ))}
          </div>
        </header>
        <ul className="olist">{list.map((o) => <OrderRow key={o.id} o={o} pay={o.payment_id ? payById.get(o.payment_id) : undefined} />)}</ul>
        {list.length === limit && <button className="btn ghost" onClick={() => setLimit((n) => n + 30)}>Mostrar mais pedidos</button>}
      </section>

      <section className="card span2">
        <header><h2>Entradas na conta</h2><p className="muted">Lidas do Asaas e do Open Finance. Somente leitura: o sistema não movimenta dinheiro.</p></header>
        <div className="table-scroll">
          <table className="tbl">
            <thead><tr><th>Quando</th><th>Origem</th><th>Forma</th><th>Descrição</th><th className="r">Valor</th><th>Casou com</th></tr></thead>
            <tbody>{pays.slice(0, 14).map((p) => {
              const o = p.order_id ? all.find((x) => x.id === p.order_id) : undefined
              return (<tr key={p.id}>
                <td className="num">{dayLabel(p.received_at.slice(0, 10))} {p.received_at.slice(11, 16)}</td>
                <td>{p.source === 'asaas' ? 'Asaas' : 'Open Finance'}</td><td>{METHOD[p.method]}</td><td className="muted">{p.reference ?? (p.id.startsWith('pos-') ? 'Maquininha' : '—')}</td>
                <td className="r num">{money(p.amount)}</td>
                <td>{o ? <span className="pill ok sm">{o.code}</span> : <span className="muted">venda de balcão</span>}</td>
              </tr>) })}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function OrderRow({ o, pay, actions }: { o: Order; pay?: Payment; actions?: React.ReactNode }) {
  const st = STATUS[o.status]
  const when = o.created_at.includes('T') ? `${longDay(o.created_at.slice(0, 10))}, ${new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}` : ''
  return (
    <li className="orow">
      <div className="o-main">
        <div className="o-top"><strong className="num">{o.code}</strong><span className={'pill sm ' + st.cls}>{st.label}</span><span className="muted">{when}</span></div>
        <p className="o-items">{o.items.map((i) => `${i.qty}× ${i.name}${i.weight_kg ? ` ${kg(Math.round(i.weight_kg * 100) / 100)}` : ''}`).join(' · ')}</p>
        <p className="muted o-meta">
          {o.mode === 'encomenda' ? `Encomenda para ${o.scheduled_for ? longDay(o.scheduled_for) : '—'}` : 'Pronta entrega'} · {o.fulfillment === 'entrega' ? 'Entrega' : 'Retirada'}
          {o.customer_name ? ` · ${o.customer_name}` : ' · nome chega pelo WhatsApp'}
          {pay && ` · ${METHOD[pay.method]} via ${pay.source === 'asaas' ? 'Asaas' : 'Open Finance'}, ${pay.reference ? 'código no Pix' : 'mesmo valor e horário'}`}
        </p>
        {actions}
      </div>
      <span className="o-total num">{money(o.total)}</span>
    </li>
  )
}

// ---------- Custos ----------
function Costs({ store }: { store: Store }) {
  const m = TODAY.slice(0, 7)
  const [, bump] = useState(0)
  const { entries, revenue } = monthCostEntries(store, m)
  const total = entries.reduce((s, c) => s + c.amount, 0)
  const [form, setForm] = useState({ description: '', amount: '', category: 'outros' as CostCategory, recurring: false })
  function add(e: React.FormEvent) {
    e.preventDefault(); const v = parseFloat(form.amount.replace(/\./g, '').replace(',', '.')); if (!form.description || !v) return
    const c: Cost = { id: 'x' + Date.now(), store_id: store.id, date: TODAY, category: form.category, description: form.description, amount: v, source: 'manual', recurring: form.recurring }
    save('custos-extra', [...load<Cost[]>('custos-extra', []), c]); setForm({ description: '', amount: '', category: 'outros', recurring: false }); bump((n) => n + 1)
  }
  function remove(id: string) { save('custos-extra', load<Cost[]>('custos-extra', []).filter((c) => c.id !== id)); bump((n) => n + 1) }
  const monthName = new Date(TODAY + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return (
    <div className="p-content">
      <section className="kpis three">
        <div className="kpi main"><span className="k-l">Faturamento em {monthName}</span><span className="k-v">{money(revenue)}</span><span className="k-s">até hoje</span></div>
        <div className="kpi"><span className="k-l">Custos lançados</span><span className="k-v">{money(total)}</span><span className="k-s">{entries.filter((c) => c.source === 'open_finance').length} automáticos, {entries.filter((c) => c.source === 'manual').length} manuais</span></div>
        <div className="kpi"><span className="k-l">Resultado do mês</span><span className={'k-v ' + (revenue - total < 0 ? 'neg' : '')}>{money(revenue - total)}</span><span className="k-s">margem de {pct(revenue ? (revenue - total) / revenue : 0)}</span></div>
      </section>
      <section className="card span2">
        <header><h2>Lançamentos de {monthName}</h2><p className="muted">Os automáticos vêm da conta da loja pelo Open Finance. Os manuais você adiciona abaixo.</p></header>
        <div className="table-scroll">
          <table className="tbl">
            <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Origem</th><th className="r">Valor</th><th /></tr></thead>
            <tbody>{[...entries].sort((a, b) => a.date.localeCompare(b.date)).map((c) => (
              <tr key={c.id}><td className="num">{dayLabel(c.date)}</td><td>{COST_LABEL[c.category]}</td><td>{c.description}{c.recurring && <span className="pill sm sky">fixo</span>}</td>
                <td>{c.source === 'open_finance' ? <span className="pill sm ok">Open Finance</span> : <span className="pill sm muted">Manual</span>}</td>
                <td className="r num">{money(c.amount)}</td>
                <td>{c.id.startsWith('x') && <button className="icon-btn sm" onClick={() => remove(c.id)} aria-label="Remover"><Icon name="x" size={14} /></button>}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <form className="cost-form" onSubmit={add}>
          <h3>Adicionar custo</h3>
          <label className="lf"><span>Descrição</span><input id="c-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: manutenção da geladeira" /></label>
          <label className="lf"><span>Valor (R$)</span><input id="c-val" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="350,00" /></label>
          <label className="lf"><span>Categoria</span><select id="c-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as CostCategory })}>{Object.entries(COST_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="check"><input id="c-rec" type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} /> Repete todo mês</label>
          <button className="btn primary" type="submit"><Icon name="plus" /> Adicionar custo</button>
        </form>
      </section>
    </div>
  )
}

// ---------- Produtos vendidos ----------
function Products({ stores, period }: { stores: Store[]; period: Period }) {
  const [cat, setCat] = useState<CategoryId | 'todas'>('todas')
  const tot = useMemo(() => productTotals(stores, period), [stores.length, stores[0].id, period])
  const plong = PERIODS.find((p) => p.id === period)!.long
  const rows = Object.entries(tot).map(([id, s]) => ({ id, p: productById(id), ...s }))
  const all = rows.reduce((a, r) => a + r.revenue, 0)
  const byCat = CATEGORIES.map((c) => { const rs = rows.filter((r) => r.p.category_id === c.id); return { c, revenue: rs.reduce((a, r) => a + r.revenue, 0), qty: rs.reduce((a, r) => a + r.qty, 0), kg: rs.reduce((a, r) => a + r.kg, 0) } })
  const list = rows.filter((r) => cat === 'todas' || r.p.category_id === cat).sort((a, b) => b.revenue - a.revenue)
  const listRev = list.reduce((a, r) => a + r.revenue, 0)
  const cakesKg = rows.reduce((a, r) => a + r.kg, 0)
  const unit = (r: { p: { pricing: string }; qty: number; kg: number }) => (r.p.pricing === 'kg' ? `${int(r.qty)} bolos · ${int(r.kg)} kg` : `${int(r.qty)} un.`)
  return (
    <div className="p-content">
      <section className="span2" style={{ display: 'grid', gap: 10 }}>
        <p className="muted">O que saiu {plong}{stores.length > 1 ? ', somando as 12 lojas' : ''}. Pedidos pagos do cardápio; vendas de balcão chegam só com o valor. Toque numa categoria para filtrar.</p>
        <div className="cat-sum" role="tablist" aria-label="Categorias">
          <button className={cat === 'todas' ? 'on' : ''} onClick={() => setCat('todas')}><small>Tudo</small><strong>{moneyShort(all)}</strong><small>{int(cakesKg)} kg de bolo</small></button>
          {byCat.map(({ c, revenue, qty, kg: k }) => (
            <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
              <small>{c.name}</small><strong>{moneyShort(revenue)}</strong><small>{c.id.startsWith('bolos') ? `${int(k)} kg` : `${int(qty)} un.`}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="card">
        <header><h2>Mais vendidos por faturamento</h2><p className="muted">{cat === 'todas' ? 'Todas as categorias' : CATEGORIES.find((c) => c.id === cat)!.name}</p></header>
        <HBars rows={list.slice(0, 8).map((r) => ({ id: r.id, label: r.p.name, value: r.revenue }))} format={moneyShort} />
      </section>
      <section className="card">
        {cat === 'todas' || cat.startsWith('bolos') ? (<>
          <header><h2>Bolos que mais saíram, em kg</h2><p className="muted">Quilos vendidos por sabor</p></header>
          <HBars rows={list.filter((r) => r.p.pricing === 'kg').sort((a, b) => b.kg - a.kg).slice(0, 8).map((r) => ({ id: r.id, label: r.p.name, value: r.kg }))} format={(v) => `${int(v)} kg`} />
        </>) : (<>
          <header><h2>Mais vendidos por quantidade</h2><p className="muted">Unidades vendidas</p></header>
          <HBars rows={[...list].sort((a, b) => b.qty - a.qty).slice(0, 8).map((r) => ({ id: r.id, label: r.p.name, value: r.qty }))} format={(v) => int(v)} />
        </>)}
      </section>
      <section className="card span2">
        <header><h2>Todos os produtos</h2><p className="muted">{list.length} itens vendidos {plong}</p></header>
        <div className="table-scroll">
          <table className="tbl">
            <thead><tr><th>Produto</th><th>Categoria</th><th className="r">Quantidade</th><th className="r">Faturamento</th><th>Participação</th><th className="r">Preço médio</th></tr></thead>
            <tbody>{list.map((r) => (
              <tr key={r.id}><td><strong>{r.p.name}</strong></td><td className="muted">{CATEGORIES.find((c) => c.id === r.p.category_id)!.name}</td>
                <td className="r num">{unit(r)}</td><td className="r num">{money(r.revenue)}</td>
                <td><span className="share"><span style={{ width: `${listRev ? (r.revenue / listRev) * 100 : 0}%` }} /></span><span className="num">{pct(listRev ? r.revenue / listRev : 0)}</span></td>
                <td className="r num">{r.p.pricing === 'kg' ? `${money(r.kg ? r.revenue / r.kg : 0)}/kg` : money(r.qty ? r.revenue / r.qty : 0)}</td></tr>
            ))}</tbody>
            <tfoot><tr><td>Total</td><td /><td /><td className="r num">{money(listRev)}</td><td /><td /></tr></tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}
