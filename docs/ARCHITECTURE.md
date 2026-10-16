# XMEDIA — arquitetura (para crescer sem refazer)

## Camadas
1. **Design tokens** — `lib/appearance.ts`: paleta (escuro/claro), 2 fontes (BioGrotesk + Fragment Mono), cantos, intervalo, opções.
   Convertidos em variáveis CSS (`--bg`, `--panel`, `--tile-blue`, `--ty-reel`, …). Editáveis em **/definicoes/aparencia**,
   gravados em `app_settings.data.appearance`, lidos publicamente em `/api/appearance` (portal e links públicos usam o mesmo tema).
   Regra: **nenhum componente usa cores fixas** — só tokens.
2. **Componentes bento** — `components/bento.tsx` (`Tile`, `Bars`, `Ring`, `TileLines`, `Dots`) + `.widgets` (grelha de 12 colunas,
   largura total). Todas as páginas = `AppShell` → `.pagehead` → `.widgets` com tiles.
3. **Módulos de domínio (funções puras + testes)** — `lib/kpi.ts` (KPIs da empresa), `lib/crm.ts` (estado e alertas dos clientes),
   `lib/feedback.ts` (avaliações, NPS, referências), `lib/consistency.ts` (consistência de publicação), `lib/invoice.ts`,
   `lib/customer.ts`, `lib/services.ts`. Sem React, sem rede — testados em `*.test.ts`.
4. **Stores com dois adaptadores** — `*Store.ts` / `*Api.ts` (`customerStore`, `invoiceStore`, `portalApi`, `feedbackApi`,
   `appearanceStore`): Supabase em produção, `localStorage` em modo local, com a mesma interface — tudo testável localmente.
5. **Rotas do servidor** — `app/api/*`: permissões com `requirePerm(...)`, escrita com service role; públicas só as listadas em
   `middleware.ts` (`PUBLIC`). Tokens de uso único guardados só como hash (`sha256`).
6. **Dados incluídos sem SQL** — `lib/bundled/*` + `/api/*/bootstrap`, idempotentes por `bundle_version`.
7. **i18n por módulo** — `lib/i18n-*.ts` (PT/EN/NL), juntos em `lib/i18n.tsx`.
8. **Emails** — um só tema (`lib/email/theme.ts`): mesma estrutura, cores e tipografia em convite do portal, proposta,
   booking, agradecimento e avaliação.

## Acrescentar uma página nova
1. `app/<rota>/page.tsx` com `AppShell`, `.pagehead` e `.widgets` de `Tile`s.
2. Lógica em `lib/<módulo>.ts` (puro) + teste; dados por um store com adaptador local/remoto.
3. Textos em `lib/i18n-<módulo>.ts`; permissão em `lib/roles.ts` (`PAGE_PERMS`); link no `Shell.tsx`.
