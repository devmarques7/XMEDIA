import type { AppRole, Perm } from "./roles";
// Equipa: funcionários, horas trabalhadas, valor/hora e fecho mensal (EUR · GBP · BRL).
import { supabase, supabaseEnabled } from "./supabase/client";

export const CURRENCIES = ["EUR", "GBP", "BRL"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type Access = "admin" | "member";

export type Member = {
  id: string;
  name: string;
  email: string; // conta de acesso (login Google / email)
  role: string; // função
  description: string; // descrição de funcionamento
  responsibilities: string[];
  rate: number; // valor por hora, definido pelo admin
  rate_currency: Currency;
  access: Access;
  active: boolean;
  lang: "pt" | "en" | "nl"; // língua do convite e da app do funcionário
  photo_url: string;
  city: string;
  status: MemberStatus;
  code_hint?: string; // ••••-XXXX (o código completo só é mostrado ao funcionário, uma vez)
  invited_at?: string | null;
  invite_expires_at?: string | null;
  registered_at?: string | null;
  last_login_at?: string | null;
  app_role: AppRole; // papel na plataforma (none = só a própria área de horas)
  app_permissions: Perm[]; // permissões efetivas (verificadas também no Supabase)
  created_at?: string;
};
export type MemberStatus = "draft" | "invited" | "active" | "disabled";
/** O que o administrador edita na ficha. */
export type MemberInput = Pick<
  Member,
  "name" | "email" | "role" | "description" | "responsibilities" | "rate" | "rate_currency" | "access" | "active" | "lang" | "photo_url" | "city" | "app_role" | "app_permissions"
> & { id?: string };

export type TimeEntry = {
  id: string;
  member_id: string;
  date: string; // AAAA-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM (se < start, passa da meia-noite)
  break_min: number;
  project: string;
  note: string;
};

export type MonthClose = {
  id: string;
  member_id: string;
  month: string; // AAAA-MM
  minutes: number;
  rate: number;
  rate_currency: Currency;
  amount: number; // na moeda do valor/hora
  paid: boolean;
  closed_at: string;
};

export const emptyMember = (): Omit<Member, "id"> => ({
  name: "",
  email: "",
  role: "",
  description: "",
  responsibilities: [],
  rate: 0,
  rate_currency: "EUR",
  access: "member",
  active: true,
  lang: "pt",
  status: "draft",
  photo_url: "",
  city: "",
  app_role: "none",
  app_permissions: [],
});

// ---------- cálculos (puros) ----------
const hm = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  return m ? +m[1] * 60 + +m[2] : null;
};

/** Minutos trabalhados num registo (desconta pausa; aceita turnos depois da meia-noite). */
export function entryMinutes(e: Pick<TimeEntry, "start" | "end" | "break_min">) {
  const a = hm(e.start),
    b = hm(e.end);
  if (a === null || b === null) return 0;
  const span = b > a ? b - a : b + 1440 - a;
  return Math.max(0, span - (e.break_min || 0));
}

export const monthOf = (date: string) => date.slice(0, 7);

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Taxas com base EUR: 1 EUR = rates[X] X. */
export type Rates = { base: "EUR"; date: string; rates: Record<Currency, number>; live: boolean };
export const FALLBACK_RATES: Rates = { base: "EUR", date: "", rates: { EUR: 1, GBP: 0.85, BRL: 5.6 }, live: false };

export function convert(amount: number, from: Currency, to: Currency, r: Rates) {
  if (from === to) return amount;
  return (amount / r.rates[from]) * r.rates[to];
}

export function monthSummary(member: Pick<Member, "rate" | "rate_currency">, entries: TimeEntry[]) {
  const minutes = entries.reduce((s, e) => s + entryMinutes(e), 0);
  const amount = Math.round((minutes / 60) * member.rate * 100) / 100;
  return { minutes, hours: minutes / 60, amount, currency: member.rate_currency, days: new Set(entries.map((e) => e.date)).size };
}

export const fmtHours = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;

export function fmtMoney(v: number, c: Currency, locale = "pt-PT") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: c, maximumFractionDigits: 2 }).format(v);
}

// ---------- câmbio (API Frankfurter / BCE, sem chave) ----------
const LS_FX = "xmedia:fx";
export async function fetchRates(): Promise<Rates> {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_FX) || "null") as (Rates & { at: number }) | null;
    if (cached && Date.now() - cached.at < 6 * 3600_000) return cached;
  } catch {}
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=GBP,BRL");
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { date: string; rates: { GBP: number; BRL: number } };
    const rates: Rates = { base: "EUR", date: j.date, rates: { EUR: 1, GBP: j.rates.GBP, BRL: j.rates.BRL }, live: true };
    try {
      localStorage.setItem(LS_FX, JSON.stringify({ ...rates, at: Date.now() }));
    } catch {}
    return rates;
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem(LS_FX) || "null");
      if (cached) return { ...cached, live: false };
    } catch {}
    return FALLBACK_RATES;
  }
}

// ---------- persistência ----------
export type Me = { email: string; isAdmin: boolean; member: Member | null };

type TeamStore = {
  me(): Promise<Me>;
  members(): Promise<Member[]>;
  saveMember(m: MemberInput): Promise<Member>;
  removeMember(id: string): Promise<void>;
  entries(from: string, to: string, memberId?: string): Promise<TimeEntry[]>;
  addEntry(e: Omit<TimeEntry, "id">): Promise<TimeEntry>;
  removeEntry(id: string): Promise<void>;
  closes(month: string): Promise<MonthClose[]>;
  closeMonth(c: Omit<MonthClose, "id" | "closed_at">): Promise<MonthClose>;
  setPaid(id: string, paid: boolean): Promise<void>;
  reopen(id: string): Promise<void>;
};

