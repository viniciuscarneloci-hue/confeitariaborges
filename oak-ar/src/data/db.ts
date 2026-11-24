import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Capture, Category, Dish, MenuEvent, Restaurant } from './types'
import { SEED_CATEGORIES, SEED_DISHES, SEED_RESTAURANTS } from './seed'

/**
 * Camada de dados do protótipo.
 *
 * Aqui os dados ficam no navegador (localStorage + IndexedDB para arquivos), para o protótipo
 * funcionar sem servidor. As funções têm o mesmo formato das chamadas que irão para o Supabase
 * (uma tabela por coleção, filtradas por restaurant_id), então trocar a implementação não muda as telas.
 * Abas abertas ao mesmo tempo (cardápio e painel) se atualizam na hora via BroadcastChannel.
 */

export interface DB { v: number; restaurants: Restaurant[]; categories: Category[]; dishes: Dish[]; captures: Capture[]; events: MenuEvent[] }

const KEY = 'oak-ar-db'
const VERSION = 4
const seed = (): DB => ({ v: VERSION, restaurants: SEED_RESTAURANTS, categories: SEED_CATEGORIES, dishes: SEED_DISHES, captures: [], events: seedEvents() })

function seedEvents(): MenuEvent[] {
  // Histórico simulado dos últimos 14 dias para o painel não começar vazio.
  const out: MenuEvent[] = []
  let s = 42
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const now = Date.now()
  for (const r of SEED_RESTAURANTS) for (let day = 0; day < 14; day++) {
    const n = Math.round(30 + rnd() * 40)
    for (let i = 0; i < n; i++) out.push({ restaurant_id: r.id, type: 'menu_aberto', at: new Date(now - day * 86400000 - rnd() * 36000000).toISOString() })
  }
  for (const d of SEED_DISHES) {
    const pop = d.model ? 1 : 0.45
    for (let day = 0; day < 14; day++) {
      const at = new Date(now - day * 86400000 - rnd() * 36000000).toISOString()
      const opens = Math.round((4 + rnd() * 10) * pop)
      for (let i = 0; i < opens; i++) out.push({ restaurant_id: d.restaurant_id, dish_id: d.id, type: 'prato_aberto', at })
      if (d.model) {
        const v3 = Math.round(opens * (0.6 + rnd() * 0.3)); const ra = Math.round(v3 * (0.35 + rnd() * 0.25))
        for (let i = 0; i < v3; i++) out.push({ restaurant_id: d.restaurant_id, dish_id: d.id, type: 'ver_3d', at })
        for (let i = 0; i < ra; i++) out.push({ restaurant_id: d.restaurant_id, dish_id: d.id, type: 'ver_ra', at })
      }
      const add = Math.round(opens * (d.model ? 0.42 : 0.25) * (0.7 + rnd() * 0.6))
      for (let i = 0; i < add; i++) out.push({ restaurant_id: d.restaurant_id, dish_id: d.id, type: 'adicionou', at })
    }
  }
  return out
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const db = JSON.parse(raw) as DB; if (db.v === VERSION) return db }
  } catch { /* armazenamento indisponível: segue com a semente */ }
  return seed()
}

let state: DB = load()
const listeners = new Set<() => void>()
let channel: BroadcastChannel | null = null
try { channel = new BroadcastChannel('oak-ar') } catch { channel = null }
channel?.addEventListener('message', () => { state = load(); listeners.forEach((l) => l()) })

function commit(next: DB) {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* cheio ou bloqueado */ }
  channel?.postMessage('changed')
  listeners.forEach((l) => l())
}

