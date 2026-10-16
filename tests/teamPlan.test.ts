import { describe, expect, it } from "vitest";
import { fitsRole, pickForRole, roleKind } from "../lib/teamPlan";

describe("trabalho por função", () => {
  it("reconhece a função pelo texto", () => {
    expect(roleKind("Video Editor")).toBe("editor");
    expect(roleKind("Editora de vídeo e motion")).toBe("editor");
    expect(roleKind("Gestora de projetos")).toBe("manager");
    expect(roleKind("Graphic designer")).toBe("designer");
    expect(roleKind("Social media / copywriter")).toBe("writer");
    expect(roleKind("Estagiário")).toBe("general");
  });
  it("editor faz vídeos; gestora faz seguimentos e ajustes", () => {
    expect(fitsRole("editor", { type: "reel", action: "edit" })).toBe(true);
    expect(fitsRole("editor", { type: "carousel", action: "edit" })).toBe(false);
    expect(fitsRole("manager", { type: "reel", action: "followup" })).toBe(true);
    expect(fitsRole("manager", { type: "reel", action: "edit" })).toBe(false);
  });
  it("só atribui o que cabe no tempo livre, por prioridade", () => {
    const pool = [
      { id: 1, type: "reel" as const, action: "edit" as const, min: 180, score: 10 },
      { id: 2, type: "reel" as const, action: "changes" as const, min: 60, score: 50 },
      { id: 3, type: "post" as const, action: "edit" as const, min: 30, score: 99 },
    ];
    expect(pickForRole(pool, "editor", 200).map((x) => x.id)).toEqual([2]);
    expect(pickForRole(pool, "editor", 300).map((x) => x.id)).toEqual([2, 1]);
  });
});
