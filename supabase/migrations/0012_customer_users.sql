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
