import { CORS, authServerMetadata, originOf } from "@/lib/server/mcpOAuth";

/** Metadados do servidor de autorização (RFC 8414). */
export function GET(req: Request) {
  return Response.json(authServerMetadata(originOf(req)), { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
