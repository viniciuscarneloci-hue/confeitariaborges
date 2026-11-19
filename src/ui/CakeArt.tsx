import type { FlavorLook, Product } from '../data/types'

/** Ilustração de fatia de bolo gerada a partir do sabor (no produto final: foto/fotogrametria). */
export function CakeArt({ look, className }: { look: FlavorLook; className?: string }) {
  // fatia em perspectiva: face de corte à esquerda, lateral confeitada à direita
  const L = [18, 46], R = [100, 36], A = [70, 60] // topo: L (traseira esq.), R (traseira dir.), A (ponta frontal)
  const H = 38
  const bands: [number, string][] = [[0.26, look.massa], [0.1, look.recheio], [0.22, look.massa], [0.1, look.recheio], [0.22, look.massa], [0.1, look.cobertura]]
  // face de corte = quadrilátero L-A até a base; listras de cima para baixo
  let acc = 0.0
  const stripes = bands.reverse().map(([h, c], i) => {
    const y0 = acc * H, y1 = (acc + h) * H; acc += h
    return <polygon key={i} points={`${L[0]},${L[1] + y0} ${A[0]},${A[1] + y0} ${A[0]},${A[1] + y1} ${L[0]},${L[1] + y1}`} fill={c} />
  })
  const top = (
    <polygon points={`${L[0]},${L[1]} ${R[0]},${R[1]} ${A[0]},${A[1]}`} fill={look.cobertura} />
  )
  const side = <polygon points={`${A[0]},${A[1]} ${R[0]},${R[1]} ${R[0]},${R[1] + H} ${A[0]},${A[1] + H}`} fill={look.cobertura} />
  const shade = <polygon points={`${A[0]},${A[1]} ${R[0]},${R[1]} ${R[0]},${R[1] + H} ${A[0]},${A[1] + H}`} fill="#13264B" opacity="0.07" />
  const dollops = [[34, 46], [50, 45], [66, 43], [82, 40]].map(([x, y], i) => (
    <g key={i}>
      <ellipse cx={x} cy={y} rx="6.5" ry="5" fill={look.cobertura} />
      <ellipse cx={x - 1.5} cy={y - 1.8} rx="2.6" ry="1.6" fill="#fff" opacity="0.7" />
      <path d={`M${x - 5} ${y + 1} q5 -6 10 0`} stroke="#13264B" strokeOpacity="0.12" fill="none" strokeWidth="0.8" />
    </g>
  ))
  const top2 = topping(look)
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-hidden="true">
      <ellipse cx="60" cy="98" rx="50" ry="12" fill="#C9A45B" opacity="0.9" />
      <ellipse cx="60" cy="96" rx="46" ry="10" fill="#E2C584" />
      {stripes}
      {side}{shade}
      {top}
      {dollops}
      {top2}
    </svg>
  )
}

function topping(look: FlavorLook) {
  const at = [[34, 40], [58, 38], [80, 35]]
  switch (look.topping) {
    case 'morango': case 'frutas':
      return at.map(([x, y], i) => <g key={i}><path d={`M${x - 5} ${y} q5 -11 10 0 q-5 8 -10 0z`} fill={i === 1 && look.topping === 'frutas' ? '#6B2A5A' : '#D7263D'} /><path d={`M${x - 3} ${y - 6} l3 -2 l3 2`} stroke="#3F8F3A" strokeWidth="1.6" fill="none" /></g>)
    case 'pistache':
      return at.flatMap(([x, y], i) => [0, 1, 2].map((k) => <circle key={i * 3 + k} cx={x - 3 + k * 3} cy={y + (k % 2) * 2} r="1.6" fill="#7FA34A" />))
    case 'coco':
      return [0, 1, 2, 3, 4, 5, 6, 7].map((k) => <rect key={k} x={30 + k * 7} y={38 - (k % 3)} width="4" height="1.4" rx="0.7" fill="#FFFFFF" stroke="#E7DCC7" strokeWidth="0.3" transform={`rotate(${k * 37} ${32 + k * 7} 38)`} />)
    case 'chocolate': case 'brigadeiro':
      return at.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="4.4" fill="#4A2A1C" />{look.topping === 'brigadeiro' && <circle cx={x - 1.2} cy={y - 1.4} r="1" fill="#7A5240" />}</g>)
    case 'nozes': case 'ovomaltine':
      return at.map(([x, y], i) => <path key={i} d={`M${x - 4} ${y} q2 -5 4 -2 q2 -4 4 1 q-3 4 -8 1z`} fill={look.topping === 'nozes' ? '#9B6B3E' : '#8A5A2B'} />)
    case 'limao':
      return at.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="4.4" fill="#C9DB4E" /><circle cx={x} cy={y} r="3.2" fill="#EEF4A8" /></g>)
    case 'maracuja':
      return at.map(([x, y], i) => <g key={i}><ellipse cx={x} cy={y} rx="5" ry="3.4" fill="#F2B632" /><circle cx={x - 1} cy={y} r="0.9" fill="#2D1B10" /><circle cx={x + 1.5} cy={y - 0.6} r="0.9" fill="#2D1B10" /></g>)
    case 'abacaxi':
      return at.map(([x, y], i) => <rect key={i} x={x - 3.5} y={y - 3.5} width="7" height="6" rx="1.5" fill="#F0C43A" />)
    case 'ameixa':
      return at.map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="4" ry="3" fill="#3B1E2E" />)
    default:
      return null
  }
}

