/** Gerador pseudoaleatório determinístico: os mesmos números a cada abertura do piloto. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function hash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
export const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)]
export function weighted<T>(r: () => number, items: [T, number][]) {
  const tot = items.reduce((s, [, w]) => s + w, 0); let x = r() * tot
  for (const [v, w] of items) { if ((x -= w) <= 0) return v }
  return items[items.length - 1][0]
}
