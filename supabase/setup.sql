-- XMEDIA · setup completo (0001 → 0012). Colar no Supabase → SQL Editor → Run.

-- ===== 0001_init.sql =====
-- Pré-produção: projetos (documento JSON) + versões (snapshots imutáveis)
-- Correr no Supabase → SQL Editor (ou `supabase db push`).

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null default 'Sem título',
  data        jsonb not null default '{}'::jsonb,
  version     integer not null default 1,          -- próxima versão a gravar
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.project_versions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version     integer not null,
  title       text not null,
  data        jsonb not null,
  note        text,
  created_at  timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists projects_owner_idx on public.projects (owner_id, updated_at desc);
create index if not exists versions_project_idx on public.project_versions (project_id, version desc);

-- updated_at automático
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- RLS: cada utilizador só vê o que é seu
alter table public.projects enable row level security;
alter table public.project_versions enable row level security;

create policy "own projects" on public.projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- versões: ler, criar e apagar (sem update → imutáveis)
create policy "read own versions" on public.project_versions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "insert own versions" on public.project_versions
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );
create policy "delete own versions" on public.project_versions
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ===== 0002_profiles_tasks.sql =====
-- One Bro: perfil do utilizador + tarefas pessoais do calendário

create table if not exists public.profiles (
  id            uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name  text not null default '',
  role          text not null default '',
  city          text not null default '',
  bio           text not null default '',
  interests     text[] not null default '{}',
  avatar_url    text not null default '',
  website       text not null default '',
  phone         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  date        date not null,
  time        text not null default '',     -- "HH:MM" opcional
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists tasks_owner_date_idx on public.tasks (owner_id, date);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "own tasks" on public.tasks
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ===== 0003_team_hours.sql =====
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

-- ===== 0004_member_invites.sql =====
-- XMEDIA: funcionários entram com um código de série (sem email/palavra-passe),
-- registam-se por convite enviado por email. Tudo o que é do funcionário passa
-- pelas rotas /api/member/* do servidor (service role) — o funcionário nunca fala
-- diretamente com a base de dados, por isso não tem políticas RLS próprias.

alter table public.team_members
  add column if not exists lang               text not null default 'pt' check (lang in ('pt','en','nl')),
  add column if not exists status             text not null default 'draft' check (status in ('draft','invited','active','disabled')),
  add column if not exists login_code_hash    text unique,
  add column if not exists code_hint          text not null default '',
  add column if not exists invite_token_hash  text unique,
  add column if not exists invite_expires_at  timestamptz,
  add column if not exists invited_at         timestamptz,
  add column if not exists registered_at      timestamptz,
  add column if not exists last_login_at      timestamptz;

-- o admin (browser) nunca lê os hashes: SELECT só nas colunas públicas
revoke select on public.team_members from authenticated, anon;
grant select (id, owner_id, name, email, role, description, responsibilities, rate, rate_currency, access, active, created_at,
              lang, status, code_hint, invite_expires_at, invited_at, registered_at, last_login_at)
  on public.team_members to authenticated;

-- acesso do funcionário deixa de ser por email do Supabase Auth
drop policy if exists "member reads self" on public.team_members;
drop policy if exists "member reads own entries" on public.time_entries;
drop policy if exists "member adds own entries" on public.time_entries;
drop policy if exists "member deletes own open entries" on public.time_entries;
drop policy if exists "member reads own closes" on public.month_closes;

-- travão a tentativas de código (por IP)
create table if not exists public.member_login_attempts (
  id  bigserial primary key,
  ip  text not null,
  ok  boolean not null,
  at  timestamptz not null default now()
);
create index if not exists member_login_attempts_ip_at_idx on public.member_login_attempts (ip, at);
alter table public.member_login_attempts enable row level security; -- sem políticas: só service role

-- ===== 0005_member_photo_city.sql =====
-- Perfil do funcionário: foto e cidade (definidas pelo administrador).
alter table public.team_members
  add column if not exists photo_url text not null default '',
  add column if not exists city      text not null default '';
grant select (photo_url, city) on public.team_members to authenticated;

-- ===== 0006_invoices.sql =====
-- XMEDIA: invoices da empresa (página Finanças). O documento completo fica em `data` (jsonb);
-- número, data, estado e totais ficam em colunas para listar, filtrar e somar BTW por trimestre.
create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  number      text not null,
  issue_date  date not null,
  status      text not null default 'draft' check (status in ('draft','sent','paid')),
  currency    text not null default 'EUR' check (currency in ('EUR','GBP')),
  subtotal    numeric(12,2) not null default 0,
  btw_amount  numeric(12,2) not null default 0,
  total       numeric(12,2) not null default 0,
  client_name text not null default '',
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, number)
);
create index if not exists invoices_owner_date_idx on public.invoices (owner_id, issue_date desc);

drop trigger if exists invoices_touch on public.invoices;
create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

alter table public.invoices enable row level security;
create policy "own invoices" on public.invoices for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ===== 0007_proposals.sql =====
-- XMEDIA: propostas (documento de slides + CRM), links temporários de partilha e media (vídeos/imagens).
create table if not exists public.proposals (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null,
  client_name  text not null default '',
  value        numeric(12,2) not null default 0,
  currency     text not null default 'EUR' check (currency in ('EUR','GBP')),
  stage        text not null default 'lead' check (stage in ('lead','diagnosis','sent','negotiation','won','lost')),
  data         jsonb not null,                -- proposta completa (cliente, datas, notas, doc com slides)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists proposals_owner_idx on public.proposals (owner_id, updated_at desc);
drop trigger if exists proposals_touch on public.proposals;
create trigger proposals_touch before update on public.proposals for each row execute function public.touch_updated_at();
alter table public.proposals enable row level security;
create policy "own proposals" on public.proposals for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- link temporário: guarda uma cópia do documento no momento da partilha; lido só pelo servidor (service role)
create table if not exists public.proposal_shares (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.proposals(id) on delete cascade,
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token_hash   text not null unique,
  title        text not null,
  doc          jsonb not null,
  expires_at   timestamptz not null,
  revoked      boolean not null default false,
  views        integer not null default 0,
  last_view_at timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.proposal_shares enable row level security;
create policy "own shares" on public.proposal_shares for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- media: bucket público para leitura (links partilhados), escrita só para utilizadores autenticados
insert into storage.buckets (id, name, public, file_size_limit)
values ('proposal-media', 'proposal-media', true, 524288000)
on conflict (id) do nothing;
create policy "auth uploads proposal media" on storage.objects for insert to authenticated
  with check (bucket_id = 'proposal-media');
create policy "auth manages own proposal media" on storage.objects for delete to authenticated
  using (bucket_id = 'proposal-media' and owner = (select auth.uid()));

-- ===== 0008_customers_portal.sql =====
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

-- ===== 0009_cron_publish.sql =====
-- XMEDIA: agendador de publicação no Instagram (a cada 10 min) com pg_cron + pg_net do Supabase.
-- O token é gerado aqui, dentro da base de dados (ninguém o escreve nem o vê); o endpoint
-- /api/cron/publish compara-o com o desta tabela (lida com a service role).
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto;

create table if not exists public.app_cron (
  id     int primary key default 1 check (id = 1),
  token  text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  url    text not null default 'https://xmedia-studio.vercel.app/api/cron/publish'
);
insert into public.app_cron (id) values (1) on conflict (id) do nothing;
alter table public.app_cron enable row level security; -- sem políticas: só service role / postgres

select cron.unschedule('xmedia-publish') where exists (select 1 from cron.job where jobname = 'xmedia-publish');
select cron.schedule(
  'xmedia-publish',
  '*/10 * * * *',
  $$ select net.http_get(
       url := (select url from public.app_cron where id = 1),
       headers := jsonb_build_object('Authorization', 'Bearer ' || (select token from public.app_cron where id = 1)),
       timeout_milliseconds := 30000
     ) $$
);

