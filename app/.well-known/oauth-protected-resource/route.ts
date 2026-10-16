import { CORS, originOf, protectedResource } from "@/lib/server/mcpOAuth";

/** Metadados do recurso protegido (RFC 9728): diz aos clientes MCP onde fazer login. */
export function GET(req: Request) {
  return Response.json(protectedResource(originOf(req)), { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
