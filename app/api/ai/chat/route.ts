import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, TOOLS } from "@/lib/ai/tools";
import { requirePerm } from "@/lib/server/admin";
import { mcpForChat } from "@/lib/server/connections";

export const maxDuration = 120;

const MODEL = "claude-opus-5-5";
const supabaseOn = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Uma volta do assistente: recebe o histórico (o browser guarda-o e executa as ferramentas),
 * pede ao Claude a próxima resposta e devolve-a tal como veio (incl. blocos de thinking/fallback,
 * que têm de voltar sem alterações no pedido seguinte).
 */
export async function POST(req: Request) {
  // acesso: com Supabase, o administrador ou quem ele autorizou (permissão ai.use, Definições → Assistente IA);
  // em modo local, um código definido na Vercel
  let owner = "";
  if (supabaseOn()) {
    try {
      owner = (await requirePerm("ai.use")).ownerId;
    } catch {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  } else {
    const code = process.env.AI_ACCESS_CODE;
    if (!code) return Response.json({ error: "ai_not_configured" }, { status: 503 });
    if (req.headers.get("x-xmedia-ai-code") !== code) return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_api_key" }, { status: 503 });

  const raw = await req.text();
  if (raw.length > 600_000) return Response.json({ error: "too_large" }, { status: 413 });
  let messages: Anthropic.Beta.BetaMessageParam[];
  try {
    messages = (JSON.parse(raw) as { messages: Anthropic.Beta.BetaMessageParam[] }).messages;
    if (!Array.isArray(messages) || !messages.length || messages.length > 300 || messages[0].role !== "user") throw new Error();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // apps ligadas por MCP (Canva, Notion…): o Claude chama-as diretamente; só com Supabase (os tokens vivem no servidor)
  const mcp = owner ? await mcpForChat(owner) : { servers: [], toolsets: [], names: [] };
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }];
  if (mcp.names.length) system.push({ type: "text", text: `Apps ligadas agora: ${mcp.names.join(", ")}.` });

  const client = new Anthropic();
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // prefixo estável (ferramentas + sistema) em cache; o contexto variável vai nas mensagens
      system,
      tools: [...TOOLS, ...mcp.toolsets],
      ...(mcp.servers.length ? { mcp_servers: mcp.servers } : {}),
      messages,
      output_config: { effort: "medium" },
      // se o modelo recusar por política, o próprio pedido continua num modelo de reserva
      betas: ["server-side-fallback-2026-07-01", ...(mcp.servers.length ? ["mcp-client-2025-11-20"] : [])],
      fallbacks: "default",
    });
    return Response.json({ content: res.content, stop_reason: res.stop_reason, stop_details: res.stop_details ?? null, model: res.model });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "no_api_key" }, { status: 503 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "rate_limited" }, { status: 429 });
    if (e instanceof Anthropic.BadRequestError) return Response.json({ error: "bad_request", detail: e.message }, { status: 400 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: "api_error", detail: e.message }, { status: 502 });
    return Response.json({ error: "api_error" }, { status: 502 });
  }
}
