-- Confeitaria Borges — esquema proposto para o Supabase (um banco único, multi-loja com RLS)
create table stores (id text primary key, slug text unique, name text, city text, address text, whatsapp text, instagram text,
  is_flagship bool default false, opened_at date, hours jsonb, accepts_orders_when_closed bool default true, delivery bool default true);
create table profiles (id uuid primary key references auth.users, name text, role text check (role in ('franqueado','franqueadora')), store_id text references stores);
create table categories (id text primary key, name text, sort int);
create table products (id text primary key, category_id text references categories, name text, description text,
  pricing text check (pricing in ('kg','unidade')), price numeric(10,2), serves_per_kg int, formats jsonb, look jsonb, model_3d jsonb, channels text[], lead_time_hours int);
create table store_products (store_id text references stores, product_id text references products, active bool default true, price_override numeric(10,2), stock int, primary key (store_id, product_id));
create table ready_items (id uuid primary key default gen_random_uuid(), store_id text references stores, product_id text references products,
  format text, weight_g int, price_per_kg numeric(10,2), discount_pct numeric(4,3) default 0, status text default 'disponivel');
create table orders (id uuid primary key default gen_random_uuid(), code text unique, store_id text references stores, created_at timestamptz default now(),
  channel text, mode text, fulfillment text, scheduled_for date, scheduled_period text, total numeric(10,2),
  status text default 'aguardando_pagamento' check (status in ('aguardando_pagamento','pago','sem_pagamento','cancelado')),
  customer_name text, customer_phone text, payment_id uuid);
create table order_items (id bigserial primary key, order_id uuid references orders on delete cascade, product_id text references products, name text, qty int,
  format text, weight_kg numeric(5,2), ready_item_id uuid references ready_items, unit_price numeric(10,2), total numeric(10,2), notes text);
-- pagamentos: só leitura, alimentados por webhook do Asaas e pelo conector Open Finance
create table payments (id uuid primary key default gen_random_uuid(), store_id text references stores, received_at timestamptz, amount numeric(10,2),
  method text, source text check (source in ('asaas','open_finance')), reference text, external_id text unique, order_id uuid references orders);
create table costs (id uuid primary key default gen_random_uuid(), store_id text references stores, date date, category text, description text,
  amount numeric(10,2), source text check (source in ('manual','open_finance')), recurring bool default false);
-- métricas diárias (o painel lê daqui)
create materialized view daily_store_metrics as
  select o.store_id, o.created_at::date as date, count(*) as orders_sent, count(*) filter (where o.status='pago') as orders_paid,
    coalesce(sum(o.total) filter (where o.status='pago'),0) as revenue_orders,
    coalesce(sum(o.total) filter (where o.status='sem_pagamento'),0) as unpaid_value
  from orders o group by 1,2;
-- RLS: franqueado vê só a própria loja; franqueadora vê tudo
alter table orders enable row level security;
create policy loja_propria on orders for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and (p.role = 'franqueadora' or p.store_id = orders.store_id)));
-- (repetir a mesma política em order_items, payments, costs, ready_items)
-- O cardápio público só insere pedidos via função com chave anônima: insert em orders, nunca select.
