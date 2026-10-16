-- Regista o cliente Sanctum BV (se ainda não existir), o teaser de quarta-feira (Ibiza) e o Gabriel
-- como pessoa com acesso ao portal (papel: membro). Devolve o link de convite (válido 7 dias).
-- NÃO envia email. Pode correr de novo: reutiliza o cliente e gera um link novo para o Gabriel.
create or replace function pg_temp.setup_sanctum() returns text
language plpgsql as $$
declare
  v_owner    uuid;
  v_customer uuid;
  v_user     uuid;
  v_token    text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select id into v_owner from auth.users where lower(email) = 'contact@mediamarques.com';
  if v_owner is null then
    return 'Ainda sem admin: entre primeiro uma vez em /login com contact@mediamarques.com e corra este SQL de novo.';
  end if;

  select id into v_customer from public.customers where owner_id = v_owner and name = 'Sanctum BV';
  if v_customer is null then
    v_customer := gen_random_uuid();
    insert into public.customers (id, owner_id, name, email, stage, data) values (
      v_customer, v_owner, 'Sanctum BV', 'luuk@wearesanctum.com', 'stage3',
      jsonb_build_object(
        'id', v_customer, 'name', 'Sanctum BV', 'contact', 'Luuk Melisse', 'email', 'luuk@wearesanctum.com', 'phone', '',
        'lang', 'en', 'stage', 'stage3', 'done', '[]'::jsonb, 'contract_signed', true, 'cover', '',
        'notes', 'Billing: Sanctum BV, Singel 174a, 1015 AJ Amsterdam (NL). Vários utilizadores no portal (Gabriel, …).',
        'instagram', jsonb_build_object('handle', 'wearesanctum', 'connected', false),
        'portal', jsonb_build_object('status', 'invited'),
        'plan', jsonb_build_object('active', true, 'price', null, 'since', '', 'paid_until', '')
      )
    );
  end if;

  -- entrega: teaser para quarta-feira 14 out 2026 (Ibiza), em edição — sem publicação automática
  if not exists (select 1 from public.customer_posts where customer_id = v_customer and data->>'title' = 'Teaser — Sanctum Ibiza') then
    insert into public.customer_posts (owner_id, customer_id, status, scheduled_at, data)
    select v_owner, v_customer, 'draft', timestamptz '2026-10-14 18:00 Europe/Amsterdam', jsonb_build_object(
      'customer_id', v_customer, 'type', 'reel', 'status', 'draft', 'title', 'Teaser — Sanctum Ibiza',
      'caption', '', 'first_comment', '', 'cover', '', 'media', '[]'::jsonb,
      'scheduled_at', to_char(timestamptz '2026-10-14 18:00 Europe/Amsterdam' at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"'),
      'auto', false, 'published_at', '', 'ig_media_id', '', 'ig_container_id', '', 'permalink', '', 'error', '',
      'feedback', '[]'::jsonb, 'notes', '[]'::jsonb, 'round', 0, 'blocked', false, 'blocked_reason', '',
      'phase_since', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"')
    );
  end if;

  -- Gabriel: membro (vê tudo do cliente, comenta e aprova)
  select id into v_user from public.customer_users where customer_id = v_customer and email = 'gab@wearesanctum.com';
  if v_user is null then
    insert into public.customer_users (customer_id, email, name, role, status)
    values (v_customer, 'gab@wearesanctum.com', 'Gabriel', 'member', 'invited') returning id into v_user;
  end if;
  update public.customer_users
    set invite_token_hash = encode(extensions.digest('invite:' || v_token, 'sha256'), 'hex'),
        invite_expires_at = now() + interval '7 days',
        invited_at = now(),
        status = case when status = 'active' then status else 'invited' end
    where id = v_user;

  return 'https://xmedia-studio.vercel.app/portal/convite/' || v_token;
end;
$$;
select pg_temp.setup_sanctum() as convite_gabriel;
