// Login único: email + código de 4–6 dígitos. Decide se é admin, funcionário ou cliente e cria a sessão certa.
// - admin: sessão Supabase real (sem Google) via link mágico gerado e validado no servidor → RLS continua a funcionar
// - funcionário: cookie xm_member · cliente: cookie xm_client
import { sha256 } from "@/lib/codes";
import { validPasscode } from "@/lib/customer";
import { supabaseServer } from "@/lib/supabase/server";
import { HttpError, clientIp, serviceClient, sessionSecret, setMemberCookie } from "./admin";
import { hashPasscode, loadCustomer, patchCustomer, setClientCookie } from "./portal";
import { seedOwnerIfEmpty } from "./seed";

const MAX_IP_FAILS = 20; // por IP, 15 min
const MAX_EMAIL_FAILS = 5; // por email, 15 min

export const hashMemberPasscode = (memberId: string, code: string) => sha256(`member:${sessionSecret()}:${memberId}:${code}`);

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Cria (se preciso) o utilizador Supabase e inicia sessão com cookies, sem passar pelo email (admin e members com papel). */
export async function startUserSession(email: string) {
  const db = serviceClient();
  await db.auth.admin.createUser({ email, email_confirm: true }).catch(() => null); // já existe → ignora
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) throw new HttpError(500, `auth_link: ${error?.message ?? "no_token"}`);
  const sb = await supabaseServer();
  const { data: s, error: vErr } = await sb.auth.verifyOtp({ type: "email", token_hash: data.properties.hashed_token });
  if (vErr || !s.user) throw new HttpError(500, `auth_verify: ${vErr?.message ?? "no_user"}`);
  return s.user.id;
}

type Result = { to: string; role: "admin" | "member" | "client"; name?: string; lang?: string };

export async function loginWithPasscode(req: Request, rawEmail: string, code: string): Promise<Result> {
  const email = rawEmail.trim().toLowerCase();
  const db = serviceClient();
  const ip = clientIp(req);
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const [{ count: ipFails }, { count: emailFails }] = await Promise.all([
    db.from("portal_login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).eq("ok", false).gte("at", since),
    db.from("portal_login_attempts").select("id", { count: "exact", head: true }).eq("email", email).eq("ok", false).gte("at", since),
  ]);
  if ((ipFails ?? 0) >= MAX_IP_FAILS) throw new HttpError(429, "too_many");
  if ((emailFails ?? 0) >= MAX_EMAIL_FAILS) throw new HttpError(429, "locked");

  const ok = async (r: Result) => {
    await db.from("portal_login_attempts").insert({ ip, ok: true, email });
    return r;
  };

  if (email && validPasscode(code)) {
    // 1) administrador
    const admins = adminEmails();
    if (!admins.length || admins.includes(email)) {
      const { data: isAdmin } = await db.rpc("check_admin_passcode", { p_email: email, p_code: code });
      if (isAdmin === true) {
        const uid = await startUserSession(email);
        await seedOwnerIfEmpty(uid).catch(() => null);
        return ok({ to: "/home", role: "admin" });
      }
    }

    // 2) funcionário
    const { data: members } = await db.from("team_members").select("id, owner_id, name, lang, status, active, passcode_hash, app_role").eq("email", email);
    for (const m of members ?? []) {
      if (m.status === "active" && m.active && m.passcode_hash && m.passcode_hash === (await hashMemberPasscode(m.id, code))) {
        await db.from("team_members").update({ last_login_at: new Date().toISOString() }).eq("id", m.id);
        await setMemberCookie(m.id);
        // com papel na plataforma: sessão Supabase ligada ao workspace do admin (o RLS aplica as permissões)
        if (m.app_role && m.app_role !== "none") {
          const uid = await startUserSession(email);
          if (uid === m.owner_id) throw new HttpError(409, "member_is_owner");
          const { error } = await db.from("workspace_members").upsert({ user_id: uid, owner_id: m.owner_id, member_id: m.id });
          if (error) throw error;
          return ok({ to: "/home", role: "member", name: m.name, lang: m.lang });
        }
        return ok({ to: "/eu", role: "member", name: m.name, lang: m.lang });
      }
    }

    // 3) utilizador de um cliente (email do convite ou conta Google ligada)
    const cols = "id, customer_id, name, status, passcode_hash";
    const [{ data: byEmail }, { data: byGoogle }] = await Promise.all([
      db.from("customer_users").select(cols).eq("email", email),
      db.from("customer_users").select(cols).eq("google_email", email),
    ]);
    const users = [...(byEmail ?? []), ...(byGoogle ?? [])].filter((u, i, all) => all.findIndex((x) => x.id === u.id) === i);
    for (const u of users) {
      if (u.status !== "active" || !u.passcode_hash || u.passcode_hash !== (await hashPasscode(u.id, code))) continue;
      const row = await loadCustomer(u.customer_id);
      if (!row || row.customer.portal.status === "disabled") continue;
      await db.from("customer_users").update({ last_login_at: new Date().toISOString() }).eq("id", u.id);
      await patchCustomer(u.customer_id, (x) => ({ ...x, portal: { ...x.portal, last_login_at: new Date().toISOString() } }));
      await setClientCookie(u.id);
      return ok({ to: "/portal", role: "client", name: row.customer.name, lang: row.customer.lang });
    }
  }

  await db.from("portal_login_attempts").insert({ ip, ok: false, email });
  await new Promise((r) => setTimeout(r, 400));
  throw new HttpError(401, "bad_passcode");
}
