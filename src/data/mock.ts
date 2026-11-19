/**
 * Dados simulados do piloto. Em produção, cada função aqui vira uma consulta ao Supabase:
 *   dailyMetrics()  → select * from daily_store_metrics where store_id = ... and date between ...
 *   recentOrders()  → select * from orders join order_items ... (últimos 7 dias)
 *   payments        → tabela alimentada pelo webhook do Asaas e pelo conector Open Finance
 */
import type { Cost, CostCategory, DailyMetric, Order, OrderItem, Payment, ReadyItem, Store, CakeFormat } from './types'
import { PRODUCTS, productById } from './catalog'
import { STORES } from './stores'
import { rng, hash, weighted, pick } from '../lib/rng'
import { addDays, spNow, weekdayOf } from '../lib/time'

export const TODAY = spNow().date
const NOW_MIN = spNow().minutes

/** Tamanho relativo de cada loja (matriz maior) */
export const STORE_SIZE: Record<string, number> = {
  'jardim-tiete': 1.75, 'santo-andre': 1.0, 'sao-mateus': 1.25, 'jardim-brasilia': 1.05, americana: 0.8, 'vila-formosa': 0.95,
  itaquera: 1.15, maua: 0.85, guaianases: 0.75, 'sao-bernardo': 1.1, ferraz: 0.65, guarulhos: 0.6,
}
const DOW = [1.3, 0.55, 0.7, 0.8, 0.9, 1.2, 1.5]
const MONTH = [0.82, 0.88, 0.95, 0.97, 1.22, 0.98, 0.95, 0.98, 1.0, 1.05, 1.08, 1.38]
const AVG_TICKET = 132
const PAID_RATE = 0.86

const CAKES = PRODUCTS.filter((p) => p.pricing === 'kg')
const BASE_POP: Record<string, number> = {
  'ninho-doce-leite': 14, 'ninho-nutella': 12, 'delicia-morango': 11, 'dois-amores': 9, 'nutella-morango': 9, 'pistache-morangos': 7,
  pistache: 6, brigadeiro: 7, 'abacaxi-coco': 5, 'olho-sogra': 3, 'moca-nozes': 4, 'ganache-maracuja': 5, 'ganache-limao': 4,
  'delicia-coco': 4, 'abacaxi-doce-leite': 4, 'ninho-ovomaltine': 5, 'sonho-verao': 4, prestigio: 4, 'choco-morango': 5, 'trufado-ninho': 4,
}
function storeMix(storeId: string): [string, number][] {
  const r = rng(hash('mix' + storeId))
  return CAKES.map((p) => [p.id, (BASE_POP[p.id] ?? 3) * (0.6 + r() * 0.8)])
}
const MIX = Object.fromEntries(STORES.map((s) => [s.id, storeMix(s.id)]))

function dayFactor(store: Store, date: string) {
  const wd = weekdayOf(date)
  const m = +date.slice(5, 7) - 1
  const daysAgo = Math.round((Date.parse(TODAY) - Date.parse(date)) / 864e5)
  const growth = 1 + 0.12 * (1 - daysAgo / 365)
  const closed = store.hours[wd] == null ? 0.35 : 1
  return STORE_SIZE[store.id] * DOW[wd] * MONTH[m] * growth * closed
}

// ---------- Pedidos detalhados (últimos 7 dias) ----------
let _orders: Order[] | null = null
let _payments: Payment[] | null = null

const CODE_PREFIX = (id: string) => id.split('-').map((w) => w[0]).join('').toUpperCase().slice(0, 2).padEnd(2, 'X')

