import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, deadline, emptyPost, moveToPhase, normalizePost, visibleToClient } from "../lib/customer";

const proc = DEFAULT_SETTINGS.process;

describe("conteúdo interno", () => {
  it("conteúdos antigos (sem a marca) continuam visíveis para o cliente", () => {
    const p = normalizePost({ customer_id: "c", status: "draft" });
    expect(p.internal).toBeUndefined();
    expect(visibleToClient(p)).toBe(true);
  });
  it("interno fica escondido, mesmo em edição", () => {
    expect(visibleToClient({ ...emptyPost("c"), internal: true })).toBe(false);
  });
  it("enviar para aprovação torna-o visível", () => {
    const p = moveToPhase({ ...emptyPost("c"), internal: true }, "client_review");
    expect(p.internal).toBe(false);
    expect(visibleToClient(p)).toBe(true);
  });
  it("mudar para edição não o mostra ao cliente", () => {
    expect(moveToPhase({ ...emptyPost("c"), internal: true }, "editing").internal).toBe(true);
  });
});

describe("prazos de finalizar e entregar", () => {
  const now = new Date("2026-10-15T09:00:00");
  it("o prazo mais apertado ganha (finalizar antes de entregar)", () => {
    const p = { ...emptyPost("c"), phase_since: now.toISOString(), due_finish: "2026-10-16", due_deliver: "2026-10-18" };
    const d = deadline(p, { ...proc, steps: { ...proc.steps, editing: { ...proc.steps.editing, days: 30 } } }, now);
    expect(d.reason).toBe("finish");
    expect(d.daysLeft).toBe(2);
  });
  it("depois de enviado ao cliente, os prazos de produção já não contam", () => {
    const p = { ...emptyPost("c"), status: "review" as const, phase_since: now.toISOString(), due_finish: "2026-10-01" };
    expect(deadline(p, proc, now).reason).not.toBe("finish");
  });
  it("prazo passado = atrasado", () => {
    const p = { ...emptyPost("c"), phase_since: now.toISOString(), due_deliver: "2026-10-10" };
    expect(deadline(p, proc, now).state).toBe("late");
  });
});
