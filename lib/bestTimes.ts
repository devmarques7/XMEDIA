// Melhores momentos para publicar: envolvimento médio por dia da semana × período do dia, a partir das publicações
// do próprio Instagram. Com menos de 6 publicações usa uma referência geral (marcada como tal). Função pura.
import type { IgMedia } from "./customer";

export const SLOTS = [
  { k: "morning", from: 7, to: 11, at: "09:00" },
  { k: "lunch", from: 11, to: 14, at: "12:30" },
  { k: "afternoon", from: 14, to: 18, at: "16:00" },
  { k: "evening", from: 18, to: 23, at: "19:30" },
] as const;
export type SlotKey = (typeof SLOTS)[number]["k"];
export type BestTimes = {
  source: "data" | "reference";
  n: number;
  grid: number[][]; // [dia 0=seg..6=dom][slot] 0–1
  top: { day: number; slot: SlotKey; at: string; score: number }[];
};

const slotOf = (h: number) => (h < 11 ? 0 : h < 14 ? 1 : h < 18 ? 2 : 3);
const dayOf = (d: Date) => (d.getDay() + 6) % 7;

/** Referência geral (contas de serviços/lifestyle): ter–qui ao almoço e ao fim da tarde. */
const REF = [
  [0.4, 0.6, 0.45, 0.65],
  [0.5, 0.9, 0.55, 0.85],
  [0.5, 0.85, 0.55, 1],
  [0.45, 0.8, 0.5, 0.9],
  [0.4, 0.6, 0.45, 0.5],
  [0.3, 0.45, 0.4, 0.45],
  [0.3, 0.4, 0.45, 0.6],
];

export function bestTimes(media: Pick<IgMedia, "timestamp" | "likes" | "comments" | "reach" | "saves">[]): BestTimes {
  const valid = media.filter((m) => m.timestamp && !isNaN(+new Date(m.timestamp)));
  let grid: number[][];
  let source: BestTimes["source"] = "data";
  if (valid.length < 6) {
    grid = REF;
    source = "reference";
  } else {
    const sum = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
    const cnt = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
    for (const m of valid) {
      const d = new Date(m.timestamp);
      const inter = (m.likes || 0) + 2 * (m.comments || 0) + 2 * (m.saves || 0);
      const score = m.reach ? inter / m.reach : inter;
      sum[dayOf(d)][slotOf(d.getHours())] += score;
      cnt[dayOf(d)][slotOf(d.getHours())]++;
    }
    const avg = sum.map((r, i) => r.map((v, j) => (cnt[i][j] ? v / cnt[i][j] : 0)));
    const max = Math.max(...avg.flat(), 1e-9);
    grid = avg.map((r) => r.map((v) => Math.round((v / max) * 100) / 100));
  }
  const top = grid
    .flatMap((r, day) => r.map((score, s) => ({ day, slot: SLOTS[s].k as SlotKey, at: SLOTS[s].at, score })))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return { source, n: valid.length, grid, top };
}

// ---------- Picos de Reels por zona horária ----------
// Referência de estudos de uso do telemóvel e de Reels: picos ao início da manhã (deslocações), ao almoço e,
// sobretudo, à noite; ter–qui mais fortes; fim de semana mais tarde de manhã. As horas são HORA LOCAL do público,
// por isso pedimos primeiro a zona horária. Com dados próprios (≥ 6 publicações) o resultado mistura os dois.
export type Peak = { day: number; from: string; to: string; weight: number }; // day 0=seg..6=dom
const W = (day: number, from: string, to: string, weight: number): Peak => ({ day, from, to, weight });
export const REELS_PEAKS: Peak[] = [
  ...[0, 1, 2, 3, 4].flatMap((d) => {
    const mid = d >= 1 && d <= 3 ? 0.1 : 0; // ter–qui
    return [W(d, "07:00", "09:00", 0.55 + mid), W(d, "12:00", "14:00", 0.75 + mid), W(d, "19:00", "22:00", 0.9 + mid)];
  }),
  W(5, "09:00", "11:00", 0.65),
  W(5, "19:00", "21:00", 0.55),
  W(6, "10:00", "12:00", 0.6),
  W(6, "19:00", "22:00", 0.8),
];

export const COMMON_TZ = ["Europe/Amsterdam", "Europe/Lisbon", "Europe/London", "Europe/Paris", "America/Sao_Paulo", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"];

/** Dia da semana (0=seg) e minutos do dia "agora" numa zona horária. */
export function nowIn(tz: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return { day: Math.max(0, day), min: Number(get("hour")) * 60 + Number(get("minute")) };
}
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export type PeakWindow = Peak & { score: number; inMin: number; live: boolean };

/** Janelas de pico dos próximos 7 dias na zona horária, com pontuação (0–1) e quanto falta (minutos). */
export function peakWindows(tz: string, media: Parameters<typeof bestTimes>[0] = [], now = new Date()): { next: PeakWindow | null; top: PeakWindow[]; source: "data+reference" | "reference" } {
  const bt = bestTimes(media);
  const own = bt.source === "data";
  const { day, min } = nowIn(tz, now);
  const scored = REELS_PEAKS.map((p) => {
    const slot = slotOfMin(toMin(p.from));
    const score = own ? Math.round((p.weight * 0.5 + bt.grid[p.day][slot] * 0.5) * 100) / 100 : p.weight;
    let inMin = (p.day - day) * 1440 + toMin(p.from) - min;
    const live = p.day === day && min >= toMin(p.from) && min < toMin(p.to);
    if (live) inMin = 0;
    else if (inMin < 0) inMin += 7 * 1440;
    return { ...p, score, inMin, live };
  });
  const next = [...scored].sort((a, b) => a.inMin - b.inMin)[0] ?? null;
  const top = [...scored].sort((a, b) => b.score - a.score || a.inMin - b.inMin).slice(0, 3);
  return { next, top, source: own ? "data+reference" : "reference" };
}
const slotOfMin = (m: number) => (m < 11 * 60 ? 0 : m < 14 * 60 ? 1 : m < 18 * 60 ? 2 : 3);
