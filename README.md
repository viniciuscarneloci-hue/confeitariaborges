> **Novo:** o protótipo genérico do produto (qualquer restaurante, com painel do dono e criação do 3D) está em [`oak-ar/`](oak-ar/README.md). Este diretório raiz continua sendo o piloto da Confeitaria Borges.

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
