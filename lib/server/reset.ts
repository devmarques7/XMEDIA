// Redefinir o código de acesso por email (admin, equipa e clientes) — sem tabelas novas.
// O link leva um token assinado (HMAC com a chave de sessão): conta, email, validade (30 min) e uma "versão" do
// código atual. Ao mudar o código a versão muda e o link deixa de funcionar (uso único).
import { sha256 } from "../codes";
import { validPasscode } from "../customer";
import { resetEmail } from "../resetEmail";
import type { Lang } from "../i18n";
import { sendEmail } from "../inviteEmail";
import { HttpError, serviceClient, sessionSecret } from "./admin";
import { adminEmails, hashMemberPasscode } from "./auth";
import { hashPasscode } from "./portal";

type Kind = "admin" | "member" | "client";
type Payload = { k: Kind; id: string; e: string; x: number; v: string };
const TTL = 30 * 60_000;

const b64u = (s: string) => Buffer.from(s).toString("base64url");
const unb64u = (s: string) => Buffer.from(s, "base64url").toString();
async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`reset:${data}`))).toString("base64url");
}

/** Versão do código atual (muda quando o código muda → link de uso único). */
async function version(k: Kind, id: string): Promise<string> {
  const db = serviceClient();
  if (k === "admin") {
    const { data } = await db.from("admin_access").select("updated_at").eq("email", id).maybeSingle();
    return (await sha256(`a:${data?.updated_at ?? ""}`)).slice(0, 16);
  }
  const { data } = await db.from(k === "member" ? "team_members" : "customer_users").select("passcode_hash").eq("id", id).maybeSingle();
  return (await sha256(`p:${data?.passcode_hash ?? ""}`)).slice(0, 16);
}

type Account = { k: Kind; id: string; email: string; name: string; lang: Lang };
/** Conta associada ao email (mesma prioridade do login: admin → equipa → cliente). */
async function accountOf(email: string): Promise<Account | null> {
  const db = serviceClient();
  const admins = adminEmails();
  if (admins.includes(email)) return { k: "admin", id: email, email, name: "", lang: "pt" };
  const { data: ms } = await db.from("team_members").select("id, name, lang, status, active").eq("email", email);
  const m = (ms ?? []).find((x) => x.status === "active" && x.active);
  if (m) return { k: "member", id: m.id, email, name: m.name, lang: (m.lang as Lang) || "en" };
  const cols = "id, name, status, customer_id";
  const [{ data: a }, { data: b }] = await Promise.all([db.from("customer_users").select(cols).eq("email", email), db.from("customer_users").select(cols).eq("google_email", email)]);
  const u = [...(a ?? []), ...(b ?? [])].find((x) => x.status === "active");
  if (u) {
    const { data: c } = await db.from("customers").select("data").eq("id", u.customer_id).maybeSingle();
    return { k: "client", id: u.id, email, name: u.name, lang: ((c?.data as { lang?: Lang } | null)?.lang as Lang) || "en" };
  }
  return null;
}

export async function makeToken(a: Pick<Account, "k" | "id" | "email">) {
  const p: Payload = { k: a.k, id: a.id, e: a.email, x: Date.now() + TTL, v: await version(a.k, a.id) };
  const body = b64u(JSON.stringify(p));
  return `${body}.${await hmac(body)}`;
}

export async function readToken(token: string): Promise<Payload> {
  const [body, sig] = token.split(".");
  if (!body || !sig || (await hmac(body)) !== sig) throw new HttpError(404, "invalid");
  let p: Payload;
  try {
    p = JSON.parse(unb64u(body));
  } catch {
    throw new HttpError(404, "invalid");
  }
  if (p.x < Date.now()) throw new HttpError(410, "expired");
  if ((await version(p.k, p.id)) !== p.v) throw new HttpError(410, "used");
  return p;
}

/** Pede a redefinição: se o email tiver conta, envia o link. Responde sempre o mesmo (não revela se a conta existe). */
export async function requestReset(rawEmail: string, origin: string, uiLang: Lang) {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "bad_email");
  const a = await accountOf(email);
  if (!a) return;
  const link = `${origin}/redefinir/${await makeToken(a)}`;
  await sendEmail(email, resetEmail({ lang: a.k === "admin" ? uiLang : a.lang, origin, link }));
}

/** Grava o código novo (o link fica inválido porque a versão muda). */
export async function applyReset(token: string, code: string): Promise<Payload> {
  const p = await readToken(token);
  if (!validPasscode(code)) throw new HttpError(400, "bad_passcode");
  const db = serviceClient();
  if (p.k === "admin") {
    const { error } = await db.rpc("set_admin_passcode", { p_email: p.id, p_code: code });
    if (error) throw error;
  } else if (p.k === "member") {
    const { error } = await db.from("team_members").update({ passcode_hash: await hashMemberPasscode(p.id, code), login_code_hash: null, code_hint: "" }).eq("id", p.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("customer_users").update({ passcode_hash: await hashPasscode(p.id, code) }).eq("id", p.id);
    if (error) throw error;
  }
  return p;
}
