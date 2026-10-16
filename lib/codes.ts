// Códigos de série (login do funcionário), tokens de convite e sessão assinada.
// Só Web Crypto: funciona no browser, em route handlers e no middleware (edge).

// Crockford base32 sem I, L, O, U (evita confusões ao ditar/escrever)
const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const INVITE_DAYS = 7;
export const SESSION_DAYS = 30;
export const MEMBER_COOKIE = "xm_member";
/** Sessão do cliente no portal; o valor assinado leva o prefixo "c_" para não servir como sessão de funcionário. */
export const CLIENT_COOKIE = "xm_client";
export const CLIENT_PREFIX = "c_";

function randomChars(n: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => ALPHA[b % 32]).join("");
}

/** Ex.: XM-7K4QD-9P2MZ (10 caracteres aleatórios ≈ 50 bits). */
export function newSerialCode() {
  const c = randomChars(10);
  return `XM-${c.slice(0, 5)}-${c.slice(5)}`;
}

/** Aceita minúsculas, espaços, sem hífens e troca O→0, I/L→1. */
export function normalizeCode(input: string) {
  let s = input.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.startsWith("XM")) s = s.slice(2);
  if (s.length !== 10 || [...s].some((ch) => !ALPHA.includes(ch))) return null;
  return `XM-${s.slice(0, 5)}-${s.slice(5)}`;
}

export const codeHint = (code: string) => `••••-${code.slice(-4)}`;

export function randomToken(bytes = 32) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256(s: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

/** Sessão do funcionário: "<memberId>.<expira em ms>.<hmac>". */
export async function signSession(memberId: string, secret: string, days = SESSION_DAYS) {
  const exp = Date.now() + days * 86_400_000;
  return `${memberId}.${exp}.${await hmac(secret, `${memberId}.${exp}`)}`;
}

export async function verifySession(value: string | undefined, secret: string): Promise<string | null> {
  if (!value || !secret) return null;
  const [id, exp, sig] = value.split(".");
  if (!id || !exp || !sig || Number(exp) < Date.now()) return null;
  const good = await hmac(secret, `${id}.${exp}`);
  if (good.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? id : null;
}

export function maskEmail(email: string) {
  const [u, d] = email.split("@");
  if (!d) return email;
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}
