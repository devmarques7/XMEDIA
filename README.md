# Pré-produção

Uma app web para guardar projetos de pré-produção (conceitos, reels com prazo, locais, sessões, divisões e cenas) e gravar com um checklist no telemóvel.

Stack: Next.js 15 · Supabase (Auth Google + Postgres com RLS) · Vercel. Interface em modo escuro, em PT / EN / NL (`lib/i18n.tsx`).

Produção: https://preprod-studio-iota.vercel.app (projeto Vercel `preprod-studio`).

## Testes
```bash
npm test
```
Cobrem importação JSON/CSV/SSV/TSV, validação por linha, ida e volta de export, templates, agenda do dia e prazos.

## Correr localmente
```bash
npm install
npm run dev
```
Sem variáveis de ambiente, a app arranca em **modo local**: os dados ficam guardados no navegador e dá para testar tudo. Há um exemplo em `samples/exemplo.json`, e também no botão "Carregar exemplo".

## Pôr em produção (≈15 min)

### 1. Supabase
1. Criar um projeto em https://supabase.com.
2. No **SQL Editor**, colar e correr `supabase/migrations/0001_init.sql`.
3. Em **Project Settings → API**, copiar a `Project URL` e a `anon public key`.

### 2. Login com Google
1. Na Google Cloud Console → APIs & Services → Credentials, criar um **OAuth Client ID** do tipo *Web application*.
   - Authorized redirect URI: `https://<projeto>.supabase.co/auth/v1/callback`
2. No Supabase, em **Authentication → Providers → Google**, ativar e colar o Client ID e o Secret.
3. Em **Authentication → URL Configuration**:
   - Site URL: `https://<a-tua-app>.vercel.app`
   - Redirect URLs: `https://<a-tua-app>.vercel.app/auth/callback` e `http://localhost:3000/auth/callback`

### 3. Vercel
O projeto `preprod-studio` já existe. Em **Storage → Create → Supabase** a Vercel cria a base de dados e injeta `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Depois: `npx vercel deploy --prod`.

Para desenvolvimento com Supabase, copiar `.env.example` para `.env.local` e preencher.

## Modelo de dados
- `projects`: um documento JSON por projeto (`data`), com título e o contador de versão. Isto torna a gravação automática, o import e o export triviais.
- `project_versions`: snapshots imutáveis (sem UPDATE na RLS). Restaurar uma versão guarda primeiro o estado atual como nova versão.

Estrutura do `data`: `client, description, shootDate, definitions[], reels[], locations[], sessions[ → blocks[ → scenes[] ] ]` (ver `lib/types.ts`).

## Import / export
- **JSON:** o projeto completo (`{ format, title, data }`). Na página inicial cria um projeto novo; dentro de um projeto substitui o conteúdo.
- **CSV:** uma linha por cena. Na importação, as cenas são **acrescentadas** e sessões, divisões, locais e reels são criados pelo nome.
  Colunas: `session,date,start,end,location,block,block_start,block_end,scene,description,reel,image_url,video_url,links`.
  Links: `Rótulo https://… | Outro https://…`. O separador pode ser `,` ou `;` (Excel PT).

Antes de qualquer importação é criada uma versão automaticamente.

## Ambiente local (igual à produção)

Supabase completo no Docker (Postgres + Auth + Storage + Studio) com as mesmas migrações de `supabase/migrations`.

```bash
colima start          # Docker (uma vez por arranque do Mac)
npm run db:start      # Supabase local → API :54321 · Studio http://127.0.0.1:54323
npm run dev           # app em http://localhost:3000 (lê .env.local)
```

- Login: `contact@mediamarques.com` + código `123456` (definido em `supabase/seed.sql`).
- Ver os dados: Studio em http://127.0.0.1:54323 (tabelas, Storage → `proposal-media`).
- `npm run db:reset` apaga tudo e volta a aplicar migrações + seed. `npm run db:stop` para o Supabase.
- Testes E2E visíveis (Playwright): `npm run e2e` · sem janela: `HEADLESS=1 npm run e2e` · interativo: `npm run e2e:ui`.
