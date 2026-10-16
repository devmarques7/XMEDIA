import { describe, expect, it } from "vitest";
import { emptyPost, moveToPhase, type ContentPost } from "../lib/customer";
import { applyAssignRules, type AssignRule } from "../lib/assignRules";

const post = (p: Partial<ContentPost> = {}): ContentPost => ({ ...emptyPost("c1", "reel"), ...p });
const rules: AssignRule[] = [
  { id: "1", on: "create", type: "any", customer_id: "any", assignee: "Gestora@x.com" },
  { id: "2", on: "phase", phase: "editing", type: "reel", customer_id: "any", assignee: "editor@x.com" },
  { id: "3", on: "phase", phase: "editing", type: "carousel", customer_id: "any", assignee: "designer@x.com" },
  { id: "4", on: "phase", phase: "changes", type: "any", customer_id: "c1", assignee: "editor2@x.com" },
  { id: "5", on: "phase", phase: "approved", type: "any", customer_id: "any", assignee: "gestora@x.com", active: false },
];

describe("automação de responsáveis", () => {
  it("conteúdo novo fica com quem a regra de criação diz (email em minúsculas)", () => {
    expect(applyAssignRules(null, post({ status: "idea" }), rules).assignee).toBe("gestora@x.com");
  });
  it("ao passar para edição: reel → editor, carrossel → designer", () => {
    const prev = post({ status: "idea" });
    expect(applyAssignRules(prev, moveToPhase(prev, "editing"), rules).assignee).toBe("editor@x.com");
    const c = post({ type: "carousel", status: "idea" });
    expect(applyAssignRules(c, moveToPhase(c, "editing"), rules).assignee).toBe("designer@x.com");
  });
  it("a regra do cliente ganha à geral", () => {
    const prev = post({ status: "review" });
    // o cliente pediu alterações → etapa "changes"
    const next = { ...moveToPhase(prev, "changes"), feedback: [{ id: "f", at: "2026-10-16T10:00:00Z", by: "client" as const, text: "mudar", action: "changes" as const }] };
    expect(applyAssignRules(prev, next, rules).assignee).toBe("editor2@x.com");
  });
  it("sem mudança de etapa não mexe; regra desligada não conta", () => {
    const p = post({ status: "draft", assignee: "ana@x.com" });
    expect(applyAssignRules(p, { ...p, caption: "nova" }, rules).assignee).toBe("ana@x.com");
    const r = post({ status: "review", assignee: "ana@x.com" });
    expect(applyAssignRules(r, moveToPhase(r, "approved"), rules).assignee).toBe("ana@x.com");
  });
  it("criado já numa etapa usa a regra dessa etapa quando é mais específica", () => {
    expect(applyAssignRules(null, post({ type: "carousel", status: "draft" }), rules).assignee).toBe("designer@x.com");
  });
});
