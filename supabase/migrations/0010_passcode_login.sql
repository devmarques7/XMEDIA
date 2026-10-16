-- XMEDIA: login único por email + código de 4–6 dígitos (admin, equipa e clientes).
-- Admin: código com bcrypt (pgcrypto), verificado por funções que só a service role pode chamar.
-- O código inicial do admin NÃO fica aqui — define-se com set_admin_passcode (SQL Editor ou Definições).
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_access (
  email          text primary key,
  passcode_hash  text not null,
  updated_at     timestamptz not null default now()
);
alter table public.admin_access enable row level security; -- sem políticas: só service role

create or replace function public.check_admin_passcode(p_email text, p_code text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.admin_access
    where email = lower(trim(p_email)) and passcode_hash = extensions.crypt(p_code, passcode_hash)
  );
$$;

create or replace function public.set_admin_passcode(p_email text, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_code !~ '^[0-9]{4,6}$' then raise exception 'bad_passcode'; end if;
  insert into public.admin_access (email, passcode_hash, updated_at)
  values (lower(trim(p_email)), extensions.crypt(p_code, extensions.gen_salt('bf')), now())
  on conflict (email) do update set passcode_hash = excluded.passcode_hash, updated_at = now();
end;
$$;

revoke all on function public.check_admin_passcode(text, text) from public, anon, authenticated;
revoke all on function public.set_admin_passcode(text, text) from public, anon, authenticated;
grant execute on function public.check_admin_passcode(text, text) to service_role;
grant execute on function public.set_admin_passcode(text, text) to service_role;

-- equipa: código de 4–6 dígitos em vez do código de série (o browser do admin não lê esta coluna)
alter table public.team_members add column if not exists passcode_hash text;

-- tentativas de login por email (bloqueio após 5 erros em 15 min) além do limite por IP
alter table public.portal_login_attempts add column if not exists email text;
create index if not exists portal_login_attempts_email_idx on public.portal_login_attempts (email, at desc);
