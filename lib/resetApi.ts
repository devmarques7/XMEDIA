"use client";

// Redefinir o código de acesso. Com Supabase: /api/auth/reset (email com link) e /api/auth/reset/[token].
// Modo local: o "email" não sai — o link aparece no ecrã para testar o fluxo neste navegador.
import { maskEmail } from "./codes";
import type { Lang } from "./i18n";
import { ApiError } from "./memberApi";
import { supabaseEnabled } from "./supabase/client";
import type { LoginResult } from "./authApi";

async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || `http_${r.status}`);
  return j as T;
}

// ---------- modo local ----------
type LocalReset = { kind: "member" | "client"; id: string; email: string; exp: number };
const LS_RESET = "xmedia:resets";
const LS_USERS = "xmedia:customerUsers";
const LS_MEMBERS = "xmedia:members";
const read = <T,>(k: string, d: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) || "") as T;
  } catch {
    return d;
  }
};

export const resetApi = {
  /** Pede o link. Em modo local devolve o link (para mostrar no ecrã). */
  async request(email: string, lang: Lang): Promise<{ localLink?: string }> {
    if (supabaseEnabled) return (await api("/api/auth/reset", { email, lang }), {});
    const e = email.trim().toLowerCase();
    const u = read<{ id: string; email: string; google_email?: string; status: string }[]>(LS_USERS, []).find((x) => x.status === "active" && (x.email === e || x.google_email === e));
    const m = read<{ id: string; email: string; status: string; active: boolean }[]>(LS_MEMBERS, []).find((x) => x.email === e && x.status === "active");
    const acc = m ? { kind: "member" as const, id: m.id } : u ? { kind: "client" as const, id: u.id } : null;
    if (!acc) return {};
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(LS_RESET, JSON.stringify({ ...read<Record<string, LocalReset>>(LS_RESET, {}), [token]: { ...acc, email: e, exp: Date.now() + 30 * 60_000 } }));
    return { localLink: `${location.origin}/redefinir/${token}` };
  },
  async check(token: string): Promise<{ email: string }> {
    if (supabaseEnabled) return api(`/api/auth/reset/${encodeURIComponent(token)}`);
    const r = read<Record<string, LocalReset>>(LS_RESET, {})[token];
    if (!r) throw new ApiError("invalid");
    if (r.exp < Date.now()) throw new ApiError("expired");
    return { email: maskEmail(r.email) };
  },
  async apply(token: string, code: string): Promise<LoginResult> {
    if (supabaseEnabled) return api(`/api/auth/reset/${encodeURIComponent(token)}`, { code });
    const all = read<Record<string, LocalReset>>(LS_RESET, {});
    const r = all[token];
    if (!r) throw new ApiError("invalid");
    if (r.exp < Date.now()) throw new ApiError("expired");
    if (!/^\d{4,6}$/.test(code)) throw new ApiError("bad_passcode");
    const key = r.kind === "member" ? LS_MEMBERS : LS_USERS;
    localStorage.setItem(key, JSON.stringify(read<{ id: string }[]>(key, []).map((x) => (x.id === r.id ? { ...x, passcode: code } : x))));
    delete all[token]; // uso único
    localStorage.setItem(LS_RESET, JSON.stringify(all));
    const { passcodeLogin } = await import("./authApi");
    return passcodeLogin(r.email, code);
  },
};
