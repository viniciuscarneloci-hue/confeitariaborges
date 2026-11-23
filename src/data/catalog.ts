import type { Category, Product, FlavorLook } from './types'
import fotoGanacheLimao from '../ui/foto-ganache-limao.jpg'

export const CATEGORIES: Category[] = [
  { id: 'bolos-brancos', name: 'Bolos brancos', sort: 1 },
  { id: 'bolos-chocolate', name: 'Bolos chocolate', sort: 2 },
  { id: 'sobremesas', name: 'Sobremesas', sort: 3 },
  { id: 'bebidas', name: 'Bebidas', sort: 4 },
  { id: 'salgados', name: 'Salgados', sort: 5 },
  { id: 'velas', name: 'Velas', sort: 6 },
]

const FORMATS = [
  { format: 'quadrado' as const, min_kg: 1, max_kg: 10 },
  { format: 'redondo' as const, min_kg: 1, max_kg: 4 },
]
const MODELS = { redondo: 'models/bolo-redondo.glb', quadrado: 'models/bolo-quadrado.glb' }

const BRANCA = '#F3DFA9'
const CHOCO = '#5A3424'
const CHANT = '#FBF8F2'

function cake(id: string, category: Product['category_id'], name: string, price: number, description: string, look: FlavorLook, tags: string[] = []): Product {
  return { id, category_id: category, name, description, pricing: 'kg', price, serves_per_kg: 10, formats: FORMATS, look, model_3d: MODELS, channels: ['encomenda', 'pronta'], lead_time_hours: 24, tags }
}
function unit(id: string, category: Product['category_id'], name: string, price: number, description: string, icon: Product['icon'], channels: Product['channels'] = ['encomenda', 'pronta']): Product {
  return { id, category_id: category, name, description, pricing: 'unidade', price, icon, channels }
}

