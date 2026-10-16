// Skill "rascunhos de conteúdo": o utilizador diz o que vai produzir e para que cliente; a IA encontra o cliente,
// lê o briefing (marca, voz, histórico, datas ocupadas) e cria os rascunhos prontos — só falta o upload.
// Definições partilhadas pelo assistente XMEDIA (executa no browser) e pelo MCP (executa no servidor).
import type Anthropic from "@anthropic-ai/sdk";
import { DRAFT_ITEM_SCHEMA, MAX_DRAFTS } from "../contentDrafts";

export const CONTENT_READ_TOOLS = new Set(["find_customers", "get_customer_brief", "find_content"]);
export const CONTENT_WRITE_TOOLS = new Set(["create_content_drafts", "log_change_requests"]);

const customer = { type: "string", description: "Id ou nome do cliente (aceita parte do nome, ex.: 'carioca')" };

export const CONTENT_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "find_customers",
    description: "Procura clientes pelo nome, contacto ou email (parte do texto chega). Devolve id, nome, tipo e nº de conteúdos. Usar quando o nome dado é ambíguo ou para confirmar o cliente.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Texto a procurar (vazio = todos)" } }, additionalProperties: false },
  },
  {
    name: "get_customer_brief",
    description:
      "Briefing de um cliente para escrever conteúdos: marca (tagline, essência, palavras-chave, voz, faz/não faz, persona), últimas 15 publicações (tipo, título, início da legenda), datas já ocupadas e língua do cliente. Ler SEMPRE antes de create_content_drafts.",
    input_schema: { type: "object", properties: { customer }, required: ["customer"], additionalProperties: false },
  },
  {
    name: "create_content_drafts",
    description: `Cria até ${MAX_DRAFTS} rascunhos de conteúdo para um cliente, de uma vez: estado rascunho, internos (o cliente não vê), sem ficheiros — ficam prontos para a equipa só carregar o vídeo/as imagens. Cada rascunho: tipo, título, legenda na voz da marca, hashtags, notas de produção, shot list, data de publicação e prazos.`,
    input_schema: {
      type: "object",
      properties: { customer, drafts: { type: "array", items: DRAFT_ITEM_SCHEMA, minItems: 1, maxItems: MAX_DRAFTS } },
      required: ["customer", "drafts"],
      additionalProperties: false,
    },
  },
  {
    name: "find_content",
    description: "Procura conteúdos (reels, posts, carrosséis, stories) pelo nome/título — parte do texto chega, sem acentos — em todos os clientes ou só num. Devolve id, título, cliente, tipo, estado, ronda e comentários abertos.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Nome do conteúdo (ou parte), ex.: 'feijoada'" }, customer: { type: "string", description: "Cliente (opcional, para filtrar)" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "log_change_requests",
    description:
      "Regista alterações pedidas pelo cliente fora da app (email, WhatsApp, chamada) num conteúdo: cada pedido vira um comentário do cliente (aberto) e o conteúdo passa para \"Alterações pedidas\" se estava em aprovação/aprovado/agendado. Não é preciso marcar o frame: são comentários gerais do conteúdo.",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Id ou nome do conteúdo (de find_content)" },
        customer: { type: "string", description: "Cliente, para desambiguar o nome (opcional)" },
        changes: { type: "array", items: { type: "string" }, description: "Um pedido por item, curto e acionável (ex.: 'Trocar a música por uma mais calma')" },
        from: { type: "string", description: "Quem pediu (nome/email), se souber" },
        source: { type: "string", description: "Por onde chegou: email, whatsapp, chamada…" },
      },
      required: ["content", "changes"],
      additionalProperties: false,
    },
  },
];

/** Método que a IA segue para criar rascunhos (no system prompt do assistente e nas instruções do MCP). */
export const CONTENT_SKILL = `
Rascunhos de conteúdo (skill):
- Pedido típico: "vou gravar 4 reels e 2 carrosséis para a Carioca na próxima semana sobre o novo menu". Objetivo: deixar tudo pronto para a equipa só carregar os ficheiros.
- 1) Cliente: se o nome não for exato, chame find_customers; se houver mais do que um candidato, pergunte qual. Nunca crie para um cliente que não existe.
- 2) Briefing: chame get_customer_brief e escreva NA VOZ DA MARCA (voice, dos/donts, keywords) e na língua do cliente (customer.lang: pt/en/nl). Não repita temas de recent_posts. Não invente factos, preços, prémios ou pessoas; o que não souber fica nas production_notes como "confirmar com o cliente".
- 3) Datas: espalhe as publicações pelo período pedido sem chocar com busy_slots (máx. 1 por dia e por tipo, salvo pedido); horas por omissão 18:00 em Amesterdão (formato "AAAA-MM-DD HH:mm"). Prazos: due_finish 2 dias antes da publicação, due_deliver 1 dia antes. Sem período definido: deixe sem data.
- 4) Cada rascunho: title "[WEEK nn · POST #n] tema", caption pronta a publicar (gancho na 1.ª linha, corpo curto, CTA), 5–12 hashtags relevantes (sem #), production_notes (ideia, gancho dos 3 primeiros segundos, formato e duração, texto no ecrã, CTA) e shot_list (planos concretos). Carrossel: diga nas notas o texto de cada slide. Story: 1 ideia + CTA/sticker.
- 5) Mostre o plano numa tabela curta (data · tipo · título · ideia) e chame create_content_drafts com todos de uma vez. No assistente o utilizador confirma na interface; no MCP grava logo — diga antes o que vai criar.
- 6) No fim: diga quantos foram criados e que estão em Rascunhos, internos, à espera do ficheiro. Sugira próximos passos, ex.: [[ações: Planear as gravações na semana | Ajustar as legendas | Criar mais 2 stories]]

Alterações pedidas por email (skill):
- Quando o utilizador colar/resumir um email ou mensagem do cliente com alterações ("foram pedidas alterações por email", "regista isto no reel da feijoada"): encontre o conteúdo com find_content (pelo nome; use o cliente para desambiguar). Se houver vários candidatos, pergunte qual — mostre título · cliente · estado.
- Transforme o texto em pedidos curtos e acionáveis, um por item, na língua do cliente (sem saudações, assinaturas nem elogios; mantenha tempos/detalhes concretos como "aos 0:12"). Não invente pedidos.
- Mostre a lista e chame log_change_requests (content = id, changes, from = quem pediu, source = email/whatsapp…). Não é preciso marcar frames: ficam como comentários gerais do conteúdo, que passa para "Alterações pedidas".
- Depois sugira: [[ações: Abrir o conteúdo | Criar tarefa para a edição | Responder ao cliente]]`;
