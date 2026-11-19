import type { Store } from './types'

const h = (o: number, c: number) => ({ open: o * 60, close: c * 60 })
// dom, seg, ter, qua, qui, sex, sáb
const PADRAO = [h(9, 14), null, h(10, 19), h(10, 19), h(10, 19), h(10, 19), h(9, 19)]

function store(id: string, name: string, city: string, address: string, extra: Partial<Store> = {}): Store {
  return {
    id, slug: id, name, city, address,
    whatsapp: '5511900000000', // número fictício do piloto — trocar pelo de cada loja
    instagram: 'confeitariaborges', is_flagship: false, opened_at: '2023-01-01',
    hours: PADRAO, accepts_orders_when_closed: true, delivery: true, ...extra,
  }
}

/** 12 lojas da rede. As 5 primeiras foram citadas pela marca; as demais são exemplos para o piloto. */
export const STORES: Store[] = [
  store('santo-andre', 'Santo André', 'Santo André, SP', 'Endereço da loja', { opened_at: '2022-03-12' }),
  store('jardim-tiete', 'Jardim Tietê', 'São Paulo, SP', 'Matriz', { is_flagship: true, opened_at: '2019-05-01' }),
  store('sao-mateus', 'São Mateus', 'São Paulo, SP', 'Endereço da loja', { opened_at: '2021-08-02' }),
  store('jardim-brasilia', 'Jardim Brasília', 'São Paulo, SP', 'Endereço da loja', { opened_at: '2022-10-10' }),
  store('americana', 'Maria Luiza', 'Americana, SP', 'Endereço da loja', { opened_at: '2024-02-15' }),
  store('vila-formosa', 'Vila Formosa', 'São Paulo, SP', 'Endereço da loja', { opened_at: '2023-04-01' }),
  store('itaquera', 'Itaquera', 'São Paulo, SP', 'Endereço da loja', { opened_at: '2023-06-20' }),
  store('maua', 'Mauá', 'Mauá, SP', 'Endereço da loja', { opened_at: '2023-09-05' }),
  store('guaianases', 'Guaianases', 'São Paulo, SP', 'Endereço da loja', { opened_at: '2024-01-10' }),
  store('sao-bernardo', 'São Bernardo', 'São Bernardo do Campo, SP', 'Endereço da loja', { opened_at: '2024-05-18' }),
  store('ferraz', 'Ferraz', 'Ferraz de Vasconcelos, SP', 'Endereço da loja', { opened_at: '2025-03-01' }),
  store('guarulhos', 'Guarulhos', 'Guarulhos, SP', 'Endereço da loja', { opened_at: '2025-08-22' }),
]

export const storeById = (id: string) => STORES.find((s) => s.id === id) ?? STORES[0]
export const PILOT_STORE = 'santo-andre'
