# Piloto Confeitaria Borges (cardápio 3D + painel)

Cardápio: https://claude.ai/artifact/GSgeN7WYSBo1ASeeKJKAuQ · Painel: mesmo link com `#painel`.

## Publicar na Vercel
1. Suba esta pasta para um repositório no GitHub.
2. Na Vercel: New Project > importe o repositório. Framework: Vite. Build: `npm run build`. Output: `dist`.
3. O cardápio fica em `https://SEU-PROJETO.vercel.app/` e o painel em `https://SEU-PROJETO.vercel.app/#painel`.

Os modelos 3D ficam em `public/models/*.glb` (gerados por `npm run models`). Para trocar por fotogrametria, substitua os .glb.

- `src/data/types.ts`: modelo de dados espelhando o Supabase. `supabase-schema.sql`: tabelas + RLS.
- `src/data/mock.ts`: dados simulados e a conciliação pedido x pagamento (`reconcile`).
- 16 bolos e preços são reais; demais produtos, 7 das 12 lojas e o WhatsApp são exemplos.

## Ganache de Limão: modelo feito a partir das fotos
`tools/make_ganache_limao.py` gera `public/models/ganache-limao.glb` (Android/web) e `ganache-limao.usdz` (iPhone, Quick Look)
a partir de `tools/fotos/ganache-limao.jpg`: a vista de cima vira a textura do topo, a lateral vira a textura da massa, e
suspiros, bolinhas, rodelas de limão e lascas de chocolate viram volume. Precisa de `pip install numpy pillow usd-core`.
Links diretos depois do deploy: `/models/ganache-limao.usdz` abre a RA no iPhone; o cardápio abre a RA no Android pelo botão "Ver na mesa".
