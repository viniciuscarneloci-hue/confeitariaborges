/**
 * Modelo de dados do piloto.
 * Cada interface espelha uma tabela do futuro banco Supabase (Postgres) — ver supabase-schema.sql.
 * Multi-tenant: um único banco, e toda tabela operacional carrega `store_id`.
 * A Row Level Security (RLS) garante que o franqueado só enxerga a própria loja
 * e que a franqueadora (role = 'franqueadora') enxerga todas.
 */

export type UUID = string
export type ISODate = string // '2026-11-19'
export type ISODateTime = string // '2026-11-19T15:04:00-03:00'

/** tabela: stores */
export interface Store {
  id: UUID
  slug: string
  name: string // "Santo André"
  city: string
  address: string
  whatsapp: string // E.164 sem '+', ex.: 5511900000000
  instagram: string
  is_flagship: boolean
  opened_at: ISODate
  /** horário por dia da semana (0 = domingo). null = fechado o dia todo. Minutos desde 00:00. */
  hours: ({ open: number; close: number } | null)[]
  /** aceita encomendas mesmo fechada */
  accepts_orders_when_closed: boolean
  delivery: boolean
}

export type CategoryId = 'bolos-brancos' | 'bolos-chocolate' | 'sobremesas' | 'bebidas' | 'salgados' | 'velas'

/** tabela: categories (catálogo central da franqueadora) */
export interface Category { id: CategoryId; name: string; sort: number }

export type CakeFormat = 'redondo' | 'quadrado'

/** Aparência do sabor — usada na ilustração e para tingir o modelo 3D. */
export interface FlavorLook {
  massa: string
  recheio: string
  cobertura: string
  topping: 'morango' | 'pistache' | 'coco' | 'chocolate' | 'nozes' | 'limao' | 'maracuja' | 'abacaxi' | 'ovomaltine' | 'ameixa' | 'frutas' | 'brigadeiro' | 'nenhum'
}

/** tabela: products (catálogo central; cada loja pode sobrescrever preço/disponibilidade em store_products) */
export interface Product {
  id: UUID
  category_id: CategoryId
  name: string
  description: string
  /** 'kg' = bolo vendido por quilo (encomenda) | 'unidade' = item unitário */
  pricing: 'kg' | 'unidade'
  price: number // R$/kg ou R$/unidade
  serves_per_kg?: number // bolos: pessoas por kg
  formats?: { format: CakeFormat; min_kg: number; max_kg: number }[]
  look?: FlavorLook
  icon?: 'pote' | 'garrafa' | 'lata' | 'cafe' | 'coxinha' | 'empada' | 'vela' | 'vela-numero' | 'torta'
  model_3d?: { redondo: string; quadrado: string } // caminho do .glb (fotogrametria no produto final)
  /** .usdz feito à mão para o iPhone (Quick Look); sem ele o model-viewer gera um a partir do .glb */
  model_ios?: { redondo?: string; quadrado?: string }
  /** formato que abre primeiro (ex.: o do modelo feito a partir de fotos) */
  default_format?: CakeFormat
  /** foto real do produto (no lugar da ilustração) */
  photo?: string
  /** canais em que o produto aparece */
  channels: ('encomenda' | 'pronta')[]
  lead_time_hours?: number // antecedência mínima da encomenda
  tags?: string[]
}

/** tabela: store_products — sobrescritas por loja */
export interface StoreProduct { store_id: UUID; product_id: UUID; active: boolean; price_override?: number; stock?: number }

/** tabela: ready_items — bolos físicos na vitrine (pronta entrega), cada um com peso real */
export interface ReadyItem {
  id: UUID
  store_id: UUID
  product_id: UUID
  format: CakeFormat
  weight_g: number
  price_per_kg: number
  discount_pct: number // 0..1
  status: 'disponivel' | 'reservado' | 'vendido'
}

export type OrderMode = 'encomenda' | 'agora'
export type Fulfillment = 'retirada' | 'entrega'

/**
 * tabela: orders
 * Ciclo de vida: o cliente envia pelo WhatsApp → 'aguardando_pagamento'.
 * Só vira 'pago' quando um pagamento real (Asaas / Open Finance) é conciliado.
 * Se ninguém pagar até o prazo, vira 'sem_pagamento' e NÃO entra no faturamento.
 */
export type OrderStatus = 'aguardando_pagamento' | 'pago' | 'sem_pagamento' | 'cancelado'

export interface Order {
  id: UUID
  code: string // código curto que vai na mensagem do WhatsApp, ex.: SA-4827
  store_id: UUID
  created_at: ISODateTime
  channel: 'cardapio_whatsapp' | 'balcao'
  mode: OrderMode
  fulfillment: Fulfillment
  scheduled_for?: ISODate
  scheduled_period?: 'manha' | 'tarde'
  total: number
  status: OrderStatus
  /** lead capturado no WhatsApp (preenchido pela loja/integração depois) */
  customer_name?: string
  customer_phone?: string
  payment_id?: UUID
  items: OrderItem[]
}

/** tabela: order_items */
export interface OrderItem {
  product_id: UUID
  name: string
  qty: number
  format?: CakeFormat
  weight_kg?: number
  ready_item_id?: UUID
  unit_price: number
  total: number
  notes?: string
}

/** tabela: payments — só números, vindos do Asaas (Pix/cartão online) ou do Open Finance (conta da loja/maquininha). Somente leitura. */
export interface Payment {
  id: UUID
  store_id: UUID
  received_at: ISODateTime
  amount: number
  method: 'pix' | 'credito' | 'debito'
  source: 'asaas' | 'open_finance'
  /** texto que veio na transação (ex.: descrição do Pix com o código do pedido) */
  reference?: string
  order_id?: UUID
}

export type CostCategory = 'funcionarios' | 'aluguel' | 'insumos' | 'embalagens' | 'energia_agua' | 'taxas_cartao' | 'royalties' | 'marketing' | 'outros'

/** tabela: costs — lançados à mão pelo franqueado ou importados do Open Finance */
export interface Cost {
  id: UUID
  store_id: UUID
  date: ISODate
  category: CostCategory
  description: string
  amount: number
  source: 'manual' | 'open_finance'
  recurring: boolean
}

/** view materializada: daily_store_metrics — o painel lê daqui (rápido e barato) */
export interface DailyMetric {
  store_id: UUID
  date: ISODate
  orders_sent: number // enviados ao WhatsApp
  orders_paid: number // conciliados com pagamento
  revenue_orders: number // pagamentos conciliados com pedidos do cardápio
  counter_revenue: number // vendas de balcão na maquininha (Open Finance), sem pedido
  unpaid_value: number // valor dos pedidos que não viraram pagamento (fora do faturamento)
}

/** tabela: profiles (auth.users do Supabase) */
export interface Profile { id: UUID; name: string; role: 'franqueado' | 'franqueadora'; store_id?: UUID }
