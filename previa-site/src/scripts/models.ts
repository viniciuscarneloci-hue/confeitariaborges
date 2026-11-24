/** Pratos da demonstração e carregamento do model-viewer sob demanda. */
export interface Dish { id: string; name: string; detail: string; data: string; price: string }

export const DISHES: Dish[] = [
  { id: 'pizza-margherita', name: 'Pizza margherita', detail: 'Tomate San Marzano, muçarela de búfala, manjericão', data: '32 cm · serve 2', price: 'R$ 68' },
  { id: 'poke-de-salmao', name: 'Poke de salmão', detail: 'Arroz de sushi, salmão, avocado, gergelim', data: '420 g · 610 kcal', price: 'R$ 54' },
  { id: 'hamburguer-artesanal', name: 'Hambúrguer artesanal', detail: 'Blend de 180 g, cheddar inglês, pão de brioche', data: '380 g · serve 1', price: 'R$ 49' },
  { id: 'petit-gateau', name: 'Petit gâteau', detail: 'Chocolate 70%, sorvete de baunilha', data: '160 g · contém lactose', price: 'R$ 32' },
];

let viewer: Promise<unknown> | undefined;
export const loadViewer = () => (viewer ??= import('@google/model-viewer'));

/* Na prévia hospedada no Claude o .glb não é servido; o build de prévia gera
   models/<id>.glb.b64.json e marca a página com data-preview. */
const cache = new Map<string, Promise<string>>();
export function modelSrc(id: string): Promise<string> {
  if (!document.documentElement.hasAttribute('data-preview')) return Promise.resolve(`models/${id}.glb`);
  if (!cache.has(id)) {
    cache.set(id, fetch(`models/${id}.glb.b64.json`).then(r => r.json()).then((b64: string) => {
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      return URL.createObjectURL(new Blob([bin], { type: 'model/gltf-binary' }));
    }));
  }
  return cache.get(id)!;
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
