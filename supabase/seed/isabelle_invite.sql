-- Regista a Isabelle como team member (papel Produção) e devolve o link de convite (válido 7 dias).
-- Ela abre o link, escolhe o código de 4–6 dígitos e entra. Pode correr de novo para gerar um link novo.
create or replace function pg_temp.invite_isabelle() returns text
language plpgsql as $$
declare
  v_owner uuid;
  v_id    uuid;
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_perms text[] := array['projects.view','projects.edit','customers.view','customers.edit','invoices.create'];
begin
  select id into v_owner from auth.users where lower(email) = 'contact@mediamarques.com';
  if v_owner is null then
    return 'Ainda sem admin: entre primeiro uma vez em /login com contact@mediamarques.com e corra este SQL de novo.';
  end if;
  select id into v_id from public.team_members where owner_id = v_owner and lower(email) = 'withmining@gmail.com';
  if v_id is null then
    insert into public.team_members (owner_id, name, email, role, lang, app_role, app_permissions, status, active)
    values (v_owner, 'Isabelle', 'withmining@gmail.com', 'Produção', 'pt', 'production', v_perms, 'invited', true)
    returning id into v_id;
  else
    update public.team_members
      set app_role = 'production', app_permissions = v_perms, active = true,
          status = case when status = 'active' then status else 'invited' end
      where id = v_id;
  end if;
  update public.team_members
    set invite_token_hash = encode(extensions.digest('invite:' || v_token, 'sha256'), 'hex'),
        invite_expires_at = now() + interval '7 days',
        invited_at = now()
    where id = v_id;
  return 'https://xmedia-studio.vercel.app/convite/' || v_token;
end;
$$;
select pg_temp.invite_isabelle() as convite_isabelle;
