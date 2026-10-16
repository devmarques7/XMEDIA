// Estúdio: visão de toda a produção (todos os clientes) e da equipa — quem faz o quê, carga da semana,
// produtividade e metas. Funções puras sobre clientes, conteúdos, tarefas e horas (sem SQL: tudo nos
// documentos existentes — tarefas no cliente, responsável no conteúdo, metas nas definições).
import { deadline, liveNotes, openNotes, phaseOf, type ContentPost, type Customer, type Phase, type ProcessSettings } from "./customer";
import type { Task } from "./tasks";
import { entryMinutes, type Member, type TimeEntry } from "./team";

export type Goal = {
  id: string;
  member: string; // email
  title: string;
  kind: "posts" | "tasks" | "hours" | "manual";
  target: number;
  week: string; // segunda-feira AAAA-MM-DD
  done?: boolean; // só para "manual"
};

export type Person = { email: string; name: string; photo: string; role: string; member?: Member };
export type TaskCol = "todo" | "doing" | "review" | "done";
export const TASK_COLS: TaskCol[] = ["todo", "doing", "review", "done"];
export type StudioTask = Task & { customer_id: string; customer: string };

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Segunda-feira da semana de uma data (AAAA-MM-DD). */
export function weekOf(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return ymd(x);
}
export function weekDays(week: string): string[] {
  const [y, m, d] = week.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => ymd(new Date(y, m - 1, d + i, 12)));
}
export const shiftWeek = (week: string, n: number) => ymd(new Date(new Date(week + "T12:00:00").getTime() + n * 7 * DAY));
export const inWeek = (iso: string | undefined, week: string) => !!iso && iso.slice(0, 10) >= week && iso.slice(0, 10) <= weekDays(week)[6];

export const colOf = (t: Task): TaskCol => (t.done ? "done" : t.progress ?? "todo");
export const withCol = (t: Task, c: TaskCol): Task => ({ ...t, done: c === "done", progress: c === "done" ? t.progress : c, updated: new Date().toISOString() });

/** Todas as tarefas do estúdio (de todos os clientes), com o cliente. */
export function allTasks(customers: Customer[]): StudioTask[] {
  return customers.flatMap((c) => (c.tasks ?? []).filter((t) => !t.deleted).map((t) => ({ ...t, customer_id: c.id, customer: c.name })));
}

/** Responsável de uma tarefa: o campo assignee ou, se não houver, a primeira menção. */
export const taskOwner = (t: Task) => (t.assignee || t.mentions[0] || "").toLowerCase();

/** Conteúdo parado: passou o prazo da fase (ou está bloqueado). */
export function stalled(p: ContentPost, proc: ProcessSettings, now = new Date()) {
  const ph = phaseOf(p);
  if (ph === "published" || ph === "scheduled") return false;
  return ph === "blocked" || deadline(p, proc, now).state === "late";
}
export const daysInPhase = (p: ContentPost, now = new Date()) => (p.phase_since ? Math.max(0, Math.floor((now.getTime() - new Date(p.phase_since).getTime()) / DAY)) : 0);

const DELIVERED: Phase[] = ["approved", "scheduled", "published"];

/** Carga e produtividade de uma pessoa numa semana. */
export function workload(email: string, week: string, posts: ContentPost[], tasks: StudioTask[], entries: TimeEntry[], memberId?: string, prevEntries: TimeEntry[] = []) {
  const e = email.toLowerCase();
  const mine = posts.filter((p) => (p.assignee ?? "").toLowerCase() === e);
  const open = mine.filter((p) => !DELIVERED.includes(phaseOf(p)));
  const delivered = mine.filter((p) => DELIVERED.includes(phaseOf(p)) && inWeek(p.phase_since, week));
  const myTasks = tasks.filter((t) => taskOwner(t) === e);
  const openTasks = myTasks.filter((t) => !t.done);
  const doneTasks = myTasks.filter((t) => t.done && inWeek(t.updated, week));
  const weekTasks = myTasks.filter((t) => (t.due && inWeek(t.due, week)) || (t.done && inWeek(t.updated, week)));
  const minutes = memberId ? entries.filter((x) => x.member_id === memberId && inWeek(x.date, week)).reduce((a, x) => a + entryMinutes(x), 0) : 0;
  const prevMinutes = memberId ? prevEntries.filter((x) => x.member_id === memberId).reduce((a, x) => a + entryMinutes(x), 0) : 0;
  const lateTasks = openTasks.filter((t) => t.due && t.due < ymd(new Date())).length;
  const end = weekDays(week)[6];
  const remaining = openTasks.filter((t) => !t.due || t.due <= end).length + open.length;
  const done = doneTasks.length + delivered.length;
  return {
    posts: mine,
    openPosts: open,
    delivered,
    tasks: myTasks,
    openTasks,
    doneTasks,
    weekTasks,
    minutes,
    prevMinutes,
    lateTasks,
    /** % do planeado da semana já feito. */
    progress: done + remaining ? Math.round((done / (done + remaining)) * 100) : 0,
    load: open.length + openTasks.length,
  };
}

/** Progresso de uma meta (automático pelo tipo; "manual" pelo visto). */
export function goalProgress(g: Goal, w: ReturnType<typeof workload>): { value: number; pct: number; done: boolean } {
  const value = g.kind === "posts" ? w.delivered.length : g.kind === "tasks" ? w.doneTasks.length : g.kind === "hours" ? Math.round((w.minutes / 60) * 10) / 10 : g.done ? 1 : 0;
  const target = g.kind === "manual" ? 1 : Math.max(1, g.target);
  const pct = Math.min(100, Math.round((value / target) * 100));
  return { value, pct, done: pct >= 100 };
}

/** Comentários por resolver em todos os conteúdos (o que o editor ainda tem de fazer). */
export function unresolved(posts: ContentPost[]) {
  return posts.flatMap((p) => openNotes(p).map((n) => ({ p, n })));
}
export const commentStats = (p: ContentPost) => ({ all: liveNotes(p).length, open: openNotes(p).length });

/** Pessoas da equipa (membros ativos + o admin). */
export function people(members: Member[], admin?: { email: string; name: string }): Person[] {
  const list: Person[] = members.filter((m) => m.active && m.email).map((m) => ({ email: m.email.toLowerCase(), name: m.name, photo: m.photo_url, role: m.role, member: m }));
  if (admin?.email && !list.some((p) => p.email === admin.email.toLowerCase())) list.unshift({ email: admin.email.toLowerCase(), name: admin.name, photo: "", role: "Admin" });
  return list;
}
export const initials = (s: string) =>
  s
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";
