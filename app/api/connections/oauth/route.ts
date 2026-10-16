import { NextResponse } from "next/server";
import { HttpError, requireAdmin } from "@/lib/server/admin";
import { OAUTH_COOKIE, discover, loadConnections, pkce, register } from "@/lib/server/connections";
import { encrypt } from "@/lib/server/vault";

/** Inicia a autorização: descobre o servidor, regista o XMEDIA como cliente e envia o utilizador para o login da app. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (code: string) => Response.redirect(new URL(`/definicoes?conn=${encodeURIComponent(code)}#ligacoes`, url.origin), 303);
  try {
    const user = await requireAdmin();
    if (!process.env.VAULT_KEY) throw new HttpError(503, "vault_not_configured");
    const id = url.searchParams.get("id") ?? "";
    const c = (await loadConnections(user.id)).find((x) => x.id === id);
    if (!c) throw new HttpError(404, "not_found");
    const redirect = `${url.origin}/api/connections/callback`;
    const { meta, scope } = await discover(c.url);
    const client = await register(meta, redirect);
    const { verifier, challenge } = pkce();
    const state = crypto.randomUUID();
    // estado temporário (10 min) num cookie cifrado: nada disto fica guardado se o utilizador desistir
    const blob = await encrypt(JSON.stringify({ id, state, verifier, redirect, token_endpoint: meta.token_endpoint, ...client, exp: Date.now() + 600_000 }), `conn-oauth:${user.id}`);
    const to = new URL(meta.authorization_endpoint);
    to.searchParams.set("response_type", "code");
    to.searchParams.set("client_id", client.client_id);
    to.searchParams.set("redirect_uri", redirect);
    to.searchParams.set("code_challenge", await challenge);
    to.searchParams.set("code_challenge_method", "S256");
    to.searchParams.set("state", state);
    to.searchParams.set("resource", c.url);
    if (scope) to.searchParams.set("scope", scope);
    const res = NextResponse.redirect(to.toString(), 303);
    res.cookies.set(OAUTH_COOKIE, JSON.stringify(blob), { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/api/connections", maxAge: 600 });
    return res;
  } catch (e) {
    return back(e instanceof Error ? e.message : "error");
  }
}
