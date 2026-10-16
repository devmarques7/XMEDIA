-- XMEDIA: equipa, horas trabalhadas e fecho mensal.
-- O admin (owner_id) gere funcionários e valor/hora; cada funcionário entra com o email
-- registado e só vê a própria ficha, regista as próprias horas e vê o próprio fecho.

create table if not exists public.team_members (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null,
  email             text not null default '',
  role              text not null default '',
  description       text not null default '',
  responsibilities  text[] not null default '{}',
  rate              numeric(10,2) not null default 0 check (rate >= 0),
  rate_currency     text not null default 'EUR' check (rate_currency in ('EUR','GBP','BRL')),
  access            text not null default 'member' check (access in ('admin','member')),
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists team_members_owner_idx on public.team_members (owner_id);
create index if not exists team_members_email_idx on public.team_members (lower(email));

create table if not exists public.month_closes (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.team_members(id) on delete cascade,
  month          text not null check (month ~ '^\d{4}-\d{2}$'),
  minutes        integer not null,
  rate           numeric(10,2) not null,
  rate_currency  text not null check (rate_currency in ('EUR','GBP','BRL')),
  amount         numeric(12,2) not null,
  paid           boolean not null default false,
  closed_at      timestamptz not null default now(),
  unique (member_id, month)
);

create table if not exists public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.team_members(id) on delete cascade,
  date        date not null,
  start       text not null check (start ~ '^\d{2}:\d{2}$'),
  "end"       text not null check ("end" ~ '^\d{2}:\d{2}$'),
  break_min   integer not null default 0 check (break_min >= 0),
  project     text not null default '',
  note        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists time_entries_member_date_idx on public.time_entries (member_id, date);

-- helpers (security definer para evitar recursão nas políticas)
create or replace function public.is_team_owner(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_members t where t.id = m and t.owner_id = (select auth.uid()));
$$;
create or replace function public.is_team_self(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_members t
                 where t.id = m and lower(t.email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));
$$;
create or replace function public.month_is_closed(m uuid, d date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.month_closes c where c.member_id = m and c.month = to_char(d, 'YYYY-MM'));
$$;

alter table public.team_members enable row level security;
alter table public.time_entries enable row level security;
alter table public.month_closes enable row level security;

-- funcionários: admin gere tudo; o funcionário só lê a própria ficha (não altera o valor/hora)
create policy "owner manages members" on public.team_members for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "member reads self" on public.team_members for select to authenticated
  using (lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));

-- horas: admin tudo; funcionário lê/insere/apaga as suas, só em meses não fechados
create policy "owner manages entries" on public.time_entries for all to authenticated
  using (public.is_team_owner(member_id)) with check (public.is_team_owner(member_id));
create policy "member reads own entries" on public.time_entries for select to authenticated
  using (public.is_team_self(member_id));
create policy "member adds own entries" on public.time_entries for insert to authenticated
  with check (public.is_team_self(member_id) and not public.month_is_closed(member_id, date));
create policy "member deletes own open entries" on public.time_entries for delete to authenticated
  using (public.is_team_self(member_id) and not public.month_is_closed(member_id, date));

-- fecho: admin tudo; funcionário só lê o seu
create policy "owner manages closes" on public.month_closes for all to authenticated
  using (public.is_team_owner(member_id)) with check (public.is_team_owner(member_id));
create policy "member reads own closes" on public.month_closes for select to authenticated
  using (public.is_team_self(member_id));
