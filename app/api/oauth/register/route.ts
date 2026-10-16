import { CORS, OAuthError, registerClient } from "@/lib/server/mcpOAuth";

/** Registo dinâmico de clientes (RFC 7591) — o Claude regista-se sozinho ao adicionar o conector. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { redirect_uris?: unknown; client_name?: unknown };
    const c = registerClient(body);
    return Response.json(
      { ...c, client_id_issued_at: Math.floor(Date.now() / 1000), grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" },
      { status: 201, headers: CORS }
    );
  } catch (e) {
    const err = e instanceof OAuthError ? e : new OAuthError("invalid_client_metadata", "pedido inválido");
    return Response.json({ error: err.code, error_description: err.message }, { status: 400, headers: CORS });
  }
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
