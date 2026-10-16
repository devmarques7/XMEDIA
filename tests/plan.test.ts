import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, emptyPost, type ContentPost } from "../lib/customer";
import { calibrate, dayLoad, estimatePost, estimateTask, firstFreeDay, fmtMin, parseEstimate, pendingWork, plannable, recommend, DEFAULT_PLAN } from "../lib/plan";
import type { StudioTask } from "../lib/studio";

const proc = DEFAULT_SETTINGS.process;
const task = (p: Partial<StudioTask>): StudioTask => ({ id: Math.random().toString(36).slice(2), title: "Tarefa", notes: "", done: false, due: "", post_id: "", mentions: [], by: "", side: "studio", at: "2026-10-01T09:00:00Z", updated: "2026-10-01T09:00:00Z", customer_id: "c", customer: "C", ...p });
const post = (p: Partial<ContentPost>): ContentPost => ({ ...emptyPost("uz", "reel"), ...p });

describe("estimativas", () => {
  it("lê o tempo escrito no título", () => {
    expect(parseEstimate("Editar reel (2h)")).toBe(120);
    expect(parseEstimate("Rever legendas 45 min")).toBe(45);
    expect(parseEstimate("Gravar 1,5h")).toBe(90);
    expect(parseEstimate("Sem tempo")).toBeNull();
  });
  it("reel em edição demora mais do que um post", () => {
    expect(estimatePost(post({ status: "draft" }))).toBeGreaterThan(estimatePost(post({ type: "post", status: "draft" })));
  });
  it("carrossel longo soma tempo por slide", () => {
    const media = Array.from({ length: 9 }, (_, i) => ({ src: `${i}.jpg`, kind: "image" as const }));
    expect(estimatePost(post({ type: "carousel", status: "draft", media }))).toBe(120 + 4 * 10);
  });
  it("prioridade: manual > título > conteúdo > 30 min", () => {
    const p = post({ id: "p1", status: "draft" });
    expect(estimateTask(task({ estimate: 25, title: "x (2h)", post_id: "p1" }), [p])).toBe(25);
    expect(estimateTask(task({ title: "x (2h)", post_id: "p1" }), [p])).toBe(120);
    expect(estimateTask(task({ post_id: "p1" }), [p])).toBe(180);
    expect(estimateTask(task({}), [])).toBe(30);
  });
});

describe("capacidade do dia", () => {
  const SIX = { ...DEFAULT_PLAN, capacity_min: 360 };
  it("base: 8h com 20% de margem = 6h24 planeáveis", () => {
    expect(plannable(DEFAULT_PLAN, "2026-10-16")).toBe(384);
  });
  it("6h com 20% de margem = 4h48 planeáveis; fim de semana = 0", () => {
    expect(plannable(SIX, "2026-10-16")).toBe(288); // sexta
    expect(plannable(SIX, "2026-10-17")).toBe(0); // sábado
  });
  it("avisa quando passa do máximo (e conta os atrasados hoje)", () => {
    const tasks = [task({ due: "2026-10-16", estimate: 200 }), task({ due: "2026-10-15", estimate: 120 })];
    const d = dayLoad("2026-10-16", "2026-10-16", tasks, [], SIX);
    expect(d.planned).toBe(320);
    expect(d.level).toBe("over");
  });
  it("no limite a partir de 85%", () => {
    expect(dayLoad("2026-10-16", "2026-10-16", [task({ due: "2026-10-16", estimate: 250 })], [], SIX).level).toBe("tight");
  });
  it("o primeiro dia com espaço salta o dia cheio e o fim de semana", () => {
    const tasks = [task({ due: "2026-10-16", estimate: 280 })];
    expect(firstFreeDay(60, "2026-10-16", "2026-10-16", tasks, [], SIX)).toBe("2026-10-19");
  });
});

describe("calibração pelo histórico", () => {
  it("se registas mais horas do que o estimado, as estimativas sobem", () => {
    const entries = [1, 2, 3].map((d) => ({ id: `e${d}`, member_id: "m", date: `2026-10-1${d}`, start: "09:00", end: "13:00", break_min: 0, project: "", note: "" }));
    const tasks = [task({ done: true, updated: "2026-10-12T10:00:00Z", estimate: 240 })];
    const c = calibrate(entries, tasks, [], DEFAULT_PLAN, "2026-10-16");
    expect(c.reliable).toBe(true);
    expect(c.factor).toBe(2.5); // 12h reais / 4h estimadas = 3 → limitado a 2,5
    expect(c.dailyLogged).toBe(240);
  });
  it("sem dados suficientes o fator é 1", () => {
    expect(calibrate([], [], [], DEFAULT_PLAN, "2026-10-16").factor).toBe(1);
  });
});

describe("pendentes de um cliente (sem filtro de data)", () => {
  const now = new Date("2026-10-16T09:00:00");
  it("mostra conteúdos sem prazo próximo e ignora os que já têm tarefa", () => {
    const a = post({ id: "a", status: "draft", phase_since: now.toISOString() });
    const b = post({ id: "b", status: "draft", phase_since: now.toISOString() });
    const list = pendingWork([a, b], [task({ post_id: "b" })], { ...proc, steps: { ...proc.steps, editing: { label: "", days: 30 } } }, DEFAULT_PLAN, now);
    expect(list.map((x) => x.p.id)).toEqual(["a"]);
    expect(list[0].reason).toBe("open");
  });
  it("recomenda por prioridade o que cabe no tempo livre", () => {
    const r = recommend([{ min: 180, score: 50 }, { min: 60, score: 40 }, { min: 30, score: 10 }], 240);
    expect(r.fit.map((x) => x.min)).toEqual([180, 60]);
    expect(r.later.map((x) => x.min)).toEqual([30]);
  });
  it("formato do tempo", () => {
    expect(fmtMin(135)).toBe("2h15");
    expect(fmtMin(120)).toBe("2h");
    expect(fmtMin(45)).toBe("45 min");
  });
});

import { byRank, reorder } from "../lib/today";
describe("ordem manual da checklist", () => {
  const L = ["a", "b", "c", "d"].map((id) => ({ t: { id, rank: undefined as number | undefined } }));
  it("subir o 'c' para o topo grava a nova ordem", () => {
    const r = reorder(L, 2, 0);
    expect(r).toEqual([
      { id: "c", rank: 0 },
      { id: "a", rank: 1 },
      { id: "b", rank: 2 },
      { id: "d", rank: 3 },
    ]);
  });
  it("a ordem manual vence a prioridade automática; sem rank mantém a ordem de prioridade", () => {
    const list = [{ t: { id: "x" } }, { t: { id: "y", rank: 0 } }, { t: { id: "z" } }];
    expect(byRank(list).map((x) => x.t.id)).toEqual(["y", "x", "z"]);
  });
  it("só grava o que mudou", () => {
    const ranked = ["a", "b", "c"].map((id, i) => ({ t: { id, rank: i } }));
    expect(reorder(ranked, 2, 1)).toEqual([
      { id: "c", rank: 1 },
      { id: "b", rank: 2 },
    ]);
  });
});
