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
