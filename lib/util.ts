import type { Key } from "./i18n";
import type { Block, Project, ProjectData, ReelStatus, Scene, Session } from "./types";

export const pad = (n: number) => String(n).padStart(2, "0");

export function daysUntil(date: string): number | null {
  if (!date) return null;
  // diferença em dias de calendário (meio-dia evita problemas de mudança de hora)
  const target = new Date(date + "T12:00:00").getTime();
  const today = new Date(isoDay() + "T12:00:00").getTime();
  return Math.round((target - today) / 86_400_000);
}

export function expiryLabel(date: string): { key: Key; n: number; tone: "muted" | "warn" | "danger" } {
  const n = daysUntil(date);
  if (n === null) return { key: "exp.none", n: 0, tone: "muted" };
  if (n < 0) return { key: "exp.past", n: -n, tone: "danger" };
  if (n === 0) return { key: "exp.today", n, tone: "warn" };
  return { key: "exp.in", n, tone: n <= 7 ? "warn" : "muted" };
}

export function sessionStats(s: Session) {
  const scenes = s.blocks.flatMap((b) => b.scenes);
  return { total: scenes.length, done: scenes.filter((c) => c.done).length };
}

export function projectStats(d: ProjectData) {
  const scenes = d.sessions.flatMap((s) => s.blocks.flatMap((b) => b.scenes));
  return { reels: d.reels.length, scenes: scenes.length, done: scenes.filter((c) => c.done).length };
}

export function fmtDate(date: string, locale = "pt-PT", opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) {
  if (!date) return "";
  return new Date(date + "T12:00:00").toLocaleDateString(locale, opts);
}

export const range = (a: string, b: string) => [a, b].filter(Boolean).join("–");

export function videoHost(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "").split(".")[0];
  } catch {
    return "video";
  }
}

/** Data local AAAA-MM-DD */
export function isoDay(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "08:30" → minutos desde a meia-noite */
export const toMin = (t: string) => {
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  return m ? +m[1] * 60 + +m[2] : null;
};

/** Timestamp local de data + hora */
export function at(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime();
}

export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export const STATUS_COLOR: Record<ReelStatus, string> = {
  ideia: "#5d5d5d",
  aprovado: "#8a7bd8",
  gravado: "#6b7a3c",
  editado: "#78aec0",
  publicado: "#ff5a1f",
};

export type Activity = {
  project: Project;
  session: Session;
  block: Block;
  scene: Scene;
  date: string;
};

/**
 * Cenas agendadas por dia, em todos os projetos.
 * Dia escolhido = hoje se houver cenas, senão a próxima data com cenas, senão a última.
 */
export function agenda(projects: Project[], today = isoDay()) {
  const all: Activity[] = [];
  for (const p of projects)
    for (const s of p.data.sessions) {
      const date = s.date || p.data.shootDate;
      if (!date) continue;
      for (const b of s.blocks) for (const c of b.scenes) all.push({ project: p, session: s, block: b, scene: c, date });
    }
  const dates = [...new Set(all.map((a) => a.date))].sort();
  const day = dates.includes(today) ? today : dates.find((d) => d > today) ?? dates.at(-1) ?? null;
  const items = all
    .filter((a) => a.date === day)
    .sort(
      (a, b) =>
        (toMin(a.session.start) ?? 0) - (toMin(b.session.start) ?? 0) ||
        (toMin(a.block.start) ?? 0) - (toMin(b.block.start) ?? 0)
    );
  const sessions = [...new Map(items.map((a) => [a.session.id, a])).values()].map((a) => ({
    project: a.project,
    session: a.session,
  }));
  return { day, isToday: day === today, items, sessions };
}
