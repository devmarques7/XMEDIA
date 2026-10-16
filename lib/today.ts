// "Hoje": a checklist do que tem de ser feito hoje (e nesta semana), com as tarefas de todos os clientes e as
// internas da empresa, ordenadas por prioridade (atraso, vídeo parado, cliente à espera, comentários abertos).
// Vídeos com prazo sugerem uma tarefa ligada ("Adicionar a hoje"). Funções puras.
import { deadline, openNotes, phaseOf, type ContentPost, type ProcessSettings } from "./customer";
import { stalled, taskOwner, weekDays, weekOf, ymd, type StudioTask } from "./studio";

export const COMPANY = ""; // customer_id das tarefas internas da empresa
export type Bucket = "late" | "today" | "week" | "later" | "done";
export const BUCKETS: Bucket[] = ["late", "today", "week", "later", "done"];
export type Alert = "late" | "stalled" | "changes" | "review" | "comments" | "client";

export type TodayTask = { t: StudioTask; bucket: Bucket; score: number; alerts: Alert[]; post?: ContentPost; lateDays: number };
export type Suggestion = { p: ContentPost; due: string; reason: Alert; score: number };

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / DAY);

export const isInternal = (t: StudioTask) => t.customer_id === COMPANY || !!t.internal;

export function bucketOf(t: StudioTask, today: string): Bucket {
  if (t.done) return t.updated.slice(0, 10) === today ? "done" : "later";
  if (!t.due) return "later";
  if (t.due < today) return "late";
  if (t.due === today) return "today";
  return t.due <= weekDays(weekOf(new Date(today + "T12:00:00")))[6] ? "week" : "later";
}

/** Tarefas classificadas e ordenadas pela prioridade (mais alertas primeiro). */
export function todayTasks(tasks: StudioTask[], posts: ContentPost[], proc: ProcessSettings, now = new Date()): TodayTask[] {
  const today = ymd(now);
  return tasks
    .filter((t) => !t.deleted && !(t.done && t.updated.slice(0, 10) !== today))
    .map((t) => {
      const post = t.post_id ? posts.find((p) => p.id === t.post_id) : undefined;
      const bucket = bucketOf(t, today);
      const lateDays = !t.done && t.due && t.due < today ? daysBetween(t.due, today) : 0;
      const alerts: Alert[] = [];
      if (lateDays) alerts.push("late");
      if (post && stalled(post, proc, now)) alerts.push("stalled");
      if (post && phaseOf(post) === "changes") alerts.push("changes");
      if (post && openNotes(post).length) alerts.push("comments");
      if (t.side === "client") alerts.push("client");
      const score = (t.done ? -100 : 0) + Math.min(lateDays, 10) * 3 + (bucket === "today" ? 4 : 0) + (alerts.includes("stalled") ? 3 : 0) + (alerts.includes("changes") ? 2 : 0) + (post ? Math.min(openNotes(post).length, 5) : 0) + (alerts.includes("client") ? 1 : 0);
      return { t, bucket, score, alerts, post, lateDays };
    })
    .sort((a, b) => b.score - a.score || (a.t.due || "9").localeCompare(b.t.due || "9"));
}

/** Ordem da checklist: a ordem manual (arrastada) primeiro; o resto pela prioridade automática. */
export function byRank<T extends { t: { rank?: number } }>(list: T[]): T[] {
  return list.map((x, i) => ({ x, i })).sort((a, b) => (a.x.t.rank ?? Infinity) - (b.x.t.rank ?? Infinity) || a.i - b.i).map((y) => y.x);
}
/** Nova ordem depois de mover o item `from` para a posição `to`: ranks 0…n (só devolve os que mudaram). */
export function reorder<T extends { t: { id: string; rank?: number } }>(list: T[], from: number, to: number): { id: string; rank: number }[] {
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next.map((x, i) => ({ id: x.t.id, rank: i, old: x.t.rank })).filter((x) => x.old !== x.rank).map(({ id, rank }) => ({ id, rank }));
}

