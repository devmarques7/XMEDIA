import { describe, expect, it } from "vitest";
import { reviewEmail } from "./reviewEmail";

const base = { origin: "https://x.app", link: "https://x.app/l", customer: "Sanctum BV", title: "Sanctum Retreat – Brand Partners", type: "carousel", files: 10, from: "Media Marques" };

describe("email de pedido de revisão", () => {
  it("inglês por omissão e sem nome → saudação neutra", () => {
    const m = reviewEmail({ ...base, lang: "xx" as never });
    expect(m.subject).toBe("Review request: Sanctum Retreat – Brand Partners · Sanctum BV");
    expect(m.html).toContain("Hi there,");
    expect(m.html).toContain("Media Marques has asked you to review the carousel");
    expect(m.html).toContain("Open and review");
  });
  it("PT com nome, data e onboarding do portal", () => {
    const m = reviewEmail({ ...base, lang: "pt", name: "Ana Silva", scheduled_at: "2026-10-24T16:00:00.000Z", mode: "onboarding" });
    expect(m.html).toContain("Olá Ana,");
    expect(m.html).toContain("no portal de clientes MediaMarques");
    expect(m.html).toContain("Criar acesso e rever");
    expect(m.text).toContain("Publicação prevista: 24 de outubro de 2026");
  });
  it("as três línguas têm os mesmos textos", () => {
    for (const lang of ["en", "pt", "nl"] as const) {
      const m = reviewEmail({ ...base, lang, mode: "portal" });
      expect(m.subject.length).toBeGreaterThan(10);
      expect(m.html).not.toMatch(/\{\w+\}/); // nenhum marcador por preencher
    }
  });
});
