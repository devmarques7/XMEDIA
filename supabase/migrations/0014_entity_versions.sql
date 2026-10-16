-- XMEDIA: histórico de versões de tudo o que se edita na app (clientes, conteúdos, invoices, propostas, serviços,
-- definições). Cada alteração guarda o estado ANTERIOR (snapshot) para poder voltar a ele; o Ctrl+Z usa o mesmo registo.
create table if not exists public.entity_versions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default public.workspace_owner() references auth.users(id) on delete cascade,
  entity      text not null check (entity in ('customer','post','invoice','proposal','service','settings')),
  entity_id   text not null,
  op          text not null check (op in ('create','update','delete','restore')),
  label       text not null default '',
  snapshot    jsonb,                       -- estado antes da alteração (null quando o item foi criado)
  by_email    text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists entity_versions_recent on public.entity_versions (owner_id, created_at desc);
create index if not exists entity_versions_item on public.entity_versions (owner_id, entity, entity_id, created_at desc);

alter table public.entity_versions enable row level security;
drop policy if exists "workspace reads versions" on public.entity_versions;
create policy "workspace reads versions" on public.entity_versions for select to authenticated using (owner_id = public.workspace_owner());
drop policy if exists "workspace writes versions" on public.entity_versions;
create policy "workspace writes versions" on public.entity_versions for insert to authenticated with check (owner_id = public.workspace_owner());

-- mantém só as últimas 200 versões de cada item (corre a cada inserção, barato com o índice)
create or replace function public.trim_entity_versions() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.entity_versions v
  where v.owner_id = new.owner_id and v.entity = new.entity and v.entity_id = new.entity_id
    and v.id in (
      select id from public.entity_versions
      where owner_id = new.owner_id and entity = new.entity and entity_id = new.entity_id
      order by created_at desc offset 200
    );
  return null;
end;
$$;
drop trigger if exists entity_versions_trim on public.entity_versions;
create trigger entity_versions_trim after insert on public.entity_versions for each row execute function public.trim_entity_versions();
