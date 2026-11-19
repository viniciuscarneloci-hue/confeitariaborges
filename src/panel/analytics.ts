import type { Store, Cost, CostCategory } from '../data/types'
import { dailyMetric, productSales, monthCosts, TODAY } from '../data/mock'
import { addDays, dayLabel, MONTHS_SHORT, WEEKDAYS_SHORT, weekdayOf } from '../lib/time'
import { load } from '../lib/storage'

export type Period = 'hoje' | '7d' | '30d' | '12m'
export const PERIODS: { id: Period; label: string; long: string }[] = [
  { id: "hoje", label: "Hoje", long: "hoje" }, { id: '7d', label: '7 dias', long: 'nos últimos 7 dias' },
  { id: '30d', label: '30 dias', long: 'nos últimos 30 dias' }, { id: '12m', label: '12 meses', long: 'nos últimos 12 meses' },
]
const LEN: Record<Period, number> = { hoje: 1, '7d': 7, '30d': 30, '12m': 365 }

export function daysOf(p: Period, end = TODAY) { const n = LEN[p]; return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1)) }
const ym = (d: string) => d.slice(0, 7)
const daysInMonth = (m: string) => new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate()

export const extraCosts = (storeId: string) => load<Cost[]>('custos-extra', []).filter((c) => c.store_id === storeId)

/** Custos do mês inteiro (até hoje no mês corrente), com a receita real do mês */
export function monthCostEntries(store: Store, m: string) {
  const last = m === ym(TODAY) ? +TODAY.slice(8, 10) : daysInMonth(m)
  let rev = 0
  for (let d = 1; d <= last; d++) { const x = dailyMetric(store, `${m}-${String(d).padStart(2, '0')}`); rev += x.revenue_orders + x.counter_revenue }
  const base = monthCosts(store, m, rev)
  return { entries: [...base, ...extraCosts(store.id).filter((c) => ym(c.date) === m)], revenue: rev }
}

export interface Summary {
  revenue: number; ordersRevenue: number; counterRevenue: number; sent: number; paid: number; unpaidValue: number; unpaidCount: number
  costs: number; costsByCat: Record<CostCategory, number>; profit: number; ticket: number
  series: { label: string; key: string; value: number; orders: number }[]
  top: { id: string; qty: number }[]
}

export function summarize(store: Store, period: Period): Summary {
  const days = daysOf(period)
  let ordersRevenue = 0, counter = 0, sent = 0, paid = 0, unpaidValue = 0
  const top: Record<string, number> = {}
  const byKey = new Map<string, { label: string; value: number; orders: number }>()
  const monthsRev = new Map<string, number>()
  for (const d of days) {
    const m = dailyMetric(store, d)
    ordersRevenue += m.revenue_orders; counter += m.counter_revenue; sent += m.orders_sent; paid += m.orders_paid; unpaidValue += m.unpaid_value
    monthsRev.set(ym(d), (monthsRev.get(ym(d)) ?? 0) + m.revenue_orders + m.counter_revenue)
    for (const [id, q] of Object.entries(productSales(store, d))) top[id] = (top[id] ?? 0) + q
    const key = period === '12m' ? ym(d) : d
    const label = period === '12m' ? MONTHS_SHORT[+d.slice(5, 7) - 1] : period === '7d' ? WEEKDAYS_SHORT[weekdayOf(d)] : dayLabel(d)
    const cur = byKey.get(key) ?? { label, value: 0, orders: 0 }
    cur.value += m.revenue_orders + m.counter_revenue; cur.orders += m.orders_paid; byKey.set(key, cur)
  }
  // custos proporcionais ao período
  const costsByCat = {} as Record<CostCategory, number>
  for (const [m, revInRange] of monthsRev) {
    const { entries, revenue: monthRev } = monthCostEntries(store, m)
    const daysInRange = days.filter((d) => ym(d) === m).length
    const totalDays = m === ym(TODAY) ? +TODAY.slice(8, 10) : daysInMonth(m)
    for (const c of entries) {
      const share = c.recurring ? daysInRange / daysInMonth(m) : monthRev ? revInRange / monthRev : daysInRange / totalDays
      costsByCat[c.category] = (costsByCat[c.category] ?? 0) + c.amount * share
    }
  }
  const costs = Object.values(costsByCat).reduce((s, v) => s + v, 0)
  const revenue = ordersRevenue + counter
  return {
    revenue, ordersRevenue, counterRevenue: counter, sent, paid, unpaidValue, unpaidCount: sent - paid, costs, costsByCat,
    profit: revenue - costs, ticket: paid ? ordersRevenue / paid : 0,
    series: [...byKey.entries()].map(([key, v]) => ({ key, ...v })),
    top: Object.entries(top).map(([id, qty]) => ({ id, qty })).sort((a, b) => b.qty - a.qty),
  }
}

/** Mesmo período imediatamente anterior, para a variação */
export function previous(store: Store, period: Period) {
  const n = LEN[period]; const end = addDays(TODAY, -n)
  let revenue = 0, paid = 0
  for (const d of daysOf(period, end)) { const m = dailyMetric(store, d); revenue += m.revenue_orders + m.counter_revenue; paid += m.orders_paid }
  return { revenue, paid }
}

import { itemSales, type ItemStat } from '../data/mock'
/** Vendas por produto no período, para uma loja ou para a rede inteira */
export function productTotals(stores: Store[], period: Period) {
  const tot: Record<string, ItemStat> = {}
  for (const st of stores) for (const d of daysOf(period)) for (const [id, s] of Object.entries(itemSales(st, d))) {
    const t = (tot[id] ??= { qty: 0, kg: 0, revenue: 0 }); t.qty += s.qty; t.kg += s.kg; t.revenue += s.revenue
  }
  return tot
}
