import { useEffect, useRef, useState } from 'react'

/** Colunas de uma série, com escala única, ticks redondos e tooltip ao passar o dedo/mouse. */
export function Columns({ data, format, tickFormat, height = 200, ariaLabel }: {
  data: { label: string; value: number; sub?: string }[]; format: (v: number) => string; tickFormat: (v: number) => string; height?: number; ariaLabel: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = box.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el); return () => ro.disconnect()
  }, [])
  const H = height, padL = 52, padB = 26, padT = 12, padR = 8
  const max = Math.max(1, ...data.map((d) => d.value))
  const step = niceStep(max / 4); const top = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / top)
  const band = (W - padL - padR) / data.length
  const bw = Math.min(24, band * 0.62)
  const every = Math.ceil(data.length / Math.max(4, Math.floor(W / 64)))
  const peak = data.reduce((bi, d, i) => (d.value > data[bi].value ? i : bi), 0)
  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="grid" /><text x={padL - 8} y={y(t) + 4} className="tick" textAnchor="end">{tickFormat(t)}</text></g>
        ))}
        {data.map((d, i) => {
          const x = padL + band * i + (band - bw) / 2; const h = Math.max(0, y(0) - y(d.value)); const r = Math.min(4, h / 2, bw / 2)
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect x={padL + band * i} y={padT} width={band} height={H - padT - padB} fill="transparent" />
              <path d={`M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z`} className={'bar' + (hover === i ? ' hot' : '') + (hover === null && i === data.length - 1 ? ' last' : '')} />
              {i % every === 0 && <text x={padL + band * i + band / 2} y={H - 8} className="tick" textAnchor="middle">{d.label}</text>}
            </g>
          )
        })}
        {hover === null && data[peak]?.value > 0 && data.length > 1 && (
          <text x={padL + band * peak + band / 2} y={y(data[peak].value) - 6} className="peak" textAnchor="middle">{tickFormat(data[peak].value)}</text>
        )}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ left: `${((padL + band * hover + band / 2) / W) * 100}%` }}>
          <strong>{format(data[hover].value)}</strong><span>{data[hover].label}{data[hover].sub ? ` · ${data[hover].sub}` : ''}</span>
        </div>
      )}
    </div>
  )
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))); const n = raw / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

/** Barras horizontais com rótulo e valor na ponta (uma série). */
export function HBars({ rows, format, highlight, tone = 'navy' }: { rows: { id: string; label: string; value: number; note?: string }[]; format: (v: number) => string; highlight?: string; tone?: 'navy' | 'gold' }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className={'hbars ' + tone}>
      {rows.map((r) => (
        <li key={r.id} className={highlight === r.id ? 'hl' : ''} title={`${r.label}: ${format(r.value)}`}>
          <span className="hb-label">{r.label}{r.note && <small>{r.note}</small>}</span>
          <span className="hb-track"><span className="hb-bar" style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="hb-val">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Barra segmentada (um todo dividido em partes) com legenda. */
export function Segmented({ parts }: { parts: { label: string; value: number; cls: string; fmt: string }[] }) {
  const tot = parts.reduce((s, p) => s + p.value, 0) || 1
  return (
    <div className="segbar">
      <div className="segbar-track" role="img" aria-label={parts.map((p) => `${p.label}: ${p.fmt}`).join(', ')}>
        {parts.map((p) => p.value > 0 && <span key={p.label} className={p.cls} style={{ flexGrow: p.value / tot }} title={`${p.label}: ${p.fmt}`} />)}
      </div>
      <ul className="legend">
        {parts.map((p) => <li key={p.label}><i className={p.cls} /> {p.label} <strong>{p.fmt}</strong></li>)}
      </ul>
    </div>
  )
}
