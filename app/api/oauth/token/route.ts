import { CORS, OAuthError, exchange } from "@/lib/server/mcpOAuth";

/** Endpoint de token: troca o código (com PKCE) ou renova o acesso. */
export async function POST(req: Request) {
  try {
    const type = req.headers.get("content-type") ?? "";
    const form = type.includes("application/json") ? new URLSearchParams((await req.json()) as Record<string, string>) : new URLSearchParams(await req.text());
    return Response.json(await exchange(form), { headers: { ...CORS, "Cache-Control": "no-store", Pragma: "no-cache" } });
  } catch (e) {
    const err = e instanceof OAuthError ? e : new OAuthError("server_error", (e as Error).message, 500);
    return Response.json({ error: err.code, error_description: err.message }, { status: err.status === 500 ? 500 : 400, headers: { ...CORS, "Cache-Control": "no-store" } });
  }
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
