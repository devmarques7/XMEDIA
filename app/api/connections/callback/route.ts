import { NextResponse } from "next/server";
import { HttpError, requireAdmin } from "@/lib/server/admin";
import { OAUTH_COOKIE, exchangeCode, loadConnections, sealSecret, updateConnection } from "@/lib/server/connections";
import { decrypt } from "@/lib/server/vault";

/** Volta da app externa: confirma o estado, troca o código pelo token e guarda-o cifrado. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (code: string) => {
    const res = NextResponse.redirect(new URL(`/definicoes?conn=${encodeURIComponent(code)}#ligacoes`, url.origin), 303);
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/connections", maxAge: 0 });
    return res;
  };
  const raw = req.headers.get("cookie")?.split(/;\s*/).find((x) => x.startsWith(`${OAUTH_COOKIE}=`))?.slice(OAUTH_COOKIE.length + 1);
  try {
    const user = await requireAdmin();
    if (url.searchParams.get("error")) throw new HttpError(400, `oauth_${url.searchParams.get("error")}`);
    if (!raw) throw new HttpError(400, "oauth_expired");
    const p = JSON.parse(await decrypt(JSON.parse(decodeURIComponent(raw)), `conn-oauth:${user.id}`)) as { id: string; state: string; verifier: string; redirect: string; token_endpoint: string; client_id: string; client_secret?: string; exp: number };
    if (p.exp < Date.now()) throw new HttpError(400, "oauth_expired");
    if (url.searchParams.get("state") !== p.state) throw new HttpError(400, "oauth_state");
    const code = url.searchParams.get("code");
    if (!code) throw new HttpError(400, "oauth_no_code");
    const c = (await loadConnections(user.id)).find((x) => x.id === p.id);
    if (!c) throw new HttpError(404, "not_found");
    const s = await exchangeCode({ token_endpoint: p.token_endpoint, client_id: p.client_id, client_secret: p.client_secret, code, verifier: p.verifier, redirect_uri: p.redirect, resource: c.url });
    const secret = await sealSecret(c, s);
    await updateConnection(user.id, c.id, (x) => ({ ...x, secret, connected_at: new Date().toISOString(), error: undefined, enabled: true }));
    return back("ok");
  } catch (e) {
    return back(e instanceof Error ? e.message : "error");
  }
}
