// Consistência de publicação: publicações por semana (seg→dom), semanas ativas, sequência e maior pausa.
// Fonte: publicações no Instagram (sincronizadas) + conteúdos publicados pela app. Função pura (consistency.test.ts).
import type { ContentPost, Instagram } from "./customer";

const DAY = 86_400_000;
const monday = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

export type Consistency = {
  weeks: { start: string; n: number }[];
  active: number;
  streak: number;
  perWeek: number;
  gapDays: number;
  score: number; // 0–100
  level: "great" | "ok" | "low";
  monthPublished: number;
  monthPlanned: number;
};

/** Datas de publicação (ISO) sem duplicados entre Instagram e app. */
export function publishDates(ig: Pick<Instagram, "media">, posts: ContentPost[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of ig.media ?? []) {
    seen.add(m.id);
    if (m.timestamp) out.push(m.timestamp);
  }
  for (const p of posts) if (p.status === "published" && (p.published_at || p.scheduled_at) && !(p.ig_media_id && seen.has(p.ig_media_id))) out.push(p.published_at || p.scheduled_at);
  return out.sort();
}

export function consistency(dates: string[], posts: ContentPost[], today = new Date(), nWeeks = 12): Consistency {
  const start0 = monday(today).getTime() - (nWeeks - 1) * 7 * DAY;
  const weeks = Array.from({ length: nWeeks }, (_, i) => {
    const s = new Date(start0 + i * 7 * DAY);
    return { start: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`, n: 0 };
  });
  const ts = dates.map((d) => new Date(d).getTime()).filter((t) => !isNaN(t) && t <= today.getTime());
  for (const t of ts) {
    const i = Math.floor((monday(new Date(t)).getTime() - start0) / (7 * DAY) + 0.01);
    if (i >= 0 && i < nWeeks) weeks[i].n++;
  }
  const active = weeks.filter((w) => w.n > 0).length;
  // sequência: semanas seguidas com publicação até à semana atual (a atual pode ainda não ter, conta a partir da anterior)
  let streak = 0;
  let i = nWeeks - 1;
  if (weeks[i].n === 0) i--;
  for (; i >= 0 && weeks[i].n > 0; i--) streak++;
  const inWin = ts.filter((t) => t >= start0).sort((a, b) => a - b);
  let gap = inWin.length ? Math.round((today.getTime() - inWin[inWin.length - 1]) / DAY) : nWeeks * 7;
  for (let k = 1; k < inWin.length; k++) gap = Math.max(gap, Math.round((inWin[k] - inWin[k - 1]) / DAY));
  const score = Math.round((active / nWeeks) * 100);
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const local = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  return {
    weeks,
    active,
    streak,
    perWeek: Math.round((inWin.length / nWeeks) * 10) / 10,
    gapDays: gap,
    score,
    level: score >= 75 ? "great" : score >= 50 ? "ok" : "low",
    monthPublished: ts.filter((t) => local(new Date(t).toISOString()) === ym).length,
    monthPlanned: posts.filter((p) => p.scheduled_at && local(p.scheduled_at) === ym && p.status !== "idea").length,
  };
}
