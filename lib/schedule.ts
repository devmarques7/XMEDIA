// Horário do dia em Pomodoro: a partir de agora (ou do início do dia), 8 h de trabalho com blocos de foco e pausas,
// almoço e jantar nas horas certas e uma hora de fim. A ordem das tarefas vem de fora (IA ou prioridade). Funções puras.

export type ScheduleSettings = {
  day_start: string; // "09:00"
  work_min: number; // tempo de trabalho no dia (foco + pausas curtas), sem refeições
  focus: number; // minutos de foco por pomodoro
  short: number; // pausa curta
  long: number; // pausa longa
  every: number; // pausa longa a cada N pomodoros
  lunch_at: string;
  lunch_min: number;
  dinner_at: string;
  dinner_min: number;
  hard_stop: string; // nunca planear depois desta hora
};
export const DEFAULT_SCHEDULE: ScheduleSettings = { day_start: "09:00", work_min: 480, focus: 25, short: 5, long: 15, every: 4, lunch_at: "12:30", lunch_min: 60, dinner_at: "19:00", dinner_min: 45, hard_stop: "22:00" };

export type BlockKind = "focus" | "short" | "long" | "lunch" | "dinner";
export type Block = { kind: BlockKind; start: string; end: string; task_id?: string; title?: string; part?: [number, number] };
export type ScheduleItem = { id: string; title: string; min: number };
export type DaySchedule = {
  day: string;
  start: string;
  end: string;
  blocks: Block[];
  /** Minutos de foco planeados e tempo de trabalho usado (foco + pausas). */
  focus_min: number;
  work_used: number;
  pomodoros: number;
  unscheduled: (ScheduleItem & { left: number })[];
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toHHMM = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const normalizeSchedule = (x?: Partial<ScheduleSettings> | null): ScheduleSettings => {
  const s = { ...DEFAULT_SCHEDULE, ...(x ?? {}) };
  const hhmm = (v: string, d: string) => (/^\d{2}:\d{2}$/.test(v) ? v : d);
  return {
    ...s,
    day_start: hhmm(s.day_start, DEFAULT_SCHEDULE.day_start),
    lunch_at: hhmm(s.lunch_at, DEFAULT_SCHEDULE.lunch_at),
    dinner_at: hhmm(s.dinner_at, DEFAULT_SCHEDULE.dinner_at),
    hard_stop: hhmm(s.hard_stop, DEFAULT_SCHEDULE.hard_stop),
    work_min: Math.min(14 * 60, Math.max(60, Number(s.work_min) || 480)),
    focus: Math.min(90, Math.max(10, Number(s.focus) || 25)),
    short: Math.min(30, Math.max(0, Number(s.short) || 0)),
    long: Math.min(60, Math.max(0, Number(s.long) || 0)),
    every: Math.min(8, Math.max(2, Number(s.every) || 4)),
  };
};

/**
 * Distribui as tarefas (pela ordem dada) em pomodoros a partir de `startAt` (minutos do dia; arredonda para 5 min).
 * Refeições: entram quando a hora chega (as que já passaram antes de começar não entram). Um pomodoro nunca
 * atravessa uma refeição. O que não cabe nas horas de trabalho (ou depois da hora limite) fica em `unscheduled`.
 */
export function buildSchedule(items: ScheduleItem[], cfg: ScheduleSettings, day: string, startAt?: number): DaySchedule {
  const s = normalizeSchedule(cfg);
  let t = Math.max(toMin(s.day_start), Math.ceil((startAt ?? 0) / 5) * 5);
  const start = t;
  const stop = toMin(s.hard_stop);
  const meals = [
    { kind: "lunch" as const, at: toMin(s.lunch_at), min: s.lunch_min },
    { kind: "dinner" as const, at: toMin(s.dinner_at), min: s.dinner_min },
  ]
    .filter((m) => m.min > 0 && m.at + m.min > t) // refeição ainda por fazer
    .sort((a, b) => a.at - b.at);
  const blocks: Block[] = [];
  const unscheduled: DaySchedule["unscheduled"] = [];
  let used = 0;
  let focusMin = 0;
  let poms = 0;
  const push = (kind: BlockKind, dur: number, extra: Partial<Block> = {}) => {
    blocks.push({ kind, start: toHHMM(t), end: toHHMM(t + dur), ...extra });
    t += dur;
  };
  const mealDue = () => meals.find((m) => t >= m.at);
  const nextMeal = () => meals.find((m) => m.at > t);
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    let left = Math.max(5, Math.round(it.min));
    const parts = Math.max(1, Math.ceil(left / s.focus));
    let part = 0;
    while (left > 0) {
      const m = mealDue();
      if (m) {
        // refeição na hora (se ainda há dia) — retira-se da lista para não repetir
        meals.splice(meals.indexOf(m), 1);
        // sem pausa imediatamente antes da refeição: devolve esse tempo
        const last = blocks[blocks.length - 1];
        if (last && (last.kind === "short" || last.kind === "long")) {
          blocks.pop();
          const d = toMin(last.end) - toMin(last.start);
          t -= d;
          used -= d;
        }
        t = Math.max(t, m.at);
        push(m.kind, m.min);
        continue;
      }
      if (used >= s.work_min || t >= stop) break;
      const nm = nextMeal();
      const untilMeal = nm ? nm.at - t : Infinity;
      if (untilMeal < 10) {
        t = nm!.at; // menos de 10 min até à refeição: começa-a já
        continue;
      }
      const dur = Math.min(s.focus, left, s.work_min - used, untilMeal, stop - t);
      if (dur < 5) break;
      part++;
      push("focus", dur, { task_id: it.id, title: it.title, part: [part, parts] });
      used += dur;
      focusMin += dur;
      left -= dur;
      poms++;
      // pausa depois de cada pomodoro (a última do dia não conta)
      const br = poms % s.every === 0 ? s.long : s.short;
      if (br > 0 && used < s.work_min && t + br < stop) {
        push(poms % s.every === 0 ? "long" : "short", br);
        used += br;
      }
    }
    if (left > 0) {
      unscheduled.push({ ...it, left });
      for (const rest of items.slice(k + 1)) unscheduled.push({ ...rest, left: Math.max(5, Math.round(rest.min)) });
      break;
    }
  }
  // não acabar o dia numa pausa
  while (blocks.length && (blocks[blocks.length - 1].kind === "short" || blocks[blocks.length - 1].kind === "long")) {
    const b = blocks.pop()!;
    used -= toMin(b.end) - toMin(b.start);
  }
  const end = blocks.length ? blocks[blocks.length - 1].end : toHHMM(start);
  return { day, start: toHHMM(start), end, blocks, focus_min: focusMin, work_used: used, pomodoros: poms, unscheduled };
}

/** Minutos do dia de uma data (hora local). */
export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
