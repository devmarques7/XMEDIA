"use client";

// Pedidos de avaliação: Supabase (rotas /api/feedback/*) ou, em modo local, este navegador — para testar o fluxo todo.
import { randomToken, sha256 } from "./codes";
import type { Customer } from "./customer";
import { customerStore } from "./customerStore";
import { parseAnswers, requestState, roundOf, type FbAnswers, type FbRequest } from "./feedback";
import type { Lang } from "./i18n";
import { supabaseEnabled } from "./supabase/client";

export type SendInput = { email: string; name: string; lang: Lang; send: boolean; days?: number };
export type SendResult = { link: string; sent: boolean; reason: string | null; request: FbRequest };
export type PublicState = { state: "open" | "used" | "expired" | "invalid"; name?: string; company?: string; lang?: Lang };

async function j<T>(r: Response): Promise<T> {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as { error?: string }).error || `http_${r.status}`);
  return body as T;
}

const remote = {
  send: (c: Customer, i: SendInput) => fetch("/api/feedback/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: c.id, ...i }) }).then(j<SendResult>),
  get: (t: string) => fetch(`/api/feedback/public?t=${encodeURIComponent(t)}`, { cache: "no-store" }).then(j<PublicState>),
  submit: (t: string, answers: FbAnswers) => fetch("/api/feedback/public", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t, answers }) }).then(j<{ ok: true }>),
};

async function findLocal(t: string) {
  const h = await sha256(`feedback:${t}`);
  for (const c of await customerStore.list()) {
    const r = c.feedback?.requests.find((x) => x.token_hash === h);
    if (r) return { c, r, all: c.feedback!.requests };
  }
  return null;
}

const local = {
  async send(c: Customer, i: SendInput): Promise<SendResult> {
    const round = roundOf();
    if ((c.feedback?.requests ?? []).some((r) => r.round === round && r.used_at)) throw new Error("already_answered");
    const token = randomToken(24);
    const now = new Date();
    const request: FbRequest = { id: crypto.randomUUID(), token_hash: await sha256(`feedback:${token}`), round, email: i.email, name: i.name, lang: i.lang, sent_at: now.toISOString(), expires_at: new Date(now.getTime() + (i.days ?? 21) * 86_400_000).toISOString() };
    await customerStore.save({ ...c, feedback: { requests: [...(c.feedback?.requests ?? []), request] } });
    return { link: `${location.origin}/f/${token}`, sent: false, reason: "local_mode", request };
  },
  async get(t: string): Promise<PublicState> {
    const f = await findLocal(t);
    return f ? { state: requestState(f.r, f.all), name: f.r.name, company: f.c.name, lang: f.r.lang } : { state: "invalid" };
  },
  async submit(t: string, answers: FbAnswers) {
    const f = await findLocal(t);
    if (!f) throw new Error("invalid");
    const st = requestState(f.r, f.all);
    if (st !== "open") throw new Error(st);
    const a = parseAnswers(answers);
    if (!a) throw new Error("bad_answers");
    const used_at = new Date().toISOString();
    await customerStore.save({ ...f.c, feedback: { requests: f.all.map((x) => (x.id === f.r.id ? { ...x, used_at, answers: a } : x)) } });
    return { ok: true as const };
  },
};

export const feedbackApi = supabaseEnabled ? remote : local;
