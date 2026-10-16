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
