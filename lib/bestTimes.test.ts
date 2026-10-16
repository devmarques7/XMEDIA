import { describe, expect, it } from "vitest";
import { bestTimes } from "./bestTimes";

describe("melhores momentos", () => {
  it("usa a referência com poucos dados", () => {
    const b = bestTimes([]);
    expect(b.source).toBe("reference");
    expect(b.top[0]).toMatchObject({ day: 2, slot: "evening" }); // quarta ao fim da tarde
  });
  it("calcula a partir das publicações (envolvimento / alcance)", () => {
    const m = (iso: string, likes: number, reach = 1000) => ({ timestamp: iso, likes, comments: 0, reach });
    // quintas 19h (2026-10-01, 08) muito melhores que segundas 9h
    const b = bestTimes([m("2026-10-01T19:00:00", 200), m("2026-10-08T19:30:00", 180), m("2026-09-28T09:00:00", 20), m("2026-10-05T09:00:00", 30), m("2026-10-06T12:00:00", 60), m("2026-10-07T15:00:00", 50)]);
    expect(b.source).toBe("data");
    expect(b.top[0]).toMatchObject({ day: 3, slot: "evening", score: 1 });
  });
});
