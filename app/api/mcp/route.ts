import { handleRpc, type RpcRequest } from "@/lib/mcp/rpc";
import { runServerTool } from "@/lib/server/mcpTools";
import { CORS, originOf, ownerFromAccessToken } from "@/lib/server/mcpOAuth";

export const maxDuration = 60;

/** Chave fixa (MCP_TOKEN), comparada em tempo constante. */
function staticToken(got: string) {
  const expected = process.env.MCP_TOKEN ?? "";
  if (!expected || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

/** Quem chama: { owner } do login OAuth, {} com a chave fixa (dono por omissão), ou null. */
function caller(req: Request): { owner?: string } | null {
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!got) return null;
  if (staticToken(got)) return {};
  const owner = ownerFromAccessToken(got);
  return owner ? { owner } : null;
}

/**
 * Servidor MCP da XMEDIA (Streamable HTTP, sem sessão; cada POST é uma mensagem ou lote JSON-RPC).
 * Ligar com login (claude.ai → Conectores, Claude Desktop, Claude Code): só o URL https://<domínio>/api/mcp — o
 * cliente descobre o OAuth (/.well-known/…) e abre o ecrã de autorização da XMEDIA.
 * Ou com a chave fixa (Claude Code):
 *   claude mcp add --transport http xmedia https://<domínio>/api/mcp --header "Authorization: Bearer <MCP_TOKEN>"
 */
export async function POST(req: Request) {
  const who = caller(req);
  if (!who) {
    const meta = `${originOf(req)}/.well-known/oauth-protected-resource`;
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { ...CORS, "WWW-Authenticate": `Bearer resource_metadata="${meta}", scope="xmedia"` } });
  }
  let body: RpcRequest | RpcRequest[];
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const msgs = Array.isArray(body) ? body : [body];
  const run = (name: string, args: Record<string, unknown>) => runServerTool(name, args, who.owner);
  const out = (await Promise.all(msgs.map((m) => handleRpc(m, run)))).filter((r) => r !== null);
  if (!out.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? out : out[0]);
}

export async function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST", ...CORS } });
}
export const DELETE = GET;
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
