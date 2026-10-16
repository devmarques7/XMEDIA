import { cookies } from "next/headers";
import { validPasscode } from "@/lib/customer";
import { HttpError, fail, hashToken, serviceClient } from "@/lib/server/admin";
import { hashPasscode, loadCustomer, refreshPortalSummary, setClientCookie } from "@/lib/server/portal";

const PORTAL_INVITE_COOKIE = "xm_portal_invite";
type Ctx = { params: Promise<{ token: string }> };

/** Convite = um utilizador (pessoa) de um cliente. */
async function byToken(token: string) {
  if (!/^[\w-]{20,100}$/.test(token)) throw new HttpError(404, "invalid");
  const { data: u } = await serviceClient()
    .from("customer_users")
    .select("id, customer_id, email, name, role, status, invite_expires_at")
    .eq("invite_token_hash", await hashToken(token))
    .maybeSingle();
  if (!u) throw new HttpError(404, "invalid");
  if (u.status === "disabled") throw new HttpError(403, "disabled");
  if (!u.invite_expires_at || new Date(u.invite_expires_at) < new Date()) throw new HttpError(410, "expired");
  const row = await loadCustomer(u.customer_id);
  if (!row) throw new HttpError(404, "invalid");
  if (row.customer.portal.status === "disabled") throw new HttpError(403, "disabled");
  return { ...row, user: u };
}

/** Dados para preencher o ecrã do convite: cliente, nome e email da pessoa (quem tem o link é o destinatário). */
export async function GET(_: Request, { params }: Ctx) {
  try {
    const { customer: c, user } = await byToken((await params).token);
    return Response.json({ name: c.name, person: user.name, email: user.email, role: user.role, lang: c.lang, expiresAt: user.invite_expires_at });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Com { code }: aceita já com o código de 4–6 dígitos e inicia sessão.
 * Sem código: guarda o convite num cookie curto e o login Google termina em /portal/auth/callback.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const token = (await params).token;
    const { customer: c, user } = await byToken(token);
    const { code } = (await req.json().catch(() => ({}))) as { code?: string };
    if (code !== undefined) {
      if (!validPasscode(code)) throw new HttpError(400, "bad_passcode");
      const now = new Date().toISOString();
      const { error } = await serviceClient()
        .from("customer_users")
        .update({ passcode_hash: await hashPasscode(user.id, code), status: "active", invite_token_hash: null, invite_expires_at: null, registered_at: now, last_login_at: now })
        .eq("id", user.id);
      if (error) throw error;
      await refreshPortalSummary(c.id);
      await setClientCookie(user.id);
      return Response.json({ ok: true, to: "/portal/bem-vindo" }); // segue para validar o email (e Instagram)
    }
    (await cookies()).set(PORTAL_INVITE_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 60 });
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
