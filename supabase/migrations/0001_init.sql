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