-- ===== 0010_passcode_login.sql =====
-- XMEDIA: login único por email + código de 4–6 dígitos (admin, equipa e clientes).
-- Admin: código com bcrypt (pgcrypto), verificado por funções que só a service role pode chamar.
-- O código inicial do admin NÃO fica aqui — define-se com set_admin_passcode (SQL Editor ou Definições).
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_access (
  email          text primary key,
  passcode_hash  text not null,
  updated_at     timestamptz not null default now()
);
alter table public.admin_access enable row level security; -- sem políticas: só service role

create or replace function public.check_admin_passcode(p_email text, p_code text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.admin_access
    where email = lower(trim(p_email)) and passcode_hash = extensions.crypt(p_code, passcode_hash)
  );
$$;

create or replace function public.set_admin_passcode(p_email text, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_code !~ '^[0-9]{4,6}$' then raise exception 'bad_passcode'; end if;
  insert into public.admin_access (email, passcode_hash, updated_at)
  values (lower(trim(p_email)), extensions.crypt(p_code, extensions.gen_salt('bf')), now())
  on conflict (email) do update set passcode_hash = excluded.passcode_hash, updated_at = now();
end;
$$;

revoke all on function public.check_admin_passcode(text, text) from public, anon, authenticated;
revoke all on function public.set_admin_passcode(text, text) from public, anon, authenticated;
grant execute on function public.check_admin_passcode(text, text) to service_role;
grant execute on function public.set_admin_passcode(text, text) to service_role;

-- equipa: código de 4–6 dígitos em vez do código de série (o browser do admin não lê esta coluna)
alter table public.team_members add column if not exists passcode_hash text;

-- tentativas de login por email (bloqueio após 5 erros em 15 min) além do limite por IP
alter table public.portal_login_attempts add column if not exists email text;
create index if not exists portal_login_attempts_email_idx on public.portal_login_attempts (email, at desc);

-- ===== 0011_member_roles.sql =====
-- XMEDIA: team members com acesso à plataforma (papéis e permissões), aplicado na base de dados.
-- O admin é o dono do workspace (owner_id). Cada member que entra na app tem um utilizador Supabase
-- ligado ao workspace em workspace_members; o que pode ver/alterar vem de team_members.app_permissions.

alter table public.team_members
  add column if not exists app_role         text   not null default 'none' check (app_role in ('none','viewer','production','manager')),
  add column if not exists app_permissions  text[] not null default '{}';
grant select (app_role, app_permissions) on public.team_members to authenticated;

create table if not exists public.workspace_members (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  member_id   uuid not null references public.team_members(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.workspace_members enable row level security;
drop policy if exists "read own membership" on public.workspace_members;
create policy "read own membership" on public.workspace_members for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "owner manages memberships" on public.workspace_members;
create policy "owner manages memberships" on public.workspace_members for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- dono do workspace de quem está autenticado (admin → ele próprio; member → o admin)
create or replace function public.workspace_owner() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select owner_id from public.workspace_members where user_id = auth.uid()), auth.uid());
$$;

-- permissão do member (o admin, que não está em workspace_members, tem tudo)
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from public.workspace_members w where w.user_id = auth.uid()) then true
    else exists (
      select 1 from public.workspace_members w join public.team_members t on t.id = w.member_id
      where w.user_id = auth.uid() and t.active and t.status = 'active' and t.app_role <> 'none' and p = any(t.app_permissions)
    )
  end;