/** Vídeos que pedem ação esta semana e ainda não têm tarefa aberta ligada → sugeridos para "hoje". */
export function suggestions(posts: ContentPost[], tasks: StudioTask[], proc: ProcessSettings, now = new Date()): Suggestion[] {
  const end = weekDays(weekOf(now))[6];
  // já tem tarefa (aberta ou feita hoje) → não volta a sugerir
  const linked = new Set(tasks.filter((t) => !t.deleted && t.post_id && (!t.done || t.updated.slice(0, 10) === ymd(now))).map((t) => t.post_id));
  const out: Suggestion[] = [];
  for (const p of posts) {
    if (linked.has(p.id)) continue;
    const ph = phaseOf(p);
    if (ph === "published" || ph === "scheduled") continue;
    const d = deadline(p, proc, now);
    const due = d.due ? d.due.slice(0, 10) : "";
    const reason: Alert | null = stalled(p, proc, now) ? "stalled" : ph === "changes" ? "changes" : openNotes(p).length ? "comments" : due && due <= end ? "late" : null;
    if (!reason) continue;
    out.push({ p, due, reason, score: (reason === "stalled" ? 5 : reason === "changes" ? 4 : reason === "comments" ? 2 : 1) + (due && due <= ymd(now) ? 3 : 0) });
  }
  return out.sort((a, b) => b.score - a.score);
}

export const mine = (t: StudioTask, email: string) => taskOwner(t) === email.toLowerCase();

// ---------- Planeamento automático (modelos "Planear hoje / amanhã / semana") ----------
export type PlanRange = "today" | "tomorrow" | "week";
export type PlanDraft = { title: string; action: string; post_id: string; customer_id: string; due: string; assignee?: string };

/** Ação seguinte de um conteúdo pela fase (chave de tradução td.act.*). */
export const actionOf = (p: ContentPost) => {
  const ph = phaseOf(p);
  return ph === "idea" ? "script" : ph === "editing" ? "edit" : ph === "client_review" ? "followup" : ph === "changes" ? "changes" : ph === "blocked" ? "unblock" : ph === "approved" ? "schedule" : "edit";
};

/**
 * Avalia os prazos de todos os vídeos em produção e devolve as tarefas a criar para o período:
 * hoje (prazo até hoje, atrasados, parados, alterações pedidas), amanhã (prazo amanhã) ou a semana (prazo até domingo,
 * cada uma no seu dia). Não duplica: vídeos com tarefa aberta ficam de fora.
 */
export function autoPlan(range: PlanRange, posts: ContentPost[], tasks: StudioTask[], proc: ProcessSettings, now = new Date()): PlanDraft[] {
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getTime() + DAY));
  const end = range === "today" ? today : range === "tomorrow" ? tomorrow : weekDays(weekOf(now))[6];
  const open = new Set(tasks.filter((t) => !t.done && !t.deleted && t.post_id).map((t) => t.post_id));
  const out: PlanDraft[] = [];
  for (const p of posts) {
    const ph = phaseOf(p);
    if (ph === "published" || ph === "scheduled" || open.has(p.id)) continue;
    const d = deadline(p, proc, now);
    const due = d.due ? d.due.slice(0, 10) : "";
    const urgent = stalled(p, proc, now) || ph === "changes" || ph === "blocked";
    let day = "";
    if (range === "today") day = urgent || (due && due <= today) ? today : "";
    else if (range === "tomorrow") day = due === tomorrow ? tomorrow : "";
    else day = urgent || (due && due <= end) ? (due && due > today ? due : today) : "";
    if (!day) continue;
    out.push({ title: p.title || p.type, action: actionOf(p), post_id: p.id, customer_id: p.customer_id, due: day, assignee: p.assignee });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

/** Agenda de um intervalo de dias: tarefas com prazo e prazos/publicações de vídeos, por dia. */
export function agenda(days: string[], tasks: StudioTask[], posts: ContentPost[], proc: ProcessSettings, now = new Date()) {
  return days.map((d) => ({
    day: d,
    tasks: tasks.filter((t) => !t.deleted && t.due === d),
    deadlines: posts.filter((p) => {
      const ph = phaseOf(p);
      return ph !== "published" && deadline(p, proc, now).due.slice(0, 10) === d;
    }),
    publishing: posts.filter((p) => p.scheduled_at && p.scheduled_at.slice(0, 10) === d && phaseOf(p) !== "published"),
  }));
}

/** Prioridade pelo prazo (etiqueta colorida): já passou · hoje · amanhã · esta semana · em dia · sem prazo. */
export type DueTag = "overdue" | "today" | "tomorrow" | "week" | "ok" | "none";
export function dueTag(due: string | undefined, now = new Date()): DueTag {
  if (!due) return "none";
  const today = ymd(now);
  const d = due.slice(0, 10);
  if (d < today) return "overdue";
  if (d === today) return "today";
  if (d === ymd(new Date(now.getTime() + DAY))) return "tomorrow";
  return d <= weekDays(weekOf(now))[6] ? "week" : "ok";
}
