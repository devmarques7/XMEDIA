import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashToken, serviceClient } from "@/lib/server/admin";
import { loadCustomer, refreshPortalSummary, requireCustomer, setClientCookie } from "@/lib/server/portal";
import { supabaseServer } from "@/lib/supabase/server";

const INVITE = "xm_portal_invite";

/**
 * Volta do Google para o portal. O Google só identifica o email: a sessão Supabase termina logo
 * (clientes não são administradores) e fica o cookie assinado do portal, do utilizador.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const to = (path: string) => NextResponse.redirect(`${origin}${path}`);
  const code = searchParams.get("code");
  if (!code) return to("/portal/login?error=auth");

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  const email = data.user?.email?.toLowerCase() ?? "";
  await sb.auth.signOut();
  if (error || !email) return to("/portal/login?error=auth");

  const jar = await cookies();
  const token = jar.get(INVITE)?.value;
  jar.delete(INVITE);
  const db = serviceClient();
  const now = new Date().toISOString();

  try {
    // onboarding: quem já entrou com o código liga agora a conta Google → email validado
    if (searchParams.get("link") === "1") {
      try {
        const { user } = await requireCustomer();
        await db.from("customer_users").update({ google_email: email, last_login_at: now }).eq("id", user.id);
        return to("/portal/bem-vindo?verified=1");
      } catch {
        return to("/portal/login?error=auth");
      }
    }
    if (token) {
      const { data: u } = await db.from("customer_users").select("id, customer_id, role, status, invite_expires_at, passcode_hash").eq("invite_token_hash", await hashToken(token)).maybeSingle();
      if (!u) return to("/portal/login?error=invalid");
      if (u.status === "disabled") return to("/portal/login?error=disabled");
      if (!u.invite_expires_at || new Date(u.invite_expires_at) < new Date()) return to("/portal/login?error=expired");
      const row = await loadCustomer(u.customer_id);
      if (!row || row.customer.portal.status === "disabled") return to("/portal/login?error=disabled");
      await db.from("customer_users").update({ google_email: email, status: "active", invite_token_hash: null, invite_expires_at: null, registered_at: now, last_login_at: now }).eq("id", u.id);
      await refreshPortalSummary(u.customer_id);
      await setClientCookie(u.id);
      return to(u.passcode_hash ? "/portal" : "/portal/bem-vindo");
    }

    // sem convite: utilizador já registado que entra com Google (outro dispositivo / esqueceu o código)
    const cols = "id, customer_id, status, passcode_hash, email, google_email";
    const [{ data: a1 }, { data: a2 }] = await Promise.all([
      db.from("customer_users").select(cols).eq("google_email", email),
      db.from("customer_users").select(cols).eq("email", email),
    ]);
    for (const u of [...(a1 ?? []), ...(a2 ?? [])]) {
      if (u.status !== "active") continue;
      const row = await loadCustomer(u.customer_id);
      if (!row || row.customer.portal.status === "disabled") continue;
      await db.from("customer_users").update({ last_login_at: now, google_email: u.google_email ?? email }).eq("id", u.id);
      await setClientCookie(u.id);
      return to(u.passcode_hash ? "/portal" : "/portal/bem-vindo");
    }
    return to("/portal/login?error=no_account");
  } catch {
    return to("/portal/login?error=auth");
  }
}
