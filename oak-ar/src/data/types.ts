/**
 * Modelo de dados do Oak AR.
 * Cada interface espelha uma tabela do banco (Supabase/Postgres) — ver supabase/schema.sql.
 * Multi-restaurante: um único banco e toda tabela carrega `restaurant_id`.
 * A Row Level Security garante que cada dono só enxerga e altera o próprio restaurante.
 */

export type UUID = string
export type ISODateTime = string

/** tabela: restaurants */
export interface Restaurant {
  id: UUID
  slug: string // endereço público: /#/r/<slug>
  name: string
  tagline: string
  cuisine: string
  accent: string // cor da marca (hex)
  city: string
  whatsapp?: string
  created_at: ISODateTime
}

/** tabela: categories */
export interface Category { id: UUID; restaurant_id: UUID; name: string; sort: number }

export type DishTag = 'vegetariano' | 'vegano' | 'sem-gluten' | 'picante' | 'mais-pedido' | 'novo'

/** Modelo 3D publicado de um prato (um prato tem no máximo um modelo publicado). */
export interface DishModel {
  /** URL do .glb (Android, WebXR e prévia 3D). Pode ser blob: quando veio de um envio local no modo demonstração. */
  glb: string
  /** URL do .usdz (Quick Look do iPhone). Quando ausente, o model-viewer gera o USDZ a partir do .glb. */
  usdz?: string
  /** Pôster mostrado enquanto o 3D carrega e no cartão do cardápio. */
  poster?: string
  /** Escala aplicada para o prato aparecer no tamanho real. 1 = o arquivo já está em metros. */
  scale: number
  /** Rotação em graus em torno do eixo vertical (para a "frente" do prato ficar virada para o cliente). */
  yaw: number
  /** Tamanho real medido no modelo já escalado, em centímetros. */
  size_cm: { w: number; h: number; d: number }
  source: 'fotogrametria' | 'arquivo' | 'demonstracao'
  capture_id?: UUID
  published_at: ISODateTime
}

/** tabela: dishes */
export interface Dish {
  id: UUID
  restaurant_id: UUID
  category_id: UUID
  name: string
  description: string
  price: number
  tags: DishTag[]
  serves?: string // "serve 1 pessoa"
  /** Diâmetro real do prato/recipiente em cm, informado pelo dono. Usado para calibrar a escala do scan. */
  plate_cm?: number
  available: boolean
  model?: DishModel
  /** Só na demonstração: qual modelo de exemplo o "scan simulado" devolve para este prato. */
  demo_model?: string
  sort: number
}

export type CaptureSource = 'video-camera' | 'video-arquivo' | 'fotos' | 'arquivo-3d'
export type CaptureStatus = 'enviando' | 'na-fila' | 'processando' | 'otimizando' | 'revisao' | 'publicado' | 'falhou' | 'descartado'

/** Relatório de qualidade da captura, calculado no navegador antes de enviar. */
export interface CaptureQuality {
  duration_s?: number
  width?: number
  height?: number
  frames_total: number
  frames_used: number
  sharpness: number // 0..1
  brightness: number // 0..1
  score: number // 0..100
  tips: string[]
}

/** tabela: captures — cada tentativa de gerar o 3D de um prato. */
export interface Capture {
  id: UUID
  restaurant_id: UUID
  dish_id: UUID
  created_at: ISODateTime
  source: CaptureSource
  provider: 'proprio' | 'demo' | 'arquivo'
  /** id da tarefa no worker de fotogrametria. */
  provider_task?: string
  status: CaptureStatus
  stage: string
  progress: number // 0..100
  quality?: CaptureQuality
  thumb?: string // dataURL pequeno
  /** Resultado (antes da publicação). */
  result?: { glb: string; usdz?: string; triangles?: number; size_kb?: number }
  error?: string
}

/** tabela: events — telemetria anônima do cardápio (vira métrica no painel). */
export interface MenuEvent { restaurant_id: UUID; dish_id?: UUID; type: 'menu_aberto' | 'prato_aberto' | 'ver_3d' | 'ver_ra' | 'adicionou'; at: ISODateTime }
