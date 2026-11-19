const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const money = (v: number) => brl.format(v)
export const moneyShort = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return 'R$ ' + (v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi'
  if (a >= 10_000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil'
  if (a >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'
  return brl.format(v)
}
export const int = (v: number) => Math.round(v).toLocaleString('pt-BR')
export const kg = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })) + ' kg'
export const grams = (g: number) => (g >= 1000 ? (g / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg' : g + ' g')
export const pct = (v: number) => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'
