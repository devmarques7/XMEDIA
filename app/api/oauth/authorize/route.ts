import { requireAdmin } from "@/lib/server/admin";
import { OAuthError, checkAuthRequest, issueCode, originOf } from "@/lib/server/mcpOAuth";

/** Decisão do ecrã de autorização: volta ao cliente MCP com ?code= (permitir) ou ?error=access_denied. */
export async function POST(req: Request) {
  const form = await req.formData();
  const q = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  let r: ReturnType<typeof checkAuthRequest>;
  try {
    r = checkAuthRequest(q);
  } catch (e) {
    return Response.json({ error: e instanceof OAuthError ? e.code : "invalid_request" }, { status: 400 });
  }
  const back = new URL(r.redirect_uri);
  if (r.state) back.searchParams.set("state", r.state);
  back.searchParams.set("iss", originOf(req));
  if (q.decision !== "allow") {
    back.searchParams.set("error", "access_denied");
    return Response.redirect(back.toString(), 303);
  }
  let user;
  try {
    user = await requireAdmin();
  } catch {
    return Response.redirect(`${originOf(req)}/login?as=admin`, 303);
  }
  back.searchParams.set("code", issueCode(r, user.id));
  return Response.redirect(back.toString(), 303);
}
