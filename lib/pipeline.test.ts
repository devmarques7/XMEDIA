import { describe, expect, it } from "vitest";
import { DEFAULT_PROCESS, type ContentPost, addNote, clientReview, deadline, emptyPost, mergeNotes, moveToPhase, normalizeProcess, openNotes, patchNote, phaseOf, timecode, touchPhase } from "./customer";
import { mergeFeedback } from "./customerStore";

const at = "2026-10-09T10:00:00.000Z";

describe("comentários no material", () => {
  it("frame exato no vídeo e ponto na imagem, como checklist", () => {
    let p: ContentPost = { ...emptyPost("c", "reel"), status: "review", round: 1 };
    p = addNote(p, { by: "client", text: "Cortar este plano", media: 0, t: 3.4 }, at);
    p = addNote(p, { by: "client", text: "Logo maior", media: 1, x: 1.4, y: 0.25 }, at);
    expect(p.notes[0]).toMatchObject({ t: 3.4, round: 1, done: false });
    expect(p.notes[1]).toMatchObject({ x: 1, y: 0.25 });
    expect(timecode(3.4, 30)).toEqual({ tc: "00:03:12", frame: 102 });
    p = patchNote(p, p.notes[0].id, { done: true }, "2026-10-09T11:00:00.000Z");
    expect(openNotes(p)).toHaveLength(1);
    expect(() => addNote(p, { by: "client", text: " ", media: 0 })).toThrow();
  });
  it("pedir alterações exige texto ou um comentário no material", () => {
    const p = { ...emptyPost("c"), status: "review" as const };
    expect(() => clientReview(p, "changes", "")).toThrow("text_required");
    const withPin = addNote(p, { by: "client", text: "aqui", media: 0, x: 0.5, y: 0.5 });
    expect(clientReview(withPin, "changes", "").status).toBe("draft");
    expect(phaseOf(clientReview(withPin, "changes", ""))).toBe("changes");
  });
  it("junta as notas das duas cópias pela alteração mais recente", () => {
    const base = addNote(emptyPost("c"), { by: "client", text: "a", media: 0 }, at);
    const admin = patchNote(base, base.notes[0].id, { done: true }, "2026-10-09T12:00:00.000Z");
    const client = addNote(base, { by: "client", text: "b", media: 0 }, "2026-10-09T11:00:00.000Z");
    const m = mergeNotes(client.notes, admin.notes);
    expect(m).toHaveLength(2);
    expect(m.find((n) => n.text === "a")!.done).toBe(true);
    // o admin grava uma cópia antiga: a nota nova do cliente não se perde
    expect(mergeFeedback(admin, client).notes).toHaveLength(2);
  });
});

describe("processo e prazos", () => {
  it("fase a partir do estado", () => {
    const p = emptyPost("c");
    expect(phaseOf(p)).toBe("editing");
    expect(phaseOf({ ...p, blocked: true })).toBe("blocked");
    expect(phaseOf({ ...p, status: "failed" })).toBe("blocked");
    expect(phaseOf({ ...p, status: "review" })).toBe("client_review");
  });
  it("arrastar para revisão do cliente abre uma nova ronda", () => {
    const p = moveToPhase(emptyPost("c"), "client_review", at);
    expect([p.status, p.round, p.phase_since]).toEqual(["review", 1, at]);
    expect(moveToPhase(p, "blocked", at).blocked).toBe(true);
    expect(moveToPhase({ ...p, blocked: true }, "changes", at)).toMatchObject({ blocked: false, status: "draft" });
  });
  it("touchPhase só mexe quando a fase muda", () => {
    const prev = { ...emptyPost("c"), phase_since: "2026-10-01T00:00:00.000Z" };
    expect(touchPhase(prev, { ...prev, caption: "x" }, at).phase_since).toBe(prev.phase_since);
    expect(touchPhase(prev, { ...prev, status: "review" }, at).phase_since).toBe(at);
  });
  it("prazo: o mais apertado entre a fase e a data de publicação", () => {
    const proc = normalizeProcess({ ...DEFAULT_PROCESS, steps: { ...DEFAULT_PROCESS.steps, editing: { label: "", days: 5 } } });
    const now = new Date(at);
    const p = { ...emptyPost("c"), phase_since: at };
    expect(deadline(p, proc, now)).toMatchObject({ daysLeft: 5, state: "ok", reason: "step" });
    const soon = { ...p, scheduled_at: "2026-10-12T10:00:00.000Z" }; // publicar em 3 dias, aprovado 2 dias antes
    expect(deadline(soon, proc, now)).toMatchObject({ daysLeft: 1, state: "warn", reason: "publish" });
    const late = { ...p, phase_since: "2026-10-01T10:00:00.000Z" };
    expect(deadline(late, proc, now).state).toBe("late");
    expect(deadline({ ...p, status: "scheduled", scheduled_at: soon.scheduled_at }, proc, now).state).toBe("none");
  });
  it("normaliza a configuração do processo", () => {
    const p = normalizeProcess({ max_rounds: 0, fps: 25, steps: { editing: { label: "Montagem", days: 7 } } as never });
    expect(p.max_rounds).toBe(1);
    expect(p.steps.editing).toEqual({ label: "Montagem", days: 7 });
    expect(p.steps.changes.days).toBe(2);
  });
});
