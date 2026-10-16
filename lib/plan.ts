// Planeamento por capacidade: estimativa de tempo de cada item, capacidade do dia (com margem para imprevistos),
// calibração pelas horas reais registadas, previsão do que cabe e recomendação do que pegar. Funções puras.
import { deadline, openNotes, phaseOf, type ContentPost, type PostType, type ProcessSettings } from "./customer";
import { stalled, type StudioTask } from "./studio";
import type { TimeEntry } from "./team";
import { actionOf } from "./today";

export type Action = "script" | "edit" | "followup" | "changes" | "unblock" | "schedule";
export type PlanSettings = {
  /** Minutos de trabalho por dia útil. */
  capacity_min: number;
  /** Fração reservada a imprevistos, mensagens e reuniões (0–0,5). */
  buffer: number;
  /** Dias úteis (1 = segunda … 7 = domingo). */
  workdays: number[];
  /** Ajustes às estimativas base (minutos) por tipo e ação. */
  estimates?: Partial<Record<PostType, Partial<Record<Action, number>>>>;
};
export const DEFAULT_PLAN: PlanSettings = { capacity_min: 480, buffer: 0.2, workdays: [1, 2, 3, 4, 5] };

/** Estimativas base (minutos) por tipo de conteúdo e próxima ação — ponto de partida, calibrado pelo histórico. */
export const BASE_ESTIMATES: Record<PostType, Record<Action, number>> = {
  reel: { script: 45, edit: 180, changes: 60, followup: 15, schedule: 10, unblock: 20 },
  carousel: { script: 40, edit: 120, changes: 45, followup: 15, schedule: 10, unblock: 20 },
  post: { script: 20, edit: 45, changes: 20, followup: 10, schedule: 10, unblock: 15 },
  story: { script: 15, edit: 30, changes: 15, followup: 10, schedule: 5, unblock: 15 },
};
export const DEFAULT_TASK_MIN = 30;

export const normalizePlan = (x?: Partial<PlanSettings> | null): PlanSettings => ({
  capacity_min: Math.min(16 * 60, Math.max(60, Number(x?.capacity_min) || DEFAULT_PLAN.capacity_min)),
  buffer: Math.min(0.5, Math.max(0, typeof x?.buffer === "number" ? x.buffer : DEFAULT_PLAN.buffer)),
  workdays: Array.isArray(x?.workdays) && x.workdays.length ? x.workdays.filter((d) => d >= 1 && d <= 7) : DEFAULT_PLAN.workdays,
  estimates: x?.estimates,
});

/** Minutos de um conteúdo para a próxima ação. Carrosséis longos: +10 min por slide acima de 5 na edição. */
export function estimatePost(p: ContentPost, plan: PlanSettings = DEFAULT_PLAN): number {
  const a = actionOf(p) as Action;
  const base = plan.estimates?.[p.type]?.[a] ?? BASE_ESTIMATES[p.type][a];
  const extra = p.type === "carousel" && (a === "edit" || a === "changes") ? Math.max(0, p.media.length - 5) * 10 : 0;
  // muitos comentários por resolver = mais alterações
  const notes = a === "changes" ? Math.min(openNotes(p).length, 10) * 5 : 0;
  return base + extra + notes;
}

/** "(2h)", "1,5h", "45m", "45 min" no título → minutos. */
export function parseEstimate(text: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|horas?|uur|m|min|mins|minutos?)\b/i.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  const min = /^h|^hr|^hora|^uur/i.test(m[2]) ? n * 60 : n;
  return min > 0 && min <= 16 * 60 ? Math.round(min) : null;
}

/** Estimativa de uma tarefa: a definida à mão > a escrita no título > a do conteúdo ligado > 30 min. */
export function estimateTask(t: Pick<StudioTask, "estimate" | "title" | "post_id">, posts: ContentPost[], plan: PlanSettings = DEFAULT_PLAN): number {
  if (t.estimate && t.estimate > 0) return t.estimate;
  const parsed = parseEstimate(t.title);
  if (parsed) return parsed;
  const p = t.post_id ? posts.find((x) => x.id === t.post_id) : undefined;
  return p ? estimatePost(p, plan) : DEFAULT_TASK_MIN;
}

const isoDow = (day: string) => ((new Date(day + "T12:00:00").getDay() + 6) % 7) + 1;
/** Minutos planeáveis num dia: capacidade − margem (0 fora dos dias úteis). */
export const plannable = (plan: PlanSettings, day: string) => (plan.workdays.includes(isoDow(day)) ? Math.round(plan.capacity_min * (1 - plan.buffer)) : 0);

const entryMin = (e: TimeEntry) => {
  const [h1, m1] = e.start.split(":").map(Number);
  const [h2, m2] = e.end.split(":").map(Number);
  let d = h2 * 60 + m2 - (h1 * 60 + m1);
  if (d < 0) d += 24 * 60;
  return Math.max(0, d - (e.break_min || 0));
};

export type Calibration = {
  /** Multiplicador real/estimado (1 = as estimativas acertam). */
  factor: number;
  /** Média de minutos registados por dia trabalhado. */
  dailyLogged: number;
  /** Minutos estimados concluídos por dia trabalhado. */
  dailyDone: number;
  days: number;
  /** Há dados suficientes para confiar no fator. */
  reliable: boolean;
};

