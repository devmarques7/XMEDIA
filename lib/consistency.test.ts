import { describe, expect, it } from "vitest";
import { consistency } from "./consistency";

describe("consistência de publicação", () => {
  it("semanas ativas, sequência, média e maior pausa", () => {
    const today = new Date(2026, 9, 14, 12); // quarta 14 out
    const d = (m: number, day: number) => new Date(2026, m, day, 10).toISOString();
    const dates = [d(9, 13), d(9, 6), d(9, 7), d(8, 29), d(8, 1)]; // esta semana, anterior (×2), 2 semanas antes, e 6 semanas antes
    const c = consistency(dates, [], today);
    expect(c.weeks).toHaveLength(12);
    expect(c.weeks.at(-1)!.n).toBe(1);
    expect(c.active).toBe(4);
    expect(c.streak).toBe(3);
    expect(c.gapDays).toBe(28);
    expect(c.level).toBe("low");
    expect(c.monthPublished).toBe(3);
  });
});