$$;

-- só é member quem está em workspace_members (as políticas "member …" só se aplicam a esses)
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where user_id = auth.uid());
$$;

-- acesso de quem está na app (para a interface): { admin, role, permissions }
create or replace function public.my_access() returns json
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from public.workspace_members w where w.user_id = auth.uid())
      then json_build_object('admin', true, 'role', 'admin', 'permissions', '[]'::json)
    else (select json_build_object('admin', false, 'role', t.app_role, 'name', t.name,
                 'permissions', case when t.active and t.status = 'active' then to_json(t.app_permissions) else '[]'::json end)
          from public.workspace_members w join public.team_members t on t.id = w.member_id where w.user_id = auth.uid())
  end;
$$;
grant execute on function public.workspace_owner() to authenticated;
grant execute on function public.has_perm(text) to authenticated;
grant execute on function public.is_member() to authenticated;
grant execute on function public.my_access() to authenticated;

-- linhas criadas por members ficam no workspace do admin
alter table public.projects         alter column owner_id set default public.workspace_owner();
alter table public.project_versions alter column owner_id set default public.workspace_owner();
alter table public.tasks            alter column owner_id set default public.workspace_owner();
alter table public.customers        alter column owner_id set default public.workspace_owner();
alter table public.customer_posts   alter column owner_id set default public.workspace_owner();
alter table public.proposals        alter column owner_id set default public.workspace_owner();
alter table public.proposal_shares  alter column owner_id set default public.workspace_owner();
alter table public.invoices         alter column owner_id set default public.workspace_owner();
alter table public.invoices add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;

-- projetos, versões e tarefas
drop policy if exists "member reads projects" on public.projects;
create policy "member reads projects" on public.projects for select to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('projects.view'));
drop policy if exists "member edits projects" on public.projects;
create policy "member edits projects" on public.projects for all to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('projects.edit'))
  with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('projects.edit'));
drop policy if exists "member reads versions" on public.project_versions;
create policy "member reads versions" on public.project_versions for select to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('projects.view'));
drop policy if exists "member adds versions" on public.project_versions;
create policy "member adds versions" on public.project_versions for insert to authenticated
  with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('projects.edit'));