/** Os 16 bolos e preços abaixo são os do cardápio atual da loja. Demais itens são exemplos para o piloto. */
export const PRODUCTS: Product[] = [
  {
    // modelo 3D feito a partir das fotos do produto (tools/make_ganache_limao.py); quadrado segue o genérico
    ...cake('ganache-limao', 'bolos-brancos', 'Ganache de Limão', 109, 'Massa branca com ganache de limão siciliano e mousse branco.', { massa: BRANCA, recheio: '#E9EE9A', cobertura: CHANT, topping: 'limao' }),
    model_3d: { redondo: 'models/ganache-limao.glb', quadrado: MODELS.quadrado },
    model_ios: { redondo: 'models/ganache-limao.usdz' },
    default_format: 'redondo',
    photo: fotoGanacheLimao,
  },
  cake('ninho-doce-leite', 'bolos-brancos', 'Ninho com Doce de Leite', 118, 'Creme de leite Ninho com camadas de doce de leite.', { massa: BRANCA, recheio: '#D9A35F', cobertura: CHANT, topping: 'nenhum' }, ['Mais pedido']),
  cake('pistache', 'bolos-brancos', 'Pistache', 130, 'Creme de pistache com mousse branco.', { massa: BRANCA, recheio: '#B7C77A', cobertura: CHANT, topping: 'pistache' }),
  cake('delicia-morango', 'bolos-brancos', 'Delícia de Morango', 118, 'Moça morango com mousse branco e pedaços de morango.', { massa: BRANCA, recheio: '#F2A7B0', cobertura: CHANT, topping: 'morango' }),
  cake('pistache-morangos', 'bolos-brancos', 'Pistache com Morangos', 130, 'Recheio de creme de pistache com mousse de pistache e morangos.', { massa: BRANCA, recheio: '#B7C77A', cobertura: CHANT, topping: 'morango' }),
  cake('delicia-coco', 'bolos-brancos', 'Delícia de Coco', 130, 'Cocada cremosa com mousse branco e coco em flocos.', { massa: BRANCA, recheio: '#F7F1E1', cobertura: CHANT, topping: 'coco' }),
  cake('ninho-nutella', 'bolos-brancos', 'Ninho com Nutella', 130, 'Creme de Ninho com camadas generosas de Nutella.', { massa: BRANCA, recheio: '#6B3F2A', cobertura: CHANT, topping: 'chocolate' }),
  cake('abacaxi-doce-leite', 'bolos-brancos', 'Abacaxi com Doce de Leite', 118, 'Doce de leite com mousse branco e pedaços de abacaxi.', { massa: BRANCA, recheio: '#E8C15E', cobertura: CHANT, topping: 'abacaxi' }),
  cake('moca-nozes', 'bolos-brancos', 'Moça com Nozes', 130, 'Doce de leite com nozes trituradas e leite condensado.', { massa: BRANCA, recheio: '#C99A64', cobertura: CHANT, topping: 'nozes' }),
  cake('dois-amores', 'bolos-brancos', 'Dois Amores', 130, 'Brigadeiro branco e brigadeiro de chocolate em camadas.', { massa: BRANCA, recheio: '#7A4A33', cobertura: CHANT, topping: 'chocolate' }),
  cake('ninho-ovomaltine', 'bolos-brancos', 'Ninho com Ovomaltine', 118, 'Creme de Ninho com flocos crocantes de Ovomaltine.', { massa: BRANCA, recheio: '#C9A27A', cobertura: CHANT, topping: 'ovomaltine' }),
  cake('nutella-morango', 'bolos-brancos', 'Nutella com Morango', 118, 'Nutella com morangos frescos e mousse branco.', { massa: BRANCA, recheio: '#6B3F2A', cobertura: CHANT, topping: 'morango' }),
  cake('abacaxi-coco', 'bolos-brancos', 'Abacaxi com Coco', 118, 'Creme de abacaxi com coco e mousse branco.', { massa: BRANCA, recheio: '#EBD37A', cobertura: CHANT, topping: 'coco' }),
  cake('olho-sogra', 'bolos-brancos', 'Olho de Sogra', 118, 'Cocada com doce de leite e mousse branco com pedaços de ameixa.', { massa: BRANCA, recheio: '#D9B47A', cobertura: CHANT, topping: 'ameixa' }),
  cake('sonho-verao', 'bolos-brancos', 'Sonho de Verão', 130, 'Mousse branco com frutas vermelhas e creme de baunilha.', { massa: BRANCA, recheio: '#F5C6C2', cobertura: CHANT, topping: 'frutas' }),
  cake('ganache-maracuja', 'bolos-brancos', 'Ganache de Maracujá', 109, 'Mousse de maracujá com ganache de maracujá.', { massa: BRANCA, recheio: '#F3CF4E', cobertura: CHANT, topping: 'maracuja' }),

  cake('brigadeiro', 'bolos-chocolate', 'Brigadeiro', 118, 'Massa de chocolate, brigadeiro cremoso e granulado belga.', { massa: CHOCO, recheio: '#4A2A1C', cobertura: '#5B3626', topping: 'brigadeiro' }),
  cake('prestigio', 'bolos-chocolate', 'Prestígio', 118, 'Massa de chocolate com cocada cremosa e ganache.', { massa: CHOCO, recheio: '#F7F1E1', cobertura: '#5B3626', topping: 'coco' }),
  cake('choco-morango', 'bolos-chocolate', 'Chocolate com Morango', 130, 'Massa de chocolate, brigadeiro meio amargo e morangos.', { massa: CHOCO, recheio: '#F2A7B0', cobertura: '#5B3626', topping: 'morango' }),
  cake('trufado-ninho', 'bolos-chocolate', 'Trufado com Ninho', 130, 'Massa de chocolate, trufa ao leite e creme de Ninho.', { massa: CHOCO, recheio: '#F6EEDC', cobertura: CHANT, topping: 'chocolate' }),

  unit('pudim', 'sobremesas', 'Pudim de leite', 18, 'Fatia generosa, calda de caramelo.', 'pote'),
  unit('bolo-pote-ninho', 'sobremesas', 'Bolo de pote Ninho com Nutella', 16, 'Pote de 250 ml.', 'pote'),
  unit('torta-limao', 'sobremesas', 'Torta de limão (fatia)', 15, 'Base crocante, creme de limão e merengue.', 'torta'),
  unit('refri-2l', 'bebidas', 'Refrigerante 2 L', 14, 'Coca-Cola, Guaraná ou Fanta. Avise o sabor no WhatsApp.', 'garrafa'),
  unit('refri-lata', 'bebidas', 'Refrigerante lata', 6, '350 ml.', 'lata', ['pronta']),
  unit('cafe', 'bebidas', 'Café coado', 5, 'Copo de 200 ml.', 'cafe', ['pronta']),
  unit('cento-coxinha', 'salgados', 'Cento de coxinha', 95, '100 unidades de mini coxinha de frango.', 'coxinha', ['encomenda']),
  unit('cento-sortido', 'salgados', 'Cento de salgados sortidos', 99, 'Coxinha, bolinha de queijo, risole e quibe.', 'empada', ['encomenda']),
  unit('coxinha', 'salgados', 'Coxinha (unidade)', 8, 'Frango com catupiry.', 'coxinha', ['pronta']),
  unit('vela-numero', 'velas', 'Vela de número', 9, 'Dourada. Diga o número no WhatsApp.', 'vela-numero'),
  unit('vela-palito', 'velas', 'Velas palito (12 un.)', 7, 'Coloridas.', 'vela'),
  unit('vela-faisca', 'velas', 'Vela faísca', 12, 'Efeito chuvinha.', 'vela'),
]

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id)!
