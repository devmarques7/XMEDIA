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
