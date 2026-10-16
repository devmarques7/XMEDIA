import { describe, expect, it } from "vitest";
import { reviewEmail } from "./reviewEmail";

const base = { origin: "https://x.app", link: "https://x.app/clientes/c1?tab=content&post=p1", customer: "Carioca Restaurant", title: "[WEEK 43] Feijoada", type: "reel", scheduled_at: "2026-10-24T16:00:00.000Z", files: 1, from: "Daniel Marques" };

describe("email de pedido de revisão", () => {
  it("PT: pede a revisão, diz que material é e leva o link", () => {
    const m = reviewEmail({ ...base, lang: "pt", name: "Ana Silva", message: "Atenção ao início." });
    expect(m.subject).toBe("Pedido de revisão: [WEEK 43] Feijoada");
    expect(m.html).toContain("Solicito que revise este conteúdo.");
    expect(m.html).toContain("Material a rever: [WEEK 43] Feijoada");
    expect(m.html).toContain("Olá Ana,");
    expect(m.html).toContain("Atenção ao início.");
    expect(m.html).toContain('href="https://x.app/clientes/c1?tab=content&amp;post=p1"');
    expect(m.html).toContain("Carioca Restaurant");
    expect(m.text).toContain("https://x.app/clientes/c1?tab=content&post=p1");
  });
  it("EN e sem ficheiro", () => {
    const m = reviewEmail({ ...base, lang: "en", files: 0, scheduled_at: undefined });
    expect(m.subject).toBe("Review request: [WEEK 43] Feijoada");
    expect(m.text).toContain("Files: no file yet");
    expect(m.text).toContain("Publishing: no date");
  });
});
