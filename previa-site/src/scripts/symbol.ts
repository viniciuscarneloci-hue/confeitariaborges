/** Geometria do símbolo Previa (manual v1.3, grade 64 × 64). */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/** Aro como forma cheia: espessura `top` no alto e `bottom` na base. */
export const ring = (cy: number, r: number, top: number, bottom: number) => {
  const rh = r - (top + bottom) / 2;
  const cyh = cy - r + top + rh;
  return circle(32, cy, r) + circle(32, cyh, rh);
};

export const dot = (cy: number, r: number) => circle(32, cy, r);

export const SYMBOL = {
  outer: ring(32, 27, 2.2, 3.8),
  inner: ring(37, 17, 1.7, 3.1),
  core: dot(42, 7),
};
