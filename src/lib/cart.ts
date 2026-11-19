import { useEffect, useState } from 'react'
import type { CakeFormat, Order, OrderMode, Fulfillment, Store } from '../data/types'
import { productById } from '../data/catalog'
import { load, save } from './storage'
import { money, kg, grams } from './format'
import { longDay } from './time'

export interface CartLine {
  key: string
  product_id: string
  mode: OrderMode
  qty: number
  format?: CakeFormat
  weight_kg?: number
  ready_item_id?: string
  ready_weight_g?: number
  unit_price: number
  notes?: string
}
export const lineTotal = (l: CartLine) => Math.round(l.unit_price * l.qty * 100) / 100

type Listener = () => void
let lines: CartLine[] = load('cart', [])
const listeners = new Set<Listener>()
const emit = () => { save('cart', lines); listeners.forEach((f) => f()) }

export const cart = {
  get: () => lines,
  add(l: Omit<CartLine, 'key'>) {
    const same = lines.find((x) => !x.ready_item_id && x.product_id === l.product_id && x.mode === l.mode && x.format === l.format && x.weight_kg === l.weight_kg && (x.notes ?? '') === (l.notes ?? ''))
    if (same && !l.ready_item_id) same.qty += l.qty
    else if (!(l.ready_item_id && lines.some((x) => x.ready_item_id === l.ready_item_id))) lines = [...lines, { ...l, key: Math.random().toString(36).slice(2) }]
    lines = [...lines]; emit()
  },
  setQty(key: string, qty: number) { lines = qty <= 0 ? lines.filter((l) => l.key !== key) : lines.map((l) => (l.key === key ? { ...l, qty } : l)); emit() },
  clear() { lines = []; emit() },
}
export function useCart() {
  const [, set] = useState(0)
  useEffect(() => { const f = () => set((n) => n + 1); listeners.add(f); return () => { listeners.delete(f) } }, [])
  return lines
}

export interface CheckoutInfo { date?: string; period?: 'manha' | 'tarde'; fulfillment: Fulfillment }

export function newOrderCode(store: Store) {
  const p = store.id.split('-').map((w) => w[0]).join('').toUpperCase().slice(0, 2).padEnd(2, 'X')
  return `${p}-${String(1000 + Math.floor(Math.random() * 9000))}`
}

export function whatsappMessage(store: Store, ls: CartLine[], info: CheckoutInfo, code: string, readyNote: string) {
  const enc = ls.filter((l) => l.mode === 'encomenda'), now = ls.filter((l) => l.mode === 'agora')
  const fmt = (l: CartLine) => {
    const p = productById(l.product_id)
    let s = `• ${l.qty}× ${p.pricing === 'kg' ? 'Bolo ' : ''}${p.name}`
    if (l.format) s += ` — ${l.format === 'redondo' ? 'Redondo' : 'Quadrado'}`
    if (l.weight_kg) s += `, ${kg(l.weight_kg)} (serve ${Math.round(l.weight_kg * (p.serves_per_kg ?? 10))} pessoas)`
    if (l.ready_weight_g) s += `, ${grams(l.ready_weight_g)} (da vitrine)`
    s += ` — ${money(lineTotal(l))}`
    if (l.notes) s += `\n   Obs.: ${l.notes}`
    return s
  }
  const parts = [`Olá, Confeitaria Borges ${store.name}! Quero fazer este pedido:`, `*Pedido ${code}*`]
  if (enc.length) parts.push('', `*Encomenda* para ${info.date ? longDay(info.date) : 'data a combinar'}${info.period ? (info.period === 'manha' ? ', de manhã' : ', à tarde') : ''}`, ...enc.map(fmt))
  if (now.length) parts.push('', `*Pronta entrega* (${readyNote})`, ...now.map(fmt))
  const total = ls.reduce((s, l) => s + lineTotal(l), 0)
  parts.push('', `*Total: ${money(total)}*`, info.fulfillment === 'entrega' ? 'Quero receber em casa (passo o endereço aqui).' : 'Vou retirar na loja.', '', 'Meu nome é: ')
  return { text: parts.join('\n'), total }
}

/** Pedidos enviados deste aparelho (piloto). Aparecem no painel como "aguardando pagamento". */
export function recordDemoOrder(o: Order) { const all = load<Order[]>('demo-orders', []); save('demo-orders', [o, ...all].slice(0, 30)) }
export const demoOrders = () => load<Order[]>('demo-orders', [])
export const saveDemoOrders = (o: Order[]) => save('demo-orders', o)
