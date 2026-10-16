-- XMEDIA · seed do ambiente LOCAL (`npm run db:reset` corre isto depois das migrações).
-- Nunca é aplicado em produção.

-- Admin local: entrar em http://localhost:3000/login com este email + código 123456
select public.set_admin_passcode('contact@mediamarques.com', '123456');

-- O agendador (0009) aponta para a produção; no local chama o next dev na máquina (o Postgres corre no Docker)
update public.app_cron set url = 'http://host.docker.internal:3000/api/cron/publish' where id = 1;