/**
 * Calibração pelo histórico (últimos `windowDays`): horas registadas vs. tempo estimado das tarefas concluídas.
 * Fator limitado a 0,6–2,5 e só usado com pelo menos 2 h de cada lado.
 */
export function calibrate(entries: TimeEntry[], tasks: StudioTask[], posts: ContentPost[], plan: PlanSettings, today: string, windowDays = 14): Calibration {
  const from = new Date(new Date(today + "T12:00:00").getTime() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const es = entries.filter((e) => e.date >= from && e.date <= today);
  const logged = es.reduce((a, e) => a + entryMin(e), 0);
  const days = new Set(es.map((e) => e.date)).size;
  const done = tasks.filter((t) => t.done && !t.deleted && t.updated.slice(0, 10) >= from && t.updated.slice(0, 10) <= today);
  const doneEst = done.reduce((a, t) => a + estimateTask(t, posts, plan), 0);
  const reliable = logged >= 120 && doneEst >= 120;
  const factor = reliable ? Math.min(2.5, Math.max(0.6, logged / doneEst)) : 1;
  const workDays = Math.max(1, days || new Set(done.map((t) => t.updated.slice(0, 10))).size);
  return { factor: Math.round(factor * 100) / 100, dailyLogged: days ? Math.round(logged / days) : 0, dailyDone: Math.round(doneEst / workDays), days, reliable };
}

export type DayLoad = { day: string; capacity: number; planned: number; free: number; level: "ok" | "tight" | "over" | "off"; tasks: { t: StudioTask; min: number }[] };

/** Carga de um dia: tarefas abertas com esse prazo (e as atrasadas, no dia de hoje), já calibradas. */
export function dayLoad(day: string, today: string, tasks: StudioTask[], posts: ContentPost[], plan: PlanSettings, factor = 1): DayLoad {
  const list = tasks.filter((t) => !t.deleted && !t.done && t.due && (t.due === day || (day === today && t.due < today)));
  const items = list.map((t) => ({ t, min: Math.round(estimateTask(t, posts, plan) * factor) }));
  const planned = items.reduce((a, x) => a + x.min, 0);
  const capacity = plannable(plan, day);
  const level = capacity === 0 ? (planned ? "over" : "off") : planned > capacity ? "over" : planned >= capacity * 0.85 ? "tight" : "ok";
  return { day, capacity, planned, free: Math.max(0, capacity - planned), level, tasks: items };
}

export type Pending = { p: ContentPost; action: Action; min: number; due: string; score: number; reason: "late" | "stalled" | "changes" | "comments" | "due" | "open" };

/**
 * Tudo o que um conteúdo ainda pede (sem tarefa aberta ligada), com estimativa calibrada e prioridade:
 * atrasado > parado > alterações > comentários > prazo próximo > em aberto. Sem filtro de data.
 */
export function pendingWork(posts: ContentPost[], tasks: StudioTask[], proc: ProcessSettings, plan: PlanSettings, now: Date, factor = 1): Pending[] {
  const today = now.toISOString().slice(0, 10);
  const open = new Set(tasks.filter((t) => !t.done && !t.deleted && t.post_id).map((t) => t.post_id));
  const out: Pending[] = [];
  for (const p of posts) {
    const ph = phaseOf(p);
    if (ph === "published" || ph === "scheduled" || open.has(p.id)) continue;
    const d = deadline(p, proc, now);
    const due = d.due ? d.due.slice(0, 10) : "";
    const reason: Pending["reason"] = d.state === "late" ? "late" : stalled(p, proc, now) ? "stalled" : ph === "changes" ? "changes" : openNotes(p).length ? "comments" : due && d.state === "warn" ? "due" : "open";
    const daysLeft = due ? Math.round((new Date(due + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86_400_000) : 30;
    const base = { late: 50, stalled: 40, changes: 35, comments: 25, due: 20, open: 5 }[reason];
    const score = base + Math.max(0, 14 - daysLeft) * 2 + (p.client_draft ? 2 : 0);
    out.push({ p, action: actionOf(p) as Action, min: Math.round(estimatePost(p, plan) * factor), due, score, reason });
  }
  return out.sort((a, b) => b.score - a.score || (a.due || "9").localeCompare(b.due || "9"));
}

/** Escolhe por prioridade o que cabe no tempo livre (o que não cabe fica para depois). */
export function recommend<T extends { min: number; score: number }>(items: T[], free: number): { fit: T[]; later: T[] } {
  const fit: T[] = [];
  const later: T[] = [];
  let left = free;
  for (const x of [...items].sort((a, b) => b.score - a.score || a.min - b.min)) {
    if (x.min <= left) {
      fit.push(x);
      left -= x.min;
    } else later.push(x);
  }
  return { fit, later };
}

/** Primeiro dia (a partir de `from`, até 21 dias) com tempo livre suficiente para `min` minutos. */
export function firstFreeDay(min: number, from: string, today: string, tasks: StudioTask[], posts: ContentPost[], plan: PlanSettings, factor = 1): string {
  for (let i = 0; i < 21; i++) {
    const day = new Date(new Date(from + "T12:00:00").getTime() + i * 86_400_000).toISOString().slice(0, 10);
    if (dayLoad(day, today, tasks, posts, plan, factor).free >= min) return day;
  }
  return from;
}

/** "2h15", "45 min". */
export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` : `${m} min`);