export function useDB(): DB {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => state)
}
export const getDB = () => state

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`

export const db = {
  resetDemo() { commit(seed()); idbClear() },

  updateRestaurant(id: string, patch: Partial<Restaurant>) {
    commit({ ...state, restaurants: state.restaurants.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  },
  createRestaurant(r: Omit<Restaurant, 'id' | 'created_at'>) {
    const id = uid('r')
    const cats: Category[] = ['Entradas', 'Pratos principais', 'Sobremesas', 'Bebidas'].map((name, i) => ({ id: uid('c'), restaurant_id: id, name, sort: i + 1 }))
    commit({ ...state, restaurants: [...state.restaurants, { ...r, id, created_at: new Date().toISOString() }], categories: [...state.categories, ...cats] })
    return id
  },
  saveCategory(c: Category) {
    const exists = state.categories.some((x) => x.id === c.id)
    commit({ ...state, categories: exists ? state.categories.map((x) => (x.id === c.id ? c : x)) : [...state.categories, c] })
  },

  saveDish(d: Dish) {
    const exists = state.dishes.some((x) => x.id === d.id)
    commit({ ...state, dishes: exists ? state.dishes.map((x) => (x.id === d.id ? d : x)) : [...state.dishes, d] })
  },
  patchDish(id: string, patch: Partial<Dish>) {
    commit({ ...state, dishes: state.dishes.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  },
  deleteDish(id: string) {
    commit({ ...state, dishes: state.dishes.filter((x) => x.id !== id), captures: state.captures.filter((c) => c.dish_id !== id) })
  },

  saveCapture(c: Capture) {
    const exists = state.captures.some((x) => x.id === c.id)
    commit({ ...state, captures: exists ? state.captures.map((x) => (x.id === c.id ? c : x)) : [c, ...state.captures] })
  },
  patchCapture(id: string, patch: Partial<Capture>) {
    commit({ ...state, captures: state.captures.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  },

  track(e: Omit<MenuEvent, 'at'>) {
    commit({ ...state, events: [...state.events, { ...e, at: new Date().toISOString() }] })
  },
}

// ------------------------------------------------------------------ arquivos (IndexedDB)
// Modelos enviados pelo dono ficam guardados como blob e são referenciados por "idb:<id>".

const IDB = 'oak-ar-files'
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore('files')
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
}
export async function putFile(blob: Blob): Promise<string> {
  const id = uid('f'); const d = await idb()
  await new Promise<void>((res, rej) => { const t = d.transaction('files', 'readwrite'); t.objectStore('files').put(blob, id); t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
  return `idb:${id}`
}
async function getFile(id: string): Promise<Blob | undefined> {
  const d = await idb()
  return new Promise((res, rej) => { const r = d.transaction('files').objectStore('files').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
}
async function idbClear() { try { const d = await idb(); d.transaction('files', 'readwrite').objectStore('files').clear() } catch { /* ignore */ } }

const cache = new Map<string, Promise<string | undefined>>()
/** Converte "idb:..." em URL utilizável; outras URLs passam direto. */
export function resolveAsset(url?: string): Promise<string | undefined> {
  if (!url) return Promise.resolve(undefined)
  if (url.endsWith('.b64.json')) {
    // prévia hospedada no Claude: o .glb vem em base64 dentro de um JSON (ver build:claude-preview)
    if (!cache.has(url)) cache.set(url, fetch(url).then((r) => r.json()).then((j: { data: string }) =>
      URL.createObjectURL(new Blob([Uint8Array.from(atob(j.data), (c) => c.charCodeAt(0))], { type: 'model/gltf-binary' }))).catch(() => undefined))
    return cache.get(url)!
  }
  if (!url.startsWith('idb:')) return Promise.resolve(url)
  if (!cache.has(url)) cache.set(url, getFile(url.slice(4)).then((b) => (b ? URL.createObjectURL(b) : undefined)).catch(() => undefined))
  return cache.get(url)!
}
export function useAsset(url?: string) {
  const [out, setOut] = useState<string | undefined>(url && !url.startsWith('idb:') && !url.endsWith('.b64.json') ? url : undefined)
  useEffect(() => { let on = true; resolveAsset(url).then((u) => on && setOut(u)); return () => { on = false } }, [url])
  return out
}
