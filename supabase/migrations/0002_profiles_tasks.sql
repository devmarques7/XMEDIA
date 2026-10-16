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
