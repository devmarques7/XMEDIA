// Pessoas do portal de um cliente: convite (link de uso único /portal/convite/<token>, só o hash é guardado) — o mesmo
// fluxo para o admin (ficha do cliente) e para o responsável do cliente (portal → Conta → Equipa).
import { INVITE_DAYS, randomToken } from "@/lib/codes";
import { CUSTOMER_USER_ROLES, type Customer, type CustomerUserRole } from "@/lib/customer";
import { sendEmail } from "@/lib/inviteEmail";
import { portalInviteEmail } from "@/lib/portalInviteEmail";
import { HttpError, hashToken, serviceClient } from "./admin";
import { listCustomerUsers, refreshPortalSummary } from "./portal";
import type { Lang } from "@/lib/i18n";

const EMAIL = /^[^@\s,()]+@[^@\s,()]+\.[^@\s,()]+$/;

/** `lang`: língua do email escolhida no envio (sem ela, a do cliente; e inglês se nenhuma). */
export async function createInvite(c: Customer, userId: string, send: boolean, origin: string, lang?: Lang, next?: string) {
  if (c.portal.status === "disabled") throw new HttpError(409, "disabled");
  const db = serviceClient();
  const { data: u } = await db.from("customer_users").select("id, email, name, status").eq("id", userId).eq("customer_id", c.id).maybeSingle();
  if (!u) throw new HttpError(404, "not_found");
  if (u.status === "disabled") throw new HttpError(409, "disabled");
  const token = randomToken();
  const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const { error } = await db
    .from("customer_users")
    .update({ invite_token_hash: await hashToken(token), invite_expires_at: expires.toISOString(), invited_at: new Date().toISOString(), status: u.status === "active" ? "active" : "invited" })
    .eq("id", u.id);
  if (error) throw error;
  await refreshPortalSummary(c.id);
  const link = `${origin}/portal/convite/${token}${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const mail = portalInviteEmail({ lang: lang ?? c.lang ?? "en", name: u.name || u.email, customer: c.name, email: u.email, link, expiresAt: expires, origin });
  const email = send ? await sendEmail(u.email, mail) : { sent: false, reason: "not_sent" };
  return { link, expiresAt: expires.toISOString(), email, preview: { subject: mail.subject, html: mail.html, to: u.email } };
}

export async function saveUser(customerId: string, b: { id?: string; name?: string; email?: string; role?: CustomerUserRole }) {
  const role = CUSTOMER_USER_ROLES.includes(b.role as CustomerUserRole) ? b.role! : "member";
  const name = (b.name ?? "").trim().slice(0, 80);
  const db = serviceClient();
  if (b.id) {
    const { error } = await db.from("customer_users").update({ name, role }).eq("id", b.id).eq("customer_id", customerId);
    if (error) throw error;
  } else {
    const email = (b.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) throw new HttpError(400, "bad_email");
    const { error } = await db.from("customer_users").insert({ customer_id: customerId, email, name, role, status: "invited" });
    if (error) throw new HttpError(409, error.code === "23505" ? "email_in_use" : error.message);
  }
  await refreshPortalSummary(customerId);
  return listCustomerUsers(customerId);
}

export async function removeUser(customerId: string, id: string) {
  await serviceClient().from("customer_users").delete().eq("id", id).eq("customer_id", customerId);
  await refreshPortalSummary(customerId);
  return listCustomerUsers(customerId);
}
