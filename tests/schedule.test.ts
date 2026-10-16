import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEDULE, buildSchedule } from "../lib/schedule";

const day = "2026-10-19";
const at = (h: number, m = 0) => h * 60 + m;

describe("horário Pomodoro", () => {
  it("dia completo: 8h de trabalho a partir das 9h, com almoço, termina às 18:00", () => {
    const items = [{ id: "a", title: "Editar reel", min: 600 }];
    const s = buildSchedule(items, DEFAULT_SCHEDULE, day, at(8));
    expect(s.start).toBe("09:00");
    expect(s.work_used).toBeLessThanOrEqual(480);
    expect(s.blocks.find((b) => b.kind === "lunch")).toMatchObject({ start: "12:30", end: "13:30" });
    expect(s.end).toBe("18:00");
    expect(s.unscheduled[0]).toMatchObject({ id: "a" });
  });
  it("pomodoros de 25 min com pausa de 5 e longa de 15 a cada 4", () => {
    const s = buildSchedule([{ id: "a", title: "x", min: 120 }], DEFAULT_SCHEDULE, day, at(9));
    const kinds = s.blocks.map((b) => b.kind);
    expect(kinds.slice(0, 8)).toEqual(["focus", "short", "focus", "short", "focus", "short", "focus", "long"]);
    expect(s.blocks[0]).toMatchObject({ start: "09:00", end: "09:25", part: [1, 5] });
  });
  it("começa a partir de agora (arredondado a 5 min) e salta o almoço que já passou", () => {
    const s = buildSchedule([{ id: "a", title: "x", min: 60 }], DEFAULT_SCHEDULE, day, at(14, 2));
    expect(s.start).toBe("14:05");
    expect(s.blocks.some((b) => b.kind === "lunch")).toBe(false);
  });
  it("um pomodoro não atravessa o almoço", () => {
    const s = buildSchedule([{ id: "a", title: "x", min: 90 }], DEFAULT_SCHEDULE, day, at(12, 10));
    const focus = s.blocks.filter((b) => b.kind === "focus");
    expect(focus[0]).toMatchObject({ start: "12:10", end: "12:30" });
    expect(s.blocks[1]).toMatchObject({ kind: "lunch", start: "12:30" });
  });
  it("à tarde inclui o jantar e nunca passa da hora limite", () => {
    const s = buildSchedule([{ id: "a", title: "x", min: 600 }], DEFAULT_SCHEDULE, day, at(16));
    expect(s.blocks.find((b) => b.kind === "dinner")).toMatchObject({ start: "19:00", end: "19:45" });
    expect(s.end <= "22:00").toBe(true);
    expect(s.unscheduled.length).toBe(1);
  });
  it("respeita a ordem dada e não termina numa pausa", () => {
    const s = buildSchedule(
      [
        { id: "b", title: "B", min: 25 },
        { id: "a", title: "A", min: 25 },
      ],
      DEFAULT_SCHEDULE,
      day,
      at(9)
    );
    expect(s.blocks.filter((b) => b.kind === "focus").map((b) => b.task_id)).toEqual(["b", "a"]);
    expect(s.blocks[s.blocks.length - 1].kind).toBe("focus");
    expect(s.end).toBe("09:55");
  });
});
