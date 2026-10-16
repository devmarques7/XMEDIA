import { describe, expect, it } from "vitest";
import { mergeBoards, newBoard, newItem, normalizeBoards } from "./moodboard";
import { isImageUrl, mergeRefs, normalizeRefs, parseRef } from "./references";

describe("referências", () => {
  it("reconhece plataformas e gera o embed", () => {
    expect(parseRef("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({ platform: "youtube", embed: "https://www.youtube.com/embed/dQw4w9WgXcQ" });
    expect(parseRef("https://www.youtube.com/shorts/abcdEFGH123")).toMatchObject({ platform: "youtube", vertical: true });
    expect(parseRef("https://www.tiktok.com/@marca/video/7301234567890123456?lang=pt")).toMatchObject({ platform: "tiktok", embed: "https://www.tiktok.com/embed/v2/7301234567890123456" });
    expect(parseRef("https://www.instagram.com/reel/C9xYz_Ab12/?igsh=1")).toMatchObject({ platform: "instagram", embed: "https://www.instagram.com/reel/C9xYz_Ab12/embed/" });
    expect(parseRef("https://www.pinterest.com/pin/123456789/")).toMatchObject({ platform: "pinterest", embed: "https://assets.pinterest.com/ext/embed.html?id=123456789" });
    expect(parseRef("https://vimeo.com/76979871")).toMatchObject({ platform: "vimeo" });
    expect(parseRef("https://example.com/a")?.platform).toBe("web");
    expect(parseRef("javascript:alert(1)")).toBeNull();
    expect(isImageUrl("https://i.pinimg.com/736x/aa/bb.jpg")).toBe(true);
  });
  it("normaliza e junta (a alteração mais recente ganha)", () => {
    const a = normalizeRefs({ groups: [{ id: "g", name: "Luz", updated: "1" }], items: [{ id: "i", url: "https://youtu.be/dQw4w9WgXcQ", group: "g", updated: "1", at: "1" }, { id: "x", url: "ftp://nope" }] });
    expect(a.items).toHaveLength(1);
    const b = { ...a, items: [{ ...a.items[0], deleted: true, updated: "2" }] };
    expect(mergeRefs(a, b).items[0].deleted).toBe(true);
  });
});

describe("moodboards", () => {
  it("posiciona sem sobrepor e normaliza", () => {
    const b = newBoard("Hotel", "Ana");
    const i1 = newItem("image", b.items, { src: "https://x/a.jpg" });
    const i2 = newItem("note", [i1], { text: "luz quente" });
    expect([i1.x, i1.y]).not.toEqual([i2.x, i2.y]);
    const n = normalizeBoards([{ ...b, items: [i1, { ...i2, src: "javascript:x", x: -50 }] }]);
    expect(n[0].items[1].src).toBe("");
    expect(n[0].items[1].x).toBe(0);
    expect(mergeBoards([b], [{ ...b, title: "Novo", updated: "9" }])[0].title).toBe("Novo");
  });
});
