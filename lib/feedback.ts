// Avaliação dos clientes (feedback): perguntas, validação das respostas, NPS, comparação com referências do
// mercado e pontos fracos. Cada pedido tem um token de uso único (só o hash fica guardado no cliente).
// Funções puras (testadas em feedback.test.ts).
import type { Lang } from "./i18n";

/** Dimensões avaliadas de 1 a 5. */
export const FB_DIMS = ["quality", "communication", "deadlines", "strategy", "value", "process"] as const;
export type FbDim = (typeof FB_DIMS)[number];

export type FbAnswers = {
  nps: number; // 0–10: recomendaria a MediaMarques?
  scores: Record<FbDim, number>; // 1–5
  best: string; // o que fazemos melhor
  improve: string; // o que devemos melhorar
  testimonial: boolean; // autoriza usar como testemunho
  quote: string; // frase para testemunho (opcional)
};

export type FbRequest = {
  id: string;
  token_hash: string;
  round: string; // ex.: "2026-10" — um cliente responde uma vez por ronda (mês)
  email: string;
  name: string;
  lang: Lang;
  sent_at: string;
  expires_at: string;
  emailed?: boolean;
  used_at?: string;
  answers?: FbAnswers;
};

export type CustomerFeedback = { requests: FbRequest[] };

/** Ronda mensal ("2026-10"): cada cliente responde uma vez por mês. */
export const roundOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Referências indicativas do mercado (agências criativas / serviços B2B). Servem de linha de comparação, não são
 * dados oficiais: NPS de serviços B2B anda tipicamente entre 30 e 50 e acima de 70 é considerado excelente;
 * para satisfação (1–5) o objetivo comum é ≥ 4,2 (≈ 84%).
 */
export const BENCHMARK = {
  nps: { market: 40, top: 70 },
  dims: { quality: 4.3, communication: 4.1, deadlines: 4.0, strategy: 3.9, value: 3.9, process: 4.0 } as Record<FbDim, number>,
  csat: 84, // % de notas 4–5
};

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Valida e normaliza as respostas do formulário público. Devolve null se faltar algo obrigatório. */
export function parseAnswers(x: unknown): FbAnswers | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const nps = Number(o.nps);
  if (!Number.isInteger(nps) || nps < 0 || nps > 10) return null;
  const sc = (o.scores ?? {}) as Record<string, unknown>;
  const scores = {} as Record<FbDim, number>;
  for (const d of FB_DIMS) {
    const v = Number(sc[d]);
    if (!Number.isInteger(v) || v < 1 || v > 5) return null;
    scores[d] = v;
  }
  return { nps, scores, best: clean(o.best, 1500), improve: clean(o.improve, 1500), testimonial: o.testimonial === true, quote: clean(o.quote, 600) };
}

/** Estado de um pedido para o formulário público. */
export function requestState(r: FbRequest | undefined, all: FbRequest[], now = new Date()): "open" | "used" | "expired" | "invalid" {
  if (!r) return "invalid";
  if (r.used_at) return "used";
  if (all.some((x) => x.round === r.round && x.used_at)) return "used"; // este cliente já respondeu nesta ronda
  if (new Date(r.expires_at).getTime() < now.getTime()) return "expired";
  return "open";
}

export type FbResponse = { customer_id: string; customer: string; at: string; round: string; name: string; answers: FbAnswers };

export type FbSummary = {
  n: number;
  sent: number;
  rate: number | null; // taxa de resposta %
  nps: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  csat: number | null; // % notas 4–5
  dims: { dim: FbDim; avg: number | null; bench: number; gap: number | null }[];
  weak: FbDim[]; // abaixo da referência, do pior para o melhor
  strong: FbDim[]; // acima da referência
  themes: { theme: Theme; n: number }[]; // temas nos comentários "melhorar"
};

const THEMES = {
  deadlines: ["prazo", "atras", "demor", "tempo", "deadline", "late", "delay", "slow", "laat", "vertraging", "op tijd"],
  communication: ["comunica", "respost", "whatsapp", "email", "contact", "communicat", "respon", "update", "feedback", "bereik"],
  price: ["preço", "preco", "caro", "valor", "price", "expensive", "cost", "budget", "prijs", "duur", "kosten"],
  quality: ["qualidade", "edição", "edicao", "cor", "som", "quality", "edit", "sound", "colour", "color", "kwaliteit", "montage"],
  strategy: ["estrat", "result", "alcance", "seguidores", "strategy", "reach", "growth", "followers", "strategie", "groei"],
  process: ["process", "portal", "aprova", "organiz", "approval", "workflow", "planning", "goedkeur"],
} as const;
export type Theme = keyof typeof THEMES;

export function summarize(responses: FbResponse[], sent: number): FbSummary {
  const n = responses.length;
  const promoters = responses.filter((r) => r.answers.nps >= 9).length;
  const detractors = responses.filter((r) => r.answers.nps <= 6).length;
  const all = responses.flatMap((r) => FB_DIMS.map((d) => r.answers.scores[d]));
  const dims = FB_DIMS.map((dim) => {
    const v = responses.map((r) => r.answers.scores[dim]);
    const avg = v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    return { dim, avg, bench: BENCHMARK.dims[dim], gap: avg === null ? null : Math.round((avg - BENCHMARK.dims[dim]) * 10) / 10 };
  });
  const text = responses.map((r) => r.answers.improve.toLowerCase());
  const themes = (Object.keys(THEMES) as Theme[])
    .map((theme) => ({ theme, n: text.filter((s) => THEMES[theme].some((w) => s.includes(w))).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  return {
    n,
    sent,
    rate: sent ? Math.round((n / sent) * 100) : null,
    nps: n ? Math.round(((promoters - detractors) / n) * 100) : null,
    promoters,
    passives: n - promoters - detractors,
    detractors,
    csat: all.length ? Math.round((all.filter((s) => s >= 4).length / all.length) * 100) : null,
    dims,
    weak: dims.filter((d) => d.gap !== null && d.gap < 0).sort((a, b) => a.gap! - b.gap!).map((d) => d.dim),
    strong: dims.filter((d) => d.gap !== null && d.gap >= 0).sort((a, b) => b.gap! - a.gap!).map((d) => d.dim),
    themes,
  };
}

/** Respostas de todos os clientes (para o painel). */
export function collect(customers: { id: string; name: string; feedback?: CustomerFeedback }[]) {
  const responses: FbResponse[] = [];
  let sent = 0;
  for (const c of customers)
    for (const r of c.feedback?.requests ?? []) {
      sent++;
      if (r.used_at && r.answers) responses.push({ customer_id: c.id, customer: c.name, at: r.used_at, round: r.round, name: r.name, answers: r.answers });
    }
  return { responses: responses.sort((a, b) => b.at.localeCompare(a.at)), sent };
}