const MEMBER_COLS =
  "id, name, email, role, description, responsibilities, rate, rate_currency, access, active, created_at, lang, status, code_hint, invited_at, invite_expires_at, registered_at, last_login_at, photo_url, city, app_role, app_permissions";
const ENTRY_COLS = "id, member_id, date, start, end, break_min, project, note";

const remote: TeamStore = {
  // no Supabase só o administrador tem conta; funcionários entram por código (/eu)
  async me() {
    const { data } = await supabase().auth.getUser();
    return { email: (data.user?.email ?? "").toLowerCase(), isAdmin: true, member: null };
  },
  async members() {
    const { data, error } = await supabase().from("team_members").select(MEMBER_COLS).order("name");
    if (error) throw error;
    return data as Member[];
  },
  async saveMember(m) {
    const row: Partial<Member> = { ...m, email: m.email.trim().toLowerCase() };
    for (const k of ["created_at", "status", "code_hint", "invited_at", "invite_expires_at", "registered_at", "last_login_at"] as const) delete row[k];
    const q = m.id ? supabase().from("team_members").update(row).eq("id", m.id) : supabase().from("team_members").insert(row);
    const { data, error } = await q.select(MEMBER_COLS).single();
    if (error) throw error;
    return data as Member;
  },
  async removeMember(id) {
    const { error } = await supabase().from("team_members").delete().eq("id", id);
    if (error) throw error;
  },
  async entries(from, to, memberId) {
    let q = supabase().from("time_entries").select(ENTRY_COLS).gte("date", from).lte("date", to);
    if (memberId) q = q.eq("member_id", memberId);
    const { data, error } = await q.order("date").order("start");
    if (error) throw error;
    return data as TimeEntry[];
  },
  async addEntry(e) {
    const { data, error } = await supabase().from("time_entries").insert(e).select(ENTRY_COLS).single();
    if (error) throw error;
    return data as TimeEntry;
  },
  async removeEntry(id) {
    const { error } = await supabase().from("time_entries").delete().eq("id", id);
    if (error) throw error;
  },
  async closes(month) {
    const { data, error } = await supabase().from("month_closes").select("*").eq("month", month);
    if (error) throw error;
    return data as MonthClose[];
  },
  async closeMonth(c) {
    const { data, error } = await supabase().from("month_closes").insert(c).select("*").single();
    if (error) throw error;
    return data as MonthClose;
  },
  async setPaid(id, paid) {
    const { error } = await supabase().from("month_closes").update({ paid }).eq("id", id);
    if (error) throw error;
  },
  async reopen(id) {
    const { error } = await supabase().from("month_closes").delete().eq("id", id);
    if (error) throw error;
  },
};

// modo local: tudo no navegador; "Ver como" simula a vista de um funcionário
export const LS_M = "xmedia:members",
  LS_E = "xmedia:entries",
  LS_C = "xmedia:closes";
export const read = <T,>(k: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(k) || "[]");
  } catch {
    return [];
  }
};
export const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => crypto.randomUUID();

const local: TeamStore = {
  async me() {
    return { email: "", isAdmin: true, member: null };
  },
  async members() {
    return read<Member>(LS_M).sort((a, b) => a.name.localeCompare(b.name));
  },
  async saveMember(m) {
    const all = read<Member>(LS_M);
    const row = { ...m, email: m.email.trim().toLowerCase() } as Member;
    for (const k of ["status", "code_hint", "invited_at", "invite_expires_at", "registered_at", "last_login_at"] as const) delete (row as Partial<Member>)[k];
    if (m.id) {
      write(LS_M, all.map((x) => (x.id === m.id ? { ...x, ...row } : x)));
      return { ...all.find((x) => x.id === m.id)!, ...row };
    }
    const created = { ...row, status: "draft" as const, id: uid(), created_at: new Date().toISOString() };
    write(LS_M, [...all, created]);
    return created;
  },
  async removeMember(id) {
    write(LS_M, read<Member>(LS_M).filter((m) => m.id !== id));
    write(LS_E, read<TimeEntry>(LS_E).filter((e) => e.member_id !== id));
    write(LS_C, read<MonthClose>(LS_C).filter((c) => c.member_id !== id));
  },
  async entries(from, to, memberId) {
    return read<TimeEntry>(LS_E)
      .filter((e) => e.date >= from && e.date <= to && (!memberId || e.member_id === memberId))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  },
  async addEntry(e) {
    const row = { ...e, id: uid() };
    write(LS_E, [...read<TimeEntry>(LS_E), row]);
    return row;
  },
  async removeEntry(id) {
    write(LS_E, read<TimeEntry>(LS_E).filter((e) => e.id !== id));
  },
  async closes(month) {
    return read<MonthClose>(LS_C).filter((c) => c.month === month);
  },
  async closeMonth(c) {
    const row = { ...c, id: uid(), closed_at: new Date().toISOString() };
    write(LS_C, [...read<MonthClose>(LS_C).filter((x) => !(x.member_id === c.member_id && x.month === c.month)), row]);
    return row;
  },
  async setPaid(id, paid) {
    write(LS_C, read<MonthClose>(LS_C).map((c) => (c.id === id ? { ...c, paid } : c)));
  },
  async reopen(id) {
    write(LS_C, read<MonthClose>(LS_C).filter((c) => c.id !== id));
  },
};

export const team: TeamStore = supabaseEnabled ? remote : local;
