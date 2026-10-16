import { describe, expect, it } from "vitest";
import { addNote, binDaysLeft, binExpired, emptyPost, isEmptyPost, visibleToClient } from "../lib/customer";

describe("lixo (15 dias)", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  it("conteúdo vazio apaga-se de vez; com qualquer coisa dentro vai para o lixo", () => {
    const p = emptyPost("c", "reel");
    expect(isEmptyPost(p)).toBe(true);
    expect(isEmptyPost({ ...p, title: "Só título" })).toBe(true);
    expect(isEmptyPost({ ...p, caption: "Legenda" })).toBe(false);
    expect(isEmptyPost({ ...p, media: [{ src: "a.mp4", kind: "video" }] })).toBe(false);
    expect(isEmptyPost(addNote(p, { by: "client", text: "ok", media: 0 }))).toBe(false);
    expect(isEmptyPost({ ...p, refs: { music: "https://x" } })).toBe(false);
  });
  it("conta os dias que faltam e expira ao fim de 15", () => {
    const d = { deleted_at: "2026-10-10T12:00:00Z" };
    expect(binDaysLeft(d, now)).toBe(9);
    expect(binExpired(d, now)).toBe(false);
    expect(binExpired({ deleted_at: "2026-09-30T12:00:00Z" }, now)).toBe(true);
  });
  it("o cliente nunca vê o que está no lixo", () => {
    expect(visibleToClient({ ...emptyPost("c"), status: "review", deleted_at: now.toISOString() })).toBe(false);
  });
});
