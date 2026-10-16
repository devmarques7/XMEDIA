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
