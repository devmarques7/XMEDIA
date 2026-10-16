import { handleRpc, type RpcRequest } from "@/lib/mcp/rpc";
import { runServerTool } from "@/lib/server/mcpTools";

export const maxDuration = 60;

/** Compara o token em tempo constante. */
function authorized(req: Request) {
  const expected = process.env.MCP_TOKEN ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!expected || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

/**
 * Servidor MCP da XMEDIA (Streamable HTTP, sem sessão; cada POST é uma mensagem ou lote JSON-RPC).
 * Ligar no Claude Code:
 *   claude mcp add --transport http xmedia https://<domínio>/api/mcp --header "Authorization: Bearer <MCP_TOKEN>"
 */
export async function POST(req: Request) {
  if (!process.env.MCP_TOKEN) return Response.json({ error: "MCP_TOKEN não definido na Vercel" }, { status: 503 });
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  let body: RpcRequest | RpcRequest[];
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const msgs = Array.isArray(body) ? body : [body];
  const out = (await Promise.all(msgs.map((m) => handleRpc(m, runServerTool)))).filter((r) => r !== null);
  if (!out.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? out : out[0]);
}

export async function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
export const DELETE = GET;
