-- XMEDIA: agendador de publicação no Instagram (a cada 10 min) com pg_cron + pg_net do Supabase.
-- O token é gerado aqui, dentro da base de dados (ninguém o escreve nem o vê); o endpoint
-- /api/cron/publish compara-o com o desta tabela (lida com a service role).
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto;

create table if not exists public.app_cron (
  id     int primary key default 1 check (id = 1),
  token  text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  url    text not null default 'https://xmedia-studio.vercel.app/api/cron/publish'
);
insert into public.app_cron (id) values (1) on conflict (id) do nothing;
alter table public.app_cron enable row level security; -- sem políticas: só service role / postgres

select cron.unschedule('xmedia-publish') where exists (select 1 from cron.job where jobname = 'xmedia-publish');
select cron.schedule(
  'xmedia-publish',
  '*/10 * * * *',
  $$ select net.http_get(
       url := (select url from public.app_cron where id = 1),
       headers := jsonb_build_object('Authorization', 'Bearer ' || (select token from public.app_cron where id = 1)),
       timeout_milliseconds := 30000
     ) $$
);
