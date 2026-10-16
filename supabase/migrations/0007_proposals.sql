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
