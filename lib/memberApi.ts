"use client";

// Convites, login por código e área do funcionário.
// Com Supabase: rotas /api/* no servidor. Sem Supabase (modo local): tudo neste navegador, para testar o fluxo.
import { INVITE_DAYS, maskEmail, randomToken } from "./codes";
import type { Lang } from "./i18n";
import { supabaseEnabled } from "./supabase/client";
import { LS_C, LS_E, LS_M, entryMinutes, monthRange, read, write, type Member, type MonthClose, type TimeEntry } from "./team";

export type InviteResult = { link: string; expiresAt: string; email: { sent: boolean; reason?: string } };
export type InviteInfo = { name: string; email: string; lang: Lang; expiresAt: string; role?: string; photo_url?: string };
/** O que o convidado preenche ao aceitar (nome, função e foto); o valor/hora fica para o admin. */
export type InviteProfile = { name?: string; role?: string; photo?: string };
export type MyData = { member: Member; entries: TimeEntry[]; close: MonthClose | null };
export type NewEntry = Pick<TimeEntry, "date" | "start" | "end" | "break_min" | "project" | "note">;

/** Erro com código estável (traduzido no ecrã): invalid, expired, used, bad_code, too_many, month_closed… */
export class ApiError extends Error {}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || `http_${r.status}`);
  return j as T;
}

type MemberApi = {
  invite(memberId: string, send?: boolean): Promise<InviteResult>;
  checkInvite(token: string): Promise<InviteInfo>;
  /** O funcionário escolhe o código de 4–6 dígitos e fica com sessão. */
  acceptInvite(token: string, code: string, profile?: InviteProfile): Promise<{ name: string; lang: Lang; to?: string }>;
  /** Modo local: login com email + código (em produção usa-se /api/auth/login). */
  login(email: string, code: string): Promise<{ lang: Lang }>;
  logout(): Promise<void>;
  me(month: string): Promise<MyData>;
  addEntry(e: NewEntry): Promise<TimeEntry>;
  removeEntry(id: string): Promise<void>;
};

const remote: MemberApi = {
  invite: (memberId, send = false) => api("/api/team/invite", { method: "POST", body: JSON.stringify({ memberId, send }) }),
  checkInvite: (token) => api(`/api/invite/${encodeURIComponent(token)}`),
  acceptInvite: (token, code, profile) => api(`/api/invite/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ code, ...profile }) }),
  login: (email, code) => api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, code }) }),
  logout: async () => {
    await api("/api/member/logout", { method: "POST" });
  },
  me: (month) => api(`/api/member/me?month=${month}`),
  addEntry: (e) => api("/api/member/entries", { method: "POST", body: JSON.stringify(e) }),
  removeEntry: async (id) => {
    await api(`/api/member/entries?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};

// ---------- modo local ----------
type LocalMember = Member & { invite_token?: string | null; login_code?: string | null; passcode?: string | null };
const LS_SESSION = "xmedia:memberSession";
const members = () => read<LocalMember>(LS_M);
const patch = (id: string, p: Partial<LocalMember>) => write(LS_M, members().map((m) => (m.id === id ? { ...m, ...p } : m)));
const session = () => {
  try {
    return localStorage.getItem(LS_SESSION);
  } catch {
    return null;
  }
};
function byToken(token: string) {
  const m = members().find((x) => x.invite_token === token);
  if (!m) throw new ApiError("invalid");
  if (m.status === "disabled") throw new ApiError("disabled");
  if (!m.invite_expires_at || new Date(m.invite_expires_at) < new Date()) throw new ApiError("expired");
  return m;
}
const isClosed = (memberId: string, date: string) => read<MonthClose>(LS_C).some((c) => c.member_id === memberId && c.month === date.slice(0, 7));

const local: MemberApi = {
  async invite(memberId) {
    const m = members().find((x) => x.id === memberId);
    if (!m) throw new ApiError("not_found");
    const token = randomToken();
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
    patch(memberId, { invite_token: token, invite_expires_at: expiresAt, invited_at: new Date().toISOString(), status: m.status === "active" ? "active" : "invited" });
    return { link: `${location.origin}/convite/${token}`, expiresAt, email: { sent: false, reason: "local_mode" } };
  },
  async checkInvite(token) {
    const m = byToken(token);
    return { name: m.name, email: maskEmail(m.email), lang: m.lang, expiresAt: m.invite_expires_at!, role: m.role, photo_url: m.photo_url };
  },
  async acceptInvite(token, code, profile) {
    const m = byToken(token);
    if (!/^\d{4,6}$/.test(code)) throw new ApiError("bad_passcode");
    const name = profile?.name?.trim().slice(0, 80);
    const role = profile?.role?.trim().slice(0, 60);
    patch(m.id, { ...(name ? { name } : {}), ...(role ? { role } : {}), ...(profile?.photo ? { photo_url: profile.photo } : {}), passcode: code, login_code: null, code_hint: "", status: "active", active: true, registered_at: new Date().toISOString(), invite_token: null, invite_expires_at: null });
    localStorage.setItem(LS_SESSION, m.id);
    return { name: m.name, lang: m.lang };
  },
  async login(email, code) {
    const e = email.trim().toLowerCase();
    const m = members().find((x) => x.email.toLowerCase() === e && x.passcode === code && x.status === "active" && x.active);
    if (!m) throw new ApiError("bad_code");
    patch(m.id, { last_login_at: new Date().toISOString() });
    localStorage.setItem(LS_SESSION, m.id);
    return { lang: m.lang };
  },
  async logout() {
    localStorage.removeItem(LS_SESSION);
  },
  async me(month) {
    const id = session();
    const m = id ? members().find((x) => x.id === id && x.status === "active") : null;
    if (!m) throw new ApiError("unauthorized");
    const { invite_token: _t, login_code: _c, passcode: _p, ...member } = m;
    const { from, to } = monthRange(month);
    const entries = read<TimeEntry>(LS_E)
      .filter((e) => e.member_id === id && e.date >= from && e.date <= to)
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    return { member, entries, close: read<MonthClose>(LS_C).find((c) => c.member_id === id && c.month === month) ?? null };
  },
  async addEntry(e) {
    const id = session();
    if (!id) throw new ApiError("unauthorized");
    if (!entryMinutes(e)) throw new ApiError("bad_time");
    if (isClosed(id, e.date)) throw new ApiError("month_closed");
    const row = { ...e, id: crypto.randomUUID(), member_id: id };
    write(LS_E, [...read<TimeEntry>(LS_E), row]);
    return row;
  },
  async removeEntry(entryId) {
    const id = session();
    const e = read<TimeEntry>(LS_E).find((x) => x.id === entryId);
    if (!id || !e || e.member_id !== id) throw new ApiError("not_found");
    if (isClosed(id, e.date)) throw new ApiError("month_closed");
    write(LS_E, read<TimeEntry>(LS_E).filter((x) => x.id !== entryId));
  },
};

export const memberApi: MemberApi = supabaseEnabled ? remote : local;
