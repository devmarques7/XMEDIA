-- Perfil do funcionário: foto e cidade (definidas pelo administrador).
alter table public.team_members
  add column if not exists photo_url text not null default '',
  add column if not exists city      text not null default '';
grant select (photo_url, city) on public.team_members to authenticated;