drop policy if exists "member reads tasks" on public.tasks;
create policy "member reads tasks" on public.tasks for select to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('projects.view'));
drop policy if exists "member edits tasks" on public.tasks;
create policy "member edits tasks" on public.tasks for all to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('projects.edit'))
  with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('projects.edit'));

-- clientes e conteúdos
drop policy if exists "member reads customers" on public.customers;
create policy "member reads customers" on public.customers for select to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('customers.view'));
drop policy if exists "member edits customers" on public.customers;
create policy "member edits customers" on public.customers for all to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('customers.edit'))
  with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('customers.edit'));
drop policy if exists "member reads posts" on public.customer_posts;
create policy "member reads posts" on public.customer_posts for select to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('customers.view'));
drop policy if exists "member edits posts" on public.customer_posts;
create policy "member edits posts" on public.customer_posts for all to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('customers.edit'))
  with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('customers.edit'));

-- propostas (têm valores comerciais)
drop policy if exists "member reads proposals" on public.proposals;
create policy "member reads proposals" on public.proposals for select to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('proposals.view'));
drop policy if exists "member edits proposals" on public.proposals;
create policy "member edits proposals" on public.proposals for all to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('proposals.edit'))
  with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('proposals.edit'));
drop policy if exists "member edits shares" on public.proposal_shares;
create policy "member edits shares" on public.proposal_shares for all to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('proposals.edit'))
  with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('proposals.edit'));

-- finanças: tudo só com finance.view; invoices.create = registar rascunhos próprios (sem ver/alterar o resto)
drop policy if exists "member finance" on public.invoices;
create policy "member finance" on public.invoices for all to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('finance.view'))
  with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('finance.view'));
drop policy if exists "member own drafts" on public.invoices;
create policy "member own drafts" on public.invoices for all to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('invoices.create')
         and created_by = (select auth.uid()) and status = 'draft')
  with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('invoices.create')
         and created_by = (select auth.uid()) and status = 'draft');

-- definições: todos leem (preço do portal, processo); só settings.manage altera
drop policy if exists "member reads settings" on public.app_settings;
create policy "member reads settings" on public.app_settings for select to authenticated
  using (public.is_member() and owner_id = public.workspace_owner());
drop policy if exists "member edits settings" on public.app_settings;
create policy "member edits settings" on public.app_settings for all to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('settings.manage'))
  with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('settings.manage'));

-- team members (inclui valores/hora): só team.manage
drop policy if exists "member manages team" on public.team_members;
create policy "member manages team" on public.team_members for all to authenticated
  using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('team.manage'))
  with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm('team.manage'));
alter table public.app_settings     alter column owner_id set default public.workspace_owner();

-- ===== 0012_customer_users.sql =====
-- XMEDIA: várias pessoas por cliente no portal (ex.: Sanctum BV → Gabriel, Luuk…).
-- Cada utilizador tem o seu email, código de 4–6 dígitos e papel; a sessão do portal é do utilizador
-- e só dá acesso aos dados do cliente dele (o servidor filtra sempre por customer_id).
create table if not exists public.customer_users (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.customers(id) on delete cascade,
  email              text not null,
  name               text not null default '',
  role               text not null default 'member' check (role in ('owner','member','viewer')),
  status             text not null default 'invited' check (status in ('invited','active','disabled')),
  passcode_hash      text,
  invite_token_hash  text unique,
  invite_expires_at  timestamptz,
  google_email       text,
  invited_at         timestamptz,
  registered_at      timestamptz,
  last_login_at      timestamptz,
  created_at         timestamptz not null default now(),
  unique (customer_id, email)
);
create index if not exists customer_users_email_idx on public.customer_users (lower(email));
create index if not exists customer_users_google_idx on public.customer_users (lower(google_email));
alter table public.customer_users enable row level security;

-- o browser do admin/team member nunca lê os hashes
revoke all on public.customer_users from anon, authenticated;
grant select (id, customer_id, email, name, role, status, invited_at, invite_expires_at, registered_at, last_login_at, created_at)
  on public.customer_users to authenticated;
grant insert (customer_id, email, name, role) on public.customer_users to authenticated;
grant update (name, role, status) on public.customer_users to authenticated;
grant delete on public.customer_users to authenticated;

