-- XMEDIA: clientes (Customers), conteúdos do portal, definições e acesso do cliente ao portal.
-- O documento de cada cliente/post fica em `data` (jsonb); colunas só para listar e filtrar.
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null default '',
  stage       text not null default 'not_started'
              check (stage in ('not_started','stage0','stage1','stage2','stage3','stage4','complete')),
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists customers_owner_idx on public.customers (owner_id, updated_at desc);
drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
alter table public.customers enable row level security;
create policy "own customers" on public.customers for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create table if not exists public.customer_posts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  status        text not null default 'draft'
                check (status in ('idea','draft','review','approved','scheduled','published','failed')),
  scheduled_at  timestamptz,
  data          jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists customer_posts_customer_idx on public.customer_posts (customer_id, scheduled_at);
create index if not exists customer_posts_due_idx on public.customer_posts (status, scheduled_at) where status = 'scheduled';
drop trigger if exists customer_posts_touch on public.customer_posts;
create trigger customer_posts_touch before update on public.customer_posts for each row execute function public.touch_updated_at();
alter table public.customer_posts enable row level security;
create policy "own customer posts" on public.customer_posts for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- definições do admin (mensalidade do portal, horários da fila, contactos do estúdio)
create table if not exists public.app_settings (
  owner_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "own settings" on public.app_settings for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- segredos do portal: só o servidor (service role) lê e escreve — RLS ligado e sem políticas
create table if not exists public.customer_access (
  customer_id          uuid primary key references public.customers(id) on delete cascade,
  invite_token_hash    text unique,
  invite_expires_at    timestamptz,
  google_email         text unique,
  passcode_hash        text,
  failed               integer not null default 0,
  locked_until         timestamptz,
  ig_user_id           text,
  ig_token             text,          -- cifrado (AES-GCM) pelo servidor
  ig_token_expires_at  timestamptz,
  updated_at           timestamptz not null default now()
);
alter table public.customer_access enable row level security;

create table if not exists public.portal_login_attempts (
  id   bigserial primary key,
  ip   text not null,
  ok   boolean not null,
  at   timestamptz not null default now()
);
create index if not exists portal_login_attempts_ip_idx on public.portal_login_attempts (ip, at desc);
alter table public.portal_login_attempts enable row level security;
