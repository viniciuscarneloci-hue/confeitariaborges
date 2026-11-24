import type { Category, Dish, DishModel, Restaurant } from './types'

/** Dados de demonstração: dois restaurantes para mostrar que a plataforma é multi-restaurante. */

const T0 = '2026-11-20T12:00:00-03:00'

export const DEMO_MODELS: Record<string, { glb: string; poster: string; size_cm: DishModel['size_cm'] }> = {
  pizza: { glb: 'models/pizza-margherita.glb', poster: 'posters/pizza-margherita.webp', size_cm: { w: 34, h: 4.4, d: 34 } },
  burger: { glb: 'models/hamburguer-artesanal.glb', poster: 'posters/hamburguer-artesanal.webp', size_cm: { w: 26.1, h: 10.4, d: 26.1 } },
  poke: { glb: 'models/poke-de-salmao.glb', poster: 'posters/poke-de-salmao.webp', size_cm: { w: 19.4, h: 7.7, d: 19.4 } },
  dessert: { glb: 'models/petit-gateau.glb', poster: 'posters/petit-gateau.webp', size_cm: { w: 24.1, h: 5.4, d: 24.1 } },
}

const demo = (k: keyof typeof DEMO_MODELS, yaw = 0): DishModel => ({
  glb: DEMO_MODELS[k].glb, poster: DEMO_MODELS[k].poster, scale: 1, yaw, size_cm: DEMO_MODELS[k].size_cm,
  source: 'demonstracao', published_at: T0,
})

export const SEED_RESTAURANTS: Restaurant[] = [
  { id: 'r-casa', slug: 'casa-oak', name: 'Casa Oak', tagline: 'Cozinha contemporânea, forno a lenha', cuisine: 'Contemporânea', accent: '#B4532A', city: 'São Paulo', whatsapp: '5511900000000', created_at: T0 },
  { id: 'r-brasa', slug: 'brasa-burger', name: 'Brasa Burger', tagline: 'Hambúrguer na brasa desde 2019', cuisine: 'Hamburgueria', accent: '#1F6E5A', city: 'Curitiba', created_at: T0 },
]

export const SEED_CATEGORIES: Category[] = [
  { id: 'c-entradas', restaurant_id: 'r-casa', name: 'Entradas', sort: 1 },
  { id: 'c-principais', restaurant_id: 'r-casa', name: 'Pratos principais', sort: 2 },
  { id: 'c-pizzas', restaurant_id: 'r-casa', name: 'Pizzas', sort: 3 },
  { id: 'c-sobremesas', restaurant_id: 'r-casa', name: 'Sobremesas', sort: 4 },
  { id: 'c-bebidas', restaurant_id: 'r-casa', name: 'Bebidas', sort: 5 },
  { id: 'b-burgers', restaurant_id: 'r-brasa', name: 'Burgers', sort: 1 },
  { id: 'b-acomp', restaurant_id: 'r-brasa', name: 'Acompanhamentos', sort: 2 },
  { id: 'b-doces', restaurant_id: 'r-brasa', name: 'Doces', sort: 3 },
]

export const SEED_DISHES: Dish[] = [
  // Casa Oak
  { id: 'd-burrata', restaurant_id: 'r-casa', category_id: 'c-entradas', name: 'Burrata com tomates assados', description: 'Burrata cremosa, tomates confitados, pesto de manjericão e pão de fermentação natural.', price: 58, tags: ['vegetariano'], serves: 'Serve 2 pessoas', plate_cm: 24, available: true, demo_model: 'dessert', sort: 1 },
  { id: 'd-poke', restaurant_id: 'r-casa', category_id: 'c-principais', name: 'Poke de salmão', description: 'Arroz japonês, salmão fresco em cubos, abacate, edamame, pepino, gergelim e cebolinha. Molho shoyu cítrico à parte.', price: 64, tags: ['mais-pedido', 'sem-gluten'], serves: 'Serve 1 pessoa', plate_cm: 19, available: true, model: demo('poke'), demo_model: 'poke', sort: 1 },
  { id: 'd-risoto', restaurant_id: 'r-casa', category_id: 'c-principais', name: 'Risoto de cogumelos', description: 'Arbóreo, mix de cogumelos frescos, parmesão 18 meses e azeite trufado.', price: 72, tags: ['vegetariano'], serves: 'Serve 1 pessoa', plate_cm: 26, available: true, demo_model: 'poke', sort: 2 },
  { id: 'd-pizza', restaurant_id: 'r-casa', category_id: 'c-pizzas', name: 'Pizza margherita', description: 'Massa de longa fermentação assada no forno a lenha, molho de tomate San Marzano, muçarela fior di latte e manjericão.', price: 69, tags: ['vegetariano', 'mais-pedido'], serves: '8 pedaços · 34 cm', plate_cm: 34, available: true, model: demo('pizza'), demo_model: 'pizza', sort: 1 },
  { id: 'd-calabresa', restaurant_id: 'r-casa', category_id: 'c-pizzas', name: 'Pizza de calabresa artesanal', description: 'Calabresa da casa, cebola roxa, azeitonas pretas e orégano fresco.', price: 74, tags: ['picante'], serves: '8 pedaços · 34 cm', plate_cm: 34, available: true, demo_model: 'pizza', sort: 2 },
  { id: 'd-petit', restaurant_id: 'r-casa', category_id: 'c-sobremesas', name: 'Petit gâteau', description: 'Bolinho de chocolate 70% com centro derretido, sorvete de baunilha, morangos e calda quente.', price: 34, tags: ['novo'], serves: 'Serve 1 pessoa', plate_cm: 24, available: true, model: demo('dessert'), demo_model: 'dessert', sort: 1 },
  { id: 'd-limonada', restaurant_id: 'r-casa', category_id: 'c-bebidas', name: 'Limonada siciliana', description: 'Limão siciliano espremido na hora, hortelã e água com gás.', price: 16, tags: ['vegano'], serves: '400 ml', available: true, sort: 1 },
  // Brasa Burger
  { id: 'b-classico', restaurant_id: 'r-brasa', category_id: 'b-burgers', name: 'Brasa clássico', description: 'Blend de 180 g na brasa, cheddar inglês, alface, tomate e maionese da casa no pão brioche. Acompanha fritas.', price: 42, tags: ['mais-pedido'], serves: 'Serve 1 pessoa', plate_cm: 26, available: true, model: demo('burger'), demo_model: 'burger', sort: 1 },
  { id: 'b-duplo', restaurant_id: 'r-brasa', category_id: 'b-burgers', name: 'Duplo bacon', description: 'Dois blends de 120 g, bacon crocante, cheddar duplo e cebola caramelizada.', price: 49, tags: [], serves: 'Serve 1 pessoa', plate_cm: 26, available: true, demo_model: 'burger', sort: 2 },
  { id: 'b-fritas', restaurant_id: 'r-brasa', category_id: 'b-acomp', name: 'Fritas rústicas', description: 'Batata com casca, alecrim e flor de sal.', price: 22, tags: ['vegano'], serves: 'Para dividir', available: true, sort: 1 },
  { id: 'b-brownie', restaurant_id: 'r-brasa', category_id: 'b-doces', name: 'Brownie com sorvete', description: 'Brownie quente com sorvete de creme e calda de chocolate.', price: 26, tags: [], serves: 'Serve 1 pessoa', plate_cm: 24, available: true, demo_model: 'dessert', sort: 1 },
]