export function ItemIcon({ icon, className }: { icon: NonNullable<Product['icon']>; className?: string }) {
  const navy = '#13264B'
  const body = (() => {
    switch (icon) {
      case 'pote': return <g><rect x="38" y="40" width="44" height="52" rx="8" fill="#F6EEDC" /><rect x="38" y="62" width="44" height="10" fill="#C99A64" /><rect x="38" y="80" width="44" height="6" fill="#6B3F2A" /><rect x="34" y="32" width="52" height="12" rx="4" fill={navy} /></g>
      case 'torta': return <g><path d="M24 80 L96 66 L96 82 L24 94 Z" fill="#D9B47A" /><path d="M24 70 L96 56 L96 66 L24 80 Z" fill="#EEF4A8" /><path d="M24 60 q12 -14 24 -4 q12 -14 24 -6 q12 -12 24 -6 L96 56 L24 70Z" fill="#FBF8F2" /></g>
      case 'garrafa': return <g><rect x="48" y="22" width="24" height="10" rx="3" fill={navy} /><path d="M50 32 h20 l6 18 v42 a6 6 0 0 1 -6 6 h-20 a6 6 0 0 1 -6 -6 v-42z" fill="#3E2216" /><rect x="44" y="58" width="32" height="16" fill="#D7263D" /></g>
      case 'lata': return <g><rect x="42" y="30" width="36" height="62" rx="6" fill="#D7263D" /><rect x="42" y="30" width="36" height="8" rx="4" fill="#C4C9D2" /><rect x="42" y="56" width="36" height="12" fill="#fff" opacity=".85" /></g>
      case 'cafe': return <g><path d="M36 44 h44 l-5 46 a6 6 0 0 1 -6 5 h-22 a6 6 0 0 1 -6 -5z" fill="#fff" stroke={navy} strokeWidth="3" /><rect x="40" y="58" width="36" height="12" fill={navy} /><path d="M52 24 q6 6 0 12 M64 24 q6 6 0 12" stroke="#9CCBEA" strokeWidth="3" fill="none" /></g>
      case 'coxinha': return <g><path d="M60 26 q30 40 22 58 a22 14 0 0 1 -44 0 q-8 -18 22 -58z" fill="#D58A3B" /><path d="M60 26 q30 40 22 58" stroke="#B26A25" strokeWidth="2" fill="none" /></g>
      case 'empada': return <g><path d="M30 60 h60 l-8 30 h-44z" fill="#E2A65A" /><ellipse cx="60" cy="60" rx="30" ry="10" fill="#F0C27A" /><circle cx="60" cy="56" r="4" fill="#D58A3B" /></g>
      case 'vela': return <g>{[40, 54, 68, 82].map((x, i) => <g key={i}><rect x={x - 3} y="44" width="6" height="46" rx="2" fill={['#9CCBEA', '#F2A7B0', '#E9EE9A', '#B7C77A'][i]} /><path d={`M${x} 32 q5 6 0 10 q-5 -4 0 -10z`} fill="#F2B632" /></g>)}</g>
      case 'vela-numero': return <g><path d="M48 40 q12 -12 24 0 q6 10 -18 40 h22 v10 h-36 v-8 q26 -28 18 -36 q-6 -6 -12 2z" fill="#C9A45B" /><path d="M60 22 q5 6 0 10 q-5 -4 0 -10z" fill="#F2B632" /></g>
    }
  })()
  return <svg viewBox="0 0 120 120" className={className} aria-hidden="true">{body}</svg>
}

export function ProductArt({ p, className }: { p: Product; className?: string }) {
  return p.look ? <CakeArt look={p.look} className={className} /> : <ItemIcon icon={p.icon!} className={className} />
}
