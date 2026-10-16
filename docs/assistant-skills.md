# Assistente XMEDIA e MCP — skills, ligação e próximos passos

Há duas portas para a mesma inteligência:

| | Assistente XMEDIA (dentro da app) | MCP (`/api/mcp`) |
|---|---|---|
| Quem usa | Admin, no painel "Assistente" | Claude (claude.ai, Desktop, Claude Code) |
| Onde correm as ferramentas | No browser, com a sessão do utilizador | No servidor, no âmbito do dono |
| Escritas | Confirmadas na interface antes de gravar | Gravam logo (o modelo diz antes o que vai fazer) |
| Definições | `lib/ai/tools.ts` + `*Skill.ts` | `lib/mcp/rpc.ts` (as mesmas + `lib/ai/clientTools.ts`) |
| Execução | `lib/ai/exec.ts` + `*Tools.ts` | `lib/server/mcpTools.ts` + `lib/server/clientMcp.ts` |

## Ligar o MCP com o login da XMEDIA (OAuth)

Igual aos conectores do Claude: não há chave para copiar.

- **claude.ai / Claude Desktop** → Definições → Conectores → *Adicionar conector personalizado* → URL `https://xmedia-studio.vercel.app/api/mcp`. Abre o login da XMEDIA e o ecrã "Ligar … à XMEDIA" → *Permitir acesso*.
- **Claude Code** → `claude mcp add --transport http --scope user xmedia https://xmedia-studio.vercel.app/api/mcp`, depois `/mcp` → xmedia → *Authenticate*.
- **Chave fixa (alternativa, Claude Code/scripts)** → `--header "Authorization: Bearer $MCP_TOKEN"`.

Como funciona: `/.well-known/oauth-protected-resource` → `/.well-known/oauth-authorization-server` → registo dinâmico (`/api/oauth/register`) → `/oauth/authorize` (só admin; login com `?next=`) → `/api/oauth/token` (PKCE S256, acesso 1 h, renovação 30 dias). Os tokens são assinados com **`MCP_OAUTH_SECRET`** (recomendado definir na Vercel; sem ele usa o segredo das sessões). **Mudar esse segredo desliga todas as IAs ligadas.** Os dados acedidos são sempre os do administrador que autorizou.

## Skills (avaliação a 16/10/2026)

| Skill | Ferramentas | Assistente | MCP | Estado |
|---|---|---|---|---|
| Invoices + BTW | list/get/create/update_invoice, set_invoice_items | ✅ | ✅ | Madura |
| Propostas (slides Canva) | list/get/create/update_proposal, update_proposal_slide, set_proposal_slides | ✅ | ✅ | Madura |
| Catálogo de serviços e preços | service_catalog, list/get/create/update_service, organize_services, quote_services, set_pricing_rules, save_quote | ✅ | ✅ | Madura |
| Planear a semana | get_week_plan, plan_week | ✅ | — (só browser) | Boa |
| **Rascunhos de conteúdo** (novo) | find_customers, get_customer_brief, create_content_drafts | ✅ | ✅ | Nova — testada local |
| **Alterações pedidas por email** (novo) | find_content, log_change_requests | ✅ | ✅ | Nova — testada local |
| Clientes: quadro e processo | list_customers, get_content_board, move_content, set_client_process | ❌ | ✅ | **Lacuna no assistente** |
| Comentários / checklists | comment_content | ❌ | ✅ | **Lacuna no assistente** |
| Marca do cliente | get_brand, set_brand | ❌ | ✅ | **Lacuna no assistente** |
| Tarefas e "Hoje" | create_task, list_today, update_task | ❌ | ✅ | **Lacuna no assistente** |
| Importar cliente por JSON | import_client_json | ❌ | ✅ | **Lacuna no assistente** |
| Pré-produção | list_projects | ✅ | ✅ | Só leitura |

Correções feitas nesta avaliação: o MCP anunciava `get_week_plan`/`plan_week` mas não os executava (deixaram de ser anunciados); conteúdos novos criados pelo MCP (incl. `import_client_json`) falhavam por falta de `owner_id`.

## Próximas skills (por valor)

1. **Paridade cliente/conteúdo no assistente** — trazer para o browser as 11 ferramentas que só o MCP tem (mesmas definições de `clientTools.ts`, executor com `customerStore`, escritas confirmadas). Desbloqueia "move o reel X para aprovação", "cria tarefa para a edição" dentro da app.
2. **Ler emails do cliente diretamente** — com um conector de email (Gmail/Outlook) ligado em Definições → Ligações, o assistente encontra o email e chama `log_change_requests` sem colar texto.
3. **Pedir revisão pela IA** — expor o envio de `/api/content/review-request` como ferramenta (`request_review`), com confirmação.
4. **Legendas a partir do vídeo** — depois do upload, gerar/afinar a legenda com base no rascunho + transcrição.
5. **Memória do cliente** — guardar no cliente o que funcionou (formatos, horas, temas com melhor alcance) e usar no `get_customer_brief`.

## Como acrescentar uma skill

1. `lib/<nucleo>.ts` — lógica pura e testável (`*.test.ts`), sem browser nem servidor.
2. `lib/ai/<nome>Skill.ts` — definições das ferramentas (JSON Schema), conjuntos `READ`/`WRITE` e o **método** (texto curto, regras e ordem de chamadas).
3. Assistente — `lib/ai/<nome>Tools.ts` (`"use client"`, leituras + `prepare…Write` com `lines` e `commit`), registar em `exec.ts` e `tools.ts` (`TOOLS`, `WRITE_TOOLS`, `SYSTEM_PROMPT`).
4. MCP — `case` em `lib/server/clientMcp.ts` (ou `mcpTools.ts`) com o mesmo núcleo; o método entra nas instruções em `lib/mcp/rpc.ts`.
5. Claude Code — atualizar `.claude/skills/xmedia-content/SKILL.md` (ou criar uma skill nova) com o fluxo.
6. Testar: unitários (`npm test`), MCP local (`xmedia-local`) e o assistente na app.
