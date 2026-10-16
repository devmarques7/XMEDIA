import { describe, expect, it } from "vitest";
import { normalizeData, type Project } from "../lib/types";
import { agenda, expiryLabel, fmtDuration, isoDay, toMin } from "../lib/util";

const proj = (sessions: unknown[], shootDate = ""): Project => ({
  id: crypto.randomUUID(),
  title: "P",
  version: 1,
  created_at: "",
  updated_at: "",
  data: normalizeData({ shootDate, sessions }),
});
const sess = (label: string, date: string, start: string, scenes: string[]) => ({
  label, date, start, end: "23:00", blocks: [{ title: "B", start, end: "23:00", scenes: scenes.map((title) => ({ title })) }],
});

describe("agenda do dia", () => {
  it("usa hoje quando há cenas hoje, ordenadas por hora", () => {
    const a = agenda([proj([sess("Tarde", "2026-10-15", "14:00", ["c"]), sess("Manhã", "2026-10-15", "08:00", ["a", "b"])])], "2026-10-15");
    expect(a.isToday).toBe(true);
    expect(a.items.map((i) => i.scene.title)).toEqual(["a", "b", "c"]);
    expect(a.sessions.map((s) => s.session.label)).toEqual(["Manhã", "Tarde"]);
  });
  it("sem cenas hoje → próxima data", () => {
    const a = agenda([proj([sess("X", "2026-10-20", "08:00", ["x"]), sess("Y", "2026-10-17", "08:00", ["y"])])], "2026-10-15");
    expect(a.day).toBe("2026-10-17");
    expect(a.isToday).toBe(false);
  });
  it("sessão sem data herda a data de gravação do projeto", () => {
    const a = agenda([proj([sess("X", "", "08:00", ["x"])], "2026-10-15")], "2026-10-15");
    expect(a.items).toHaveLength(1);
  });
  it("nada agendado", () => {
    expect(agenda([proj([])]).day).toBeNull();
  });
});

describe("helpers", () => {
  it("tempo", () => {
    expect(toMin("08:30")).toBe(510);
    expect(fmtDuration(3_723_000)).toBe("01:02:03");
    expect(fmtDuration(-5)).toBe("00:00:00");
  });
  it("prazo dos reels", () => {
    expect(expiryLabel("").key).toBe("exp.none");
    expect(expiryLabel(isoDay()).key).toBe("exp.today");
    expect(expiryLabel("2000-01-01").tone).toBe("danger");
  });
});