drop policy if exists "workspace reads customer users" on public.customer_users;
create policy "workspace reads customer users" on public.customer_users for select to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and c.owner_id = public.workspace_owner()) and public.has_perm('customers.view'));
drop policy if exists "workspace edits customer users" on public.customer_users;
create policy "workspace edits customer users" on public.customer_users for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and c.owner_id = public.workspace_owner()) and public.has_perm('customers.edit'))
  with check (exists (select 1 from public.customers c where c.id = customer_id and c.owner_id = public.workspace_owner()) and public.has_perm('customers.edit'));

-- quem já tinha acesso no modelo antigo (1 acesso por cliente) passa a utilizador "owner" com o mesmo id
-- (o hash do código foi feito com o id do cliente, por isso continua válido)
insert into public.customer_users (id, customer_id, email, name, role, status, passcode_hash, google_email, registered_at)
select c.id, c.id, lower(coalesce(nullif(a.google_email, ''), c.email)), coalesce(c.data->>'contact', ''), 'owner',
       case when a.passcode_hash is not null or a.google_email is not null then 'active' else 'invited' end,
       a.passcode_hash, a.google_email, now()
from public.customers c join public.customer_access a on a.customer_id = c.id
where (a.passcode_hash is not null or a.google_email is not null) and coalesce(nullif(a.google_email, ''), c.email) <> ''
on conflict do nothing;

-- ============================================================ 0013_services.sql
-- XMEDIA: catálogo de serviços (pastas, regras de preço editáveis) e orçamentos da calculadora.
-- Valores comerciais: members só leem com proposals.view e alteram com proposals.edit. O CRP/margem vive em data.

create table if not exists public.services (
  id          text not null,                                   -- slug estável (ex.: "edit-pro")
  owner_id    uuid not null default public.workspace_owner() references auth.users(id) on delete cascade,
  folder      text not null,
  name        text not null,
  price       numeric(12,2) not null default 0,
  archived    boolean not null default false,
  uses        integer not null default 0,
  data        jsonb not null,                                  -- serviço completo (ver lib/services.ts)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (owner_id, id)
);
create index if not exists services_folder_idx on public.services (owner_id, folder);
drop trigger if exists services_touch on public.services;
create trigger services_touch before update on public.services for each row execute function public.touch_updated_at();
alter table public.services enable row level security;

-- um registo por workspace: pastas + regras (descontos A/B/C, parceiro, teto, piso, BTW…)
create table if not exists public.service_catalog (
  owner_id    uuid primary key default public.workspace_owner() references auth.users(id) on delete cascade,
  folders     jsonb not null default '[]',
  rules       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);
drop trigger if exists service_catalog_touch on public.service_catalog;
create trigger service_catalog_touch before update on public.service_catalog for each row execute function public.touch_updated_at();
alter table public.service_catalog enable row level security;

-- orçamentos guardados a partir da calculadora (cliente, linhas, parceiro, recorrência, totais)
create table if not exists public.service_quotes (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default public.workspace_owner() references auth.users(id) on delete cascade,
  client_name  text not null default '',
  customer_id  uuid,
  total        numeric(12,2) not null default 0,
  data         jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists service_quotes_owner_idx on public.service_quotes (owner_id, updated_at desc);
drop trigger if exists service_quotes_touch on public.service_quotes;
create trigger service_quotes_touch before update on public.service_quotes for each row execute function public.touch_updated_at();
alter table public.service_quotes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['services','service_catalog','service_quotes'] loop
    execute format('drop policy if exists "own %1$s" on public.%1$I', t);
    execute format('create policy "own %1$s" on public.%1$I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('drop policy if exists "member reads %1$s" on public.%1$I', t);
    execute format('create policy "member reads %1$s" on public.%1$I for select to authenticated using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm(''proposals.view''))', t);
    execute format('drop policy if exists "member edits %1$s" on public.%1$I', t);
    execute format('create policy "member edits %1$s" on public.%1$I for all to authenticated using (public.is_member() and owner_id = public.workspace_owner() and public.has_perm(''proposals.edit'')) with check (public.is_member() and owner_id = public.workspace_owner() and public.has_perm(''proposals.edit''))', t);
  end loop;
end $$;

-- conta usos (mais requisitados) sem precisar de permissão de escrita no serviço inteiro
create or replace function public.bump_service_uses(ids text[]) returns void
language sql security definer set search_path = public as $$
  update public.services set uses = uses + 1,
         data = jsonb_set(data, '{uses}', to_jsonb(uses + 1))
   where owner_id = public.workspace_owner() and id = any(ids)
     and (not public.is_member() or public.has_perm('proposals.edit'));
$$;
grant execute on function public.bump_service_uses(text[]) to authenticated;
