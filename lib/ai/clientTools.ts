// Ferramentas MCP dos clientes: processo (quadro e etapas), conteúdos (mover, comentar/checklist), identidade visual,
// tarefas e importação JSON. Executadas no servidor (lib/server/clientMcp.ts) no âmbito do dono.
import type Anthropic from "@anthropic-ai/sdk";

const customer = { type: "string", description: "Id ou nome do cliente (ex.: 'Carioca Restaurant')" };

export const CLIENT_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "list_customers",
    description: "Lista os clientes (id, nome, tipo empresa/pessoa, fase, email, portal, nº de conteúdos por etapa do processo).",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Filtro por nome/email (opcional)" } }, additionalProperties: false },
  },
  {
    name: "get_content_board",
    description: "Quadro de conteúdos de um cliente agrupado pelas etapas DO PROCESSO DELE (nome, grupo, prazo), com cada conteúdo (id, tipo, título, estado, data, comentários abertos, validação).",
    input_schema: { type: "object", properties: { customer }, required: ["customer"], additionalProperties: false },
  },
  {
    name: "move_content",
    description: "Move um conteúdo para uma etapa do processo do cliente (id ou nome da etapa). Muda o estado interno quando a etapa cobre fases (ex.: Preview → para aprovação do cliente).",
    input_schema: { type: "object", properties: { post_id: { type: "string" }, stage: { type: "string" } }, required: ["post_id", "stage"], additionalProperties: false },
  },
  {
    name: "comment_content",
    description: "Comentário do estúdio num conteúdo. Com as_checklist=true separa o texto em vários itens de checklist (um por frase/linha).",
    input_schema: { type: "object", properties: { post_id: { type: "string" }, text: { type: "string" }, as_checklist: { type: "boolean" } }, required: ["post_id", "text"], additionalProperties: false },
  },
  {
    name: "set_client_process",
    description: "Define o processo de um cliente: groups[] e stages[{label, group, days, phases[] (idea|editing|client_review|changes|blocked|approved|scheduled|published), client?, auto?}]. Fases não atribuídas vão para a etapa vizinha.",
    input_schema: { type: "object", properties: { customer, process: { type: "object" } }, required: ["customer", "process"], additionalProperties: false },
  },
  {
    name: "get_brand",
    description: "Identidade visual do cliente (nome, tagline, essência, cores, fontes, persona, voz, imagens) e % preenchida.",
    input_schema: { type: "object", properties: { customer }, required: ["customer"], additionalProperties: false },
  },
  {
    name: "set_brand",
    description: "Atualiza a identidade visual (só os campos enviados): name, tagline, about, keywords[], colors[{name,hex,role:primary|secondary|neutral}], fonts{primary{family,weights,usage},secondary{…}}, persona{name,age,role,goals,pains,channels,quote}, voice[{title,details[]}], dos[], donts[], imagery{notes}.",
    input_schema: { type: "object", properties: { customer, brand: { type: "object" } }, required: ["customer", "brand"], additionalProperties: false },
  },
  {
    name: "create_task",
    description: "Cria uma tarefa. Sem customer = tarefa interna da empresa (XMEDIA). due AAAA-MM-DD (por omissão hoje); post_id liga a um vídeo; assignee = email do responsável; mentions = emails; internal=true só o estúdio vê.",
    input_schema: {
      type: "object",
      properties: { customer, title: { type: "string" }, due: { type: "string", description: "AAAA-MM-DD, 'today' ou vazio para sem data" }, post_id: { type: "string" }, assignee: { type: "string" }, mentions: { type: "array", items: { type: "string" } }, internal: { type: "boolean" } },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "list_today",
    description: "A lista 'Hoje': tarefas atrasadas, de hoje e desta semana de todos os clientes e internas, por prioridade (id, título, cliente, prazo, alertas, vídeo ligado) + vídeos que pedem ação.",
    input_schema: { type: "object", properties: { assignee: { type: "string", description: "Só as deste email (opcional)" } }, additionalProperties: false },
  },
  {
    name: "update_task",
    description: "Atualiza uma tarefa pelo id (de list_today): done (concluir/reabrir), title, due (AAAA-MM-DD ou ''), assignee, progress (todo|doing|review), deleted.",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "string" }, done: { type: "boolean" }, title: { type: "string" }, due: { type: "string" }, assignee: { type: "string" }, progress: { type: "string", enum: ["todo", "doing", "review"] }, deleted: { type: "boolean" } },
      required: ["task_id"],
      additionalProperties: false,
    },
  },
  {
    name: "import_client_json",
    description: "Importa dados de um cliente num só JSON: {client{name,contact,email,phone,lang,stage}, kind, billing{…}, process{…}, brand{…}, tasks[], posts[]}. Só as partes presentes são alteradas; posts são criados.",
    input_schema: { type: "object", properties: { customer, json: { type: "object" } }, required: ["customer", "json"], additionalProperties: false },
  },
];
export const CLIENT_TOOL_NAMES = new Set(CLIENT_TOOLS.map((t) => t.name));
