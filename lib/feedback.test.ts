import { describe, expect, it } from "vitest";
import { collect, parseAnswers, requestState, roundOf, summarize, type FbAnswers, type FbRequest } from "./feedback";

const scores = (v: number) => ({ quality: v, communication: v, deadlines: v, strategy: v, value: v, process: v });
const ans = (nps: number, v: number, improve = ""): FbAnswers => ({ nps, scores: scores(v), best: "", improve, testimonial: false, quote: "" });
const req = (x: Partial<FbRequest> = {}): FbRequest => ({ id: "r1", token_hash: "h", round: "2026-Q4", email: "a@b.c", name: "Ana", lang: "pt", sent_at: "2026-10-01T10:00:00Z", expires_at: "2026-10-30T10:00:00Z", ...x });

describe("avaliações", () => {
  it("valida as respostas (NPS 0–10, notas 1–5 em todas as dimensões)", () => {
    expect(parseAnswers({ nps: 9, scores: scores(5), improve: "  mais   rápido " })?.improve).toBe("mais rápido");
    expect(parseAnswers({ nps: 11, scores: scores(5) })).toBeNull();
    expect(parseAnswers({ nps: 8, scores: { ...scores(4), value: 0 } })).toBeNull();
    expect(parseAnswers({ nps: 8 })).toBeNull();
  });
  it("uso único: respondido, expirado, e uma resposta por ronda", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(requestState(req(), [req()], now)).toBe("open");
    expect(requestState(req({ used_at: "x" }), [], now)).toBe("used");
    expect(requestState(req({ expires_at: "2026-10-10T00:00:00Z" }), [], now)).toBe("expired");
    const other = req({ id: "r2", used_at: "2026-10-05T00:00:00Z" });
    expect(requestState(req(), [req(), other], now)).toBe("used");
    expect(requestState(undefined, [], now)).toBe("invalid");
    expect(roundOf(new Date(2026, 9, 14))).toBe("2026-10");
  });
  it("NPS, satisfação, pontos fracos vs. referência e temas", () => {
    const customers = [
      { id: "a", name: "A", feedback: { requests: [req({ used_at: "2026-10-02", answers: ans(10, 5) })] } },
      { id: "b", name: "B", feedback: { requests: [req({ used_at: "2026-10-03", answers: { ...ans(6, 3, "Os prazos atrasaram e a comunicação demorou"), scores: { ...scores(4), deadlines: 2 } } })] } },
      { id: "c", name: "C", feedback: { requests: [req()] } },
    ];
    const { responses, sent } = collect(customers);
    const s = summarize(responses, sent);
    expect([s.n, s.sent, s.rate]).toEqual([2, 3, 67]);
    expect(s.nps).toBe(0); // 1 promotor, 1 detrator
    expect(s.weak[0]).toBe("deadlines");
    expect(s.themes.map((x) => x.theme)).toEqual(expect.arrayContaining(["deadlines", "communication"]));
    expect(s.csat).toBe(92); // 11 de 12 notas ≥ 4
  });
});
