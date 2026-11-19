export function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem('borges:' + key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem('borges:' + key, JSON.stringify(value)) } catch { /* modo privado */ }
}
