import { describe, expect, it } from "vitest";
import { emptyProposal, importProposalJson, normalizeSlide, parseMarks, pipeline, templateDoc, videoEmbed } from "./proposal";

describe("propostas", () => {
  it("template replica a estrutura da apresentação do Canva", () => {
    const d = templateDoc("Sanctum");
    expect(d.meta.fao).toBe("[ Sanctum Proposal ]");
    expect(d.slides.map((s) => s.type)).toEqual(["cover", "section", "manifest", "section", "case", "section", "list", "list", "cycle", "section", "packages", "list", "closing"]);
    const pk = d.slides.find((s) => s.type === "packages");
    expect(pk && "packages" in pk && pk.packages.map((p) => p.price)).toEqual(["€ 750,00 EUR", "€ 1.250,00 EUR"]);
  });
  it("ênfase: *destaque* e **negrito**", () => {
    expect(parseMarks("*Manifest* — we **architect** perception")).toEqual([
      { text: "Manifest", accent: true },
      { text: " — we " },
      { text: "architect", bold: true },
      { text: " perception" },
    ]);
  });
  it("valida slides vindos de JSON/IA", () => {
    expect(() => normalizeSlide({ type: "banana" })).toThrow('"type"');
    const s = normalizeSlide({ type: "list", title: "FAQ", rows: [{ n: 1, name: "Q?", text: "A." }] });
    expect(s).toMatchObject({ type: "list", tone: "dark", rows: [{ n: "1", name: "Q?" }] });
    const c = normalizeSlide({ type: "case", media: [{ src: "https://youtu.be/abc123xyz", kind: "video" }, { nope: 1 }] });
    expect(c.type === "case" && c.media).toHaveLength(1);
  });
  it("importa slides, doc ou proposta completa", () => {
    expect(importProposalJson('[{"type":"section","number":"1","title":"Intro","text":"x"}]').patch.doc?.slides).toHaveLength(1);
    const r = importProposalJson('{"title":"Shirley","value":2950,"stage":"sent","slides":[{"type":"closing","text":"Thanks"}]}');
    expect(r.patch).toMatchObject({ title: "Shirley", value: 2950, stage: "sent" });
    expect(importProposalJson("{oops").errors[0]).toContain("JSON inválido");
  });
  it("pipeline e embeds de vídeo", () => {
    const a = { ...emptyProposal(), value: 1000, stage: "sent" as const };
    const b = { ...emptyProposal(), value: 750, stage: "won" as const };
    const c = { ...emptyProposal(), value: 500, stage: "lost" as const };
    expect(pipeline([a, b, c])).toEqual({ openValue: 1000, openCount: 1, wonValue: 750, winRate: 50 });
    expect(videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbed("https://vimeo.com/123456")).toBe("https://player.vimeo.com/video/123456");
    expect(videoEmbed("https://x.com/film.mp4")).toBeNull();
  });
});