function buildOrder(r: () => number, store: Store, date: string, seq: number): Order {
  const mode = r() < 0.58 ? 'encomenda' : 'agora'
  const cakeId = weighted(r, MIX[store.id])
  const p = productById(cakeId)
  const format: CakeFormat = r() < 0.55 ? 'quadrado' : 'redondo'
  const weight = mode === 'agora' ? Math.round((0.75 + r() * 0.5) * 100) / 100 : weighted(r, [[1, 4], [1.5, 3], [2, 3], [3, 1.4], [4, 0.6], [5, 0.3]] as [number, number][])
  const items: OrderItem[] = [{ product_id: p.id, name: p.name, qty: 1, format, weight_kg: weight, unit_price: p.price, total: Math.round(p.price * weight * 100) / 100 }]
  if (r() < 0.35) { const v = productById(pick(r, ['vela-numero', 'vela-palito', 'vela-faisca'])); items.push({ product_id: v.id, name: v.name, qty: 1 + Math.floor(r() * 2), unit_price: v.price, total: 0 }) }
  if (r() < 0.25) { const b = productById('refri-2l'); items.push({ product_id: b.id, name: b.name, qty: 1, unit_price: b.price, total: 0 }) }
  if (r() < 0.2) { const d = productById(pick(r, ['pudim', 'bolo-pote-ninho', 'torta-limao'])); items.push({ product_id: d.id, name: d.name, qty: 1 + Math.floor(r() * 3), unit_price: d.price, total: 0 }) }
  if (mode === 'encomenda' && r() < 0.12) { const s = productById(pick(r, ['cento-coxinha', 'cento-sortido'])); items.push({ product_id: s.id, name: s.name, qty: 1, unit_price: s.price, total: 0 }) }
  items.forEach((it) => { if (!it.total) it.total = it.unit_price * it.qty })
  const total = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100
  const hrs = store.hours[weekdayOf(date)]
  const startMin = hrs ? hrs.open - 60 : 9 * 60
  const endMin = hrs ? hrs.close : 21 * 60
  const minute = Math.floor(startMin + r() * (endMin - startMin))
  const hh = String(Math.floor(minute / 60)).padStart(2, '0'), mm = String(minute % 60).padStart(2, '0')
  return {
    id: `${store.id}-${date}-${seq}`, code: `${CODE_PREFIX(store.id)}-${String(1000 + Math.floor(r() * 9000))}`,
    store_id: store.id, created_at: `${date}T${hh}:${mm}:00-03:00`, channel: 'cardapio_whatsapp', mode,
    fulfillment: r() < 0.7 ? 'retirada' : 'entrega',
    scheduled_for: mode === 'encomenda' ? addDays(date, 1 + Math.floor(r() * 3)) : undefined,
    scheduled_period: mode === 'encomenda' ? (r() < 0.5 ? 'manha' : 'tarde') : undefined,
    total, status: 'aguardando_pagamento', items,
    customer_name: pick(r, ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Larissa', 'Marcos', 'Natália', 'Paulo', 'Renata', 'Thiago', 'Vanessa']) + ' ' + pick(r, ['S.', 'M.', 'O.', 'L.', 'R.', 'C.', 'A.']),
    customer_phone: `(11) 9${Math.floor(1000 + r() * 8999)}-${Math.floor(1000 + r() * 8999)}`,
  }
}

const minutesOf = (iso: string) => +iso.slice(11, 13) * 60 + +iso.slice(14, 16)

function generateRecent() {
  const orders: Order[] = []; const payments: Payment[] = []
  for (const store of STORES) {
    for (let d = 6; d >= 0; d--) {
      const date = addDays(TODAY, -d)
      const r = rng(hash(store.id + date))
      const n = Math.round(22 * dayFactor(store, date) * (0.85 + r() * 0.3))
      for (let i = 0; i < n; i++) {
        const o = buildOrder(r, store, date, i)
        if (d === 0 && minutesOf(o.created_at) > NOW_MIN) continue
        const willPay = r() < PAID_RATE
        const ageMin = d * 1440 + (NOW_MIN - minutesOf(o.created_at))
        const payDelay = o.mode === 'agora' ? 5 + Math.floor(r() * 40) : 10 + Math.floor(r() * 600)
        if (willPay && payDelay <= ageMin) {
          const method = weighted(r, [['pix', 5], ['credito', 3], ['debito', 2]] as [Payment['method'], number][])
          const payMin = minutesOf(o.created_at) + payDelay
          const pd = addDays(date, Math.floor(payMin / 1440)), pm = payMin % 1440
          const pay: Payment = {
            id: 'pay-' + o.id, store_id: store.id, amount: o.total, method,
            received_at: `${pd}T${String(Math.floor(pm / 60)).padStart(2, '0')}:${String(pm % 60).padStart(2, '0')}:00-03:00`,
            source: method === 'pix' && r() < 0.5 ? 'asaas' : 'open_finance',
            reference: method === 'pix' ? `Pedido ${o.code}` : undefined,
          }
          payments.push(pay)
        } else if (ageMin > 24 * 60) {
          o.status = 'sem_pagamento'
        }
        orders.push(o)
      }
      // vendas de balcão na maquininha (sem pedido no cardápio)
      const nCounter = Math.round(18 * dayFactor(store, date) * (0.8 + r() * 0.4))
      for (let i = 0; i < nCounter; i++) {
        const hrs = store.hours[weekdayOf(date)]; if (!hrs) break
        const m = Math.floor(hrs.open + r() * (hrs.close - hrs.open))
        if (d === 0 && m > NOW_MIN) continue
        payments.push({ id: `pos-${store.id}-${date}-${i}`, store_id: store.id, amount: Math.round((12 + r() * 70) * 100) / 100,
          method: weighted(r, [['pix', 3], ['credito', 3], ['debito', 4]] as [Payment['method'], number][]), source: 'open_finance',
          received_at: `${date}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00-03:00` })
      }
    }
  }
  _orders = orders; _payments = payments
  reconcile(orders, payments)
}

/**
 * Conciliação: o coração da solução para cancelamentos.
 * 1) Pix com o código do pedido na descrição → casa direto.
 * 2) Sem código (cartão): mesmo valor exato, mesma loja, até 24 h depois, único candidato.
 * Pedido sem pagamento em 24 h → 'sem_pagamento' (não soma no faturamento).
 */
export function reconcile(orders: Order[], payments: Payment[]) {
  const open = orders.filter((o) => o.status === 'aguardando_pagamento' && !o.payment_id)
  for (const pay of payments) {
    if (pay.order_id) continue
    let match: Order | undefined
    const code = pay.reference?.match(/[A-Z]{2}-\d{4}/)?.[0]
    if (code) match = open.find((o) => o.code === code && o.store_id === pay.store_id)
    if (!match && !pay.id.startsWith('pos-')) {
      const t = Date.parse(pay.received_at)
      const cands = open.filter((o) => o.store_id === pay.store_id && Math.abs(o.total - pay.amount) < 0.01 && t >= Date.parse(o.created_at) && t - Date.parse(o.created_at) < 864e5)
      if (cands.length === 1) match = cands[0]
    }
    if (match) { match.status = 'pago'; match.payment_id = pay.id; pay.order_id = match.id; open.splice(open.indexOf(match), 1) }
  }
}

export function recentOrders() { if (!_orders) generateRecent(); return _orders! }
export function recentPayments() { if (!_payments) generateRecent(); return _payments! }

// ---------- Métricas diárias (365 dias) ----------
const _daily = new Map<string, DailyMetric>()
export function dailyMetric(store: Store, date: string): DailyMetric {
  const key = store.id + date
  const hit = _daily.get(key); if (hit) return hit
  let m: DailyMetric
  const daysAgo = Math.round((Date.parse(TODAY) - Date.parse(date)) / 864e5)
  if (daysAgo <= 6) {
    const os = recentOrders().filter((o) => o.store_id === store.id && o.created_at.startsWith(date))
    const ps = recentPayments().filter((p) => p.store_id === store.id && p.received_at.startsWith(date))
    m = { store_id: store.id, date, orders_sent: os.length, orders_paid: os.filter((o) => o.status === 'pago').length,
      revenue_orders: ps.filter((p) => p.order_id).reduce((s, p) => s + p.amount, 0),
      counter_revenue: ps.filter((p) => !p.order_id).reduce((s, p) => s + p.amount, 0),
      unpaid_value: os.filter((o) => o.status === 'sem_pagamento').reduce((s, o) => s + o.total, 0) }
  } else {
    const r = rng(hash('d' + store.id + date))
    const f = dayFactor(store, date) * (0.85 + r() * 0.3)
    const sent = Math.round(22 * f)
    const paid = Math.round(sent * (PAID_RATE + (r() - 0.5) * 0.06))
    const ticket = AVG_TICKET * (0.9 + r() * 0.2)
    m = { store_id: store.id, date, orders_sent: sent, orders_paid: paid, revenue_orders: paid * ticket,
      counter_revenue: store.hours[weekdayOf(date)] ? 18 * f * 42 * (0.9 + r() * 0.2) : 0, unpaid_value: (sent - paid) * ticket * 0.95 }
  }
  _daily.set(key, m); return m
}

/** Unidades vendidas por produto num dia (bolos) */
export function productSales(store: Store, date: string): Record<string, number> {
  const daysAgo = Math.round((Date.parse(TODAY) - Date.parse(date)) / 864e5)
  const out: Record<string, number> = {}
  if (daysAgo <= 6) {
    for (const o of recentOrders()) if (o.store_id === store.id && o.status === 'pago' && o.created_at.startsWith(date))
      for (const it of o.items) if (productById(it.product_id).pricing === 'kg') out[it.product_id] = (out[it.product_id] ?? 0) + 1
    return out
  }
  const paid = dailyMetric(store, date).orders_paid
  const mix = MIX[store.id]; const tot = mix.reduce((s, [, w]) => s + w, 0)
  for (const [id, w] of mix) out[id] = (paid * w) / tot
  return out
}

// ---------- Custos ----------
export const COST_LABEL: Record<CostCategory, string> = {
  funcionarios: 'Funcionários', aluguel: 'Aluguel', insumos: 'Insumos', embalagens: 'Embalagens', energia_agua: 'Energia e água',
  taxas_cartao: 'Taxas de cartão', royalties: 'Royalties', marketing: 'Marketing', outros: 'Outros',
}

/** Custos de um mês (YYYY-MM) com base na receita do mês */
export function monthCosts(store: Store, ym: string, revenue: number): Cost[] {
  const r = rng(hash('c' + store.id + ym)); const size = STORE_SIZE[store.id]
  const c = (cat: CostCategory, desc: string, amount: number, day: number, source: Cost['source'], recurring = true): Cost =>
    ({ id: `${store.id}-${ym}-${cat}-${day}`, store_id: store.id, date: `${ym}-${String(day).padStart(2, '0')}`, category: cat, description: desc, amount: Math.round(amount * 100) / 100, source, recurring })
  return [
    c('funcionarios', 'Folha de pagamento + encargos', 21000 * Math.sqrt(size) * (0.97 + r() * 0.06), 5, 'open_finance'),
    c('aluguel', 'Aluguel do ponto', 8200 * Math.sqrt(size), 10, 'open_finance'),
    c('insumos', 'Fornecedores: leite, farinha, chocolate, frutas', revenue * (0.29 + r() * 0.03), 12, 'open_finance', false),
    c('embalagens', 'Caixas, bases e sacolas', revenue * 0.035, 15, 'manual', false),
    c('energia_agua', 'Energia + água', 2600 * size * (0.9 + r() * 0.25), 20, 'open_finance'),
    c('taxas_cartao', 'Taxas da maquininha e do Asaas', revenue * 0.7 * 0.022, 28, 'open_finance', false),
    c('royalties', 'Royalties da franqueadora (5%)', revenue * 0.05, 7, 'open_finance'),
    c('marketing', 'Fundo de marketing (2%)', revenue * 0.02, 7, 'manual'),
  ]
}

// ---------- Vitrine (pronta entrega) ----------
export function readyItems(storeId: string): ReadyItem[] {
  const r = rng(hash('vitrine' + storeId + TODAY))
  const ids = ['ninho-doce-leite', 'delicia-coco', 'ninho-nutella', 'nutella-morango', 'delicia-morango', 'pistache-morangos', 'dois-amores', 'brigadeiro', 'ganache-maracuja', 'ninho-doce-leite', 'delicia-morango', 'prestigio']
  return ids.map((pid, i) => {
    const p = productById(pid)
    return { id: `${storeId}-r${i}`, store_id: storeId, product_id: pid, format: r() < 0.7 ? 'quadrado' : 'redondo',
      weight_g: Math.round(760 + r() * 360), price_per_kg: p.price, discount_pct: r() < 0.3 ? 0.15 : 0, status: 'disponivel' } as ReadyItem
  })
}
export const readyPrice = (it: ReadyItem) => Math.round((it.weight_g / 1000) * it.price_per_kg * (1 - it.discount_pct) * 100) / 100

// ---------- Vendas por item (produto) ----------
export interface ItemStat { qty: number; kg: number; revenue: number }
const _basket = new Map<string, Record<string, ItemStat>>()
/** Cesta média por pedido pago, tirada de uma amostra de pedidos da loja */
function basket(store: Store) {
  const hit = _basket.get(store.id); if (hit) return hit
  const r = rng(hash('basket' + store.id)); const N = 400; const out: Record<string, ItemStat> = {}
  for (let i = 0; i < N; i++) for (const it of buildOrder(r, store, TODAY, i).items) {
    const s = (out[it.product_id] ??= { qty: 0, kg: 0, revenue: 0 })
    s.qty += it.qty / N; s.kg += (it.weight_kg ?? 0) / N; s.revenue += it.total / N
  }
  _basket.set(store.id, out); return out
}
export function itemSales(store: Store, date: string): Record<string, ItemStat> {
  const daysAgo = Math.round((Date.parse(TODAY) - Date.parse(date)) / 864e5)
  const out: Record<string, ItemStat> = {}
  if (daysAgo <= 6) {
    for (const o of recentOrders()) if (o.store_id === store.id && o.status === 'pago' && o.created_at.startsWith(date))
      for (const it of o.items) { const s = (out[it.product_id] ??= { qty: 0, kg: 0, revenue: 0 }); s.qty += it.qty; s.kg += it.weight_kg ?? 0; s.revenue += it.total }
    return out
  }
  const paid = dailyMetric(store, date).orders_paid
  for (const [id, b] of Object.entries(basket(store))) out[id] = { qty: b.qty * paid, kg: b.kg * paid, revenue: b.revenue * paid }
  return out
}
