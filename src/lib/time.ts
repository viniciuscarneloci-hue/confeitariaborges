import type { Store } from '../data/types'

const TZ = 'America/Sao_Paulo'
export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Data/hora "de parede" em São Paulo */
export function spNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const date = `${get('year')}-${get('month')}-${get('day')}`
  return { date, weekday: wd, minutes: +get('hour') * 60 + +get('minute'), hour: +get('hour') }
}

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
export const weekdayOf = (iso: string) => new Date(iso + 'T12:00:00Z').getUTCDay()
export const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const longDay = (iso: string) => `${WEEKDAYS_SHORT[weekdayOf(iso)]}, ${dayLabel(iso)}`
const hm = (m: number) => (m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60}h`)

export type OpenState = { open: true; closesAt: string } | { open: false; reopens: string; reopensShort: string }

export function storeOpenState(store: Store, now = spNow()): OpenState {
  const today = store.hours[now.weekday]
  if (today && now.minutes >= today.open && now.minutes < today.close) return { open: true, closesAt: hm(today.close) }
  for (let i = 0; i < 8; i++) {
    const wd = (now.weekday + i) % 7
    const hrs = store.hours[wd]
    if (!hrs) continue
    if (i === 0 && now.minutes >= hrs.open) continue
    const when = i === 0 ? 'hoje' : i === 1 ? `amanhã (${WEEKDAYS[wd]})` : WEEKDAYS[wd]
    return { open: false, reopens: `${when} às ${hm(hrs.open)}`, reopensShort: `${i === 1 ? 'amanhã' : when} ${hm(hrs.open)}` }
  }
  return { open: false, reopens: 'em breve', reopensShort: 'em breve' }
}

export function hoursSummary(store: Store) {
  return store.hours.map((h, i) => ({ day: WEEKDAYS[i], text: h ? `${hm(h.open)} às ${hm(h.close)}` : 'Fechado' }))
}
