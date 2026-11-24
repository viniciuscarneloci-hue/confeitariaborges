-- Oak AR — esquema multi-restaurante (Supabase/Postgres). Um banco único; toda tabela tem restaurant_id.
create table restaurants (id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, tagline text,
  cuisine text, accent text default '#B4532A', city text, whatsapp text, created_at timestamptz default now());
-- quem administra cada restaurante (um dono pode ter vários restaurantes; um restaurante pode ter vários gerentes)
create table restaurant_members (restaurant_id uuid references restaurants on delete cascade, user_id uuid references auth.users on delete cascade,
  role text check (role in ('dono','gerente')) default 'dono', primary key (restaurant_id, user_id));
create table categories (id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references restaurants on delete cascade, name text, sort int);
create table dishes (id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references restaurants on delete cascade,
  category_id uuid references categories, name text not null, description text, price numeric(10,2), tags text[] default '{}', serves text,
  plate_cm numeric(5,1), available bool default true, sort int default 0,
  model jsonb -- {glb, usdz, poster, scale, yaw, size_cm:{w,h,d}, source, capture_id, published_at}
);
create table captures (id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references restaurants on delete cascade,
  dish_id uuid references dishes on delete cascade, created_at timestamptz default now(),
  source text check (source in ('video-camera','video-arquivo','fotos','arquivo-3d')), provider text, provider_task text,
  status text default 'enviando', stage text, progress int default 0, quality jsonb, thumb text, result jsonb, error text);
create table menu_events (id bigserial primary key, restaurant_id uuid not null references restaurants on delete cascade, dish_id uuid,
  type text check (type in ('menu_aberto','prato_aberto','ver_3d','ver_ra','adicionou')), at timestamptz default now());
create index on dishes (restaurant_id); create index on captures (restaurant_id, created_at desc); create index on menu_events (restaurant_id, at);

-- RLS: o cardápio é público (só leitura de pratos disponíveis); o painel só enxerga o próprio restaurante.
alter table restaurants enable row level security; alter table categories enable row level security; alter table dishes enable row level security;
alter table captures enable row level security; alter table menu_events enable row level security; alter table restaurant_members enable row level security;
create function is_member(r uuid) returns bool language sql stable security definer as
  $$ select exists (select 1 from restaurant_members m where m.restaurant_id = r and m.user_id = auth.uid()) $$;
create policy publico_le on restaurants for select using (true);
create policy publico_le on categories for select using (true);
create policy publico_le on dishes for select using (available or is_member(restaurant_id));
create policy membro_altera on restaurants for update using (is_member(id));
create policy membro_altera on categories for all using (is_member(restaurant_id)) with check (is_member(restaurant_id));
create policy membro_altera on dishes for all using (is_member(restaurant_id)) with check (is_member(restaurant_id));
create policy membro_altera on captures for all using (is_member(restaurant_id)) with check (is_member(restaurant_id));
create policy membro_le on menu_events for select using (is_member(restaurant_id));
create policy publico_registra on menu_events for insert with check (true);
create policy proprio on restaurant_members for select using (user_id = auth.uid());
-- Storage: bucket "capturas" (privado) para vídeos/fotos; bucket "modelos" (público, com cache) para .glb/.usdz/pôster publicados.
