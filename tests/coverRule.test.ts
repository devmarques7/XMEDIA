import { describe, expect, it } from "vitest";
import { addNote, applyCoverRule, clientDraft, emptyPost, hasCover, thumbOf, type ContentPost } from "../lib/customer";

const img = (src: string) => ({ src, kind: "image" as const });
const vid = (src: string) => ({ src, kind: "video" as const });
const post = (type: ContentPost["type"], patch: Partial<ContentPost> = {}): ContentPost => ({ ...emptyPost("c", type), ...patch });

describe("só os reels têm capa", () => {
  it("hasCover", () => {
    expect(hasCover("reel")).toBe(true);
    for (const t of ["post", "carousel", "story"] as const) expect(hasCover(t)).toBe(false);
  });
  it("reel mantém a capa", () => {
    const p = post("reel", { cover: "c.jpg", media: [vid("v.mp4")] });
    expect(applyCoverRule(p)).toEqual(p);
  });
  it("carrossel: a capa é o 1.º slide (campo capa vazio)", () => {
    const p = applyCoverRule(post("carousel", { cover: "x.jpg", media: [img("a.jpg"), img("b.jpg")] }));
    expect(p.cover).toBe("");
    expect(thumbOf(p)).toBe("a.jpg");
  });
  it("post sem ficheiros: a imagem da capa passa a ser o ficheiro, com os comentários", () => {
    let p = post("post", { cover: "x.jpg" });
    p = addNote(p, { by: "client", text: "mais luz", media: -1, x: 0.5, y: 0.5 });
    const r = applyCoverRule(p);
    expect(r.cover).toBe("");
    expect(r.media).toEqual([img("x.jpg")]);
    expect(r.notes[0].media).toBe(0);
  });
  it("não perde a capa antiga se tiver comentários e já houver ficheiros", () => {
    let p = post("carousel", { cover: "x.jpg", media: [img("a.jpg")] });
    p = addNote(p, { by: "client", text: "ok", media: -1 });
    expect(applyCoverRule(p).cover).toBe("x.jpg");
  });
  it("story sem capa", () => {
    expect(applyCoverRule(post("story", { cover: "x.jpg", media: [vid("s.mp4")] })).cover).toBe("");
  });
  it("rascunho que muda para reel: a imagem passa a capa", () => {
    const r = applyCoverRule(post("reel", { media: [img("x.jpg")] }));
    expect(r.cover).toBe("x.jpg");
    expect(r.media).toEqual([]);
  });
});

describe("rascunhos do cliente", () => {
  it("reel: a imagem é a capa", () => {
    const d = clientDraft(null, "c", { type: "reel", title: "A", caption: "", cover: "x.jpg" }, "cli");
    expect(d.cover).toBe("x.jpg");
    expect(d.media).toEqual([]);
  });
  it("carrossel: a imagem é o 1.º ficheiro", () => {
    const d = clientDraft(null, "c", { type: "carousel", title: "A", caption: "", cover: "x.jpg" }, "cli");
    expect(d.cover).toBe("");
    expect(d.media).toEqual([img("x.jpg")]);
  });
  it("trocar a imagem de um post substitui o ficheiro (não acumula)", () => {
    const d1 = clientDraft(null, "c", { type: "post", title: "A", caption: "", cover: "x.jpg" }, "cli");
    const d2 = clientDraft(d1, "c", { id: d1.id, type: "post", title: "A", caption: "", cover: "y.jpg" }, "cli");
    expect(d2.media).toEqual([img("y.jpg")]);
    expect(thumbOf(d2)).toBe("y.jpg");
  });
  it("mudar o tipo de reel para post move a capa para o ficheiro", () => {
    const d1 = clientDraft(null, "c", { type: "reel", title: "A", caption: "", cover: "x.jpg" }, "cli");
    const d2 = clientDraft(d1, "c", { id: d1.id, type: "post", title: "A", caption: "" }, "cli");
    expect(d2.cover).toBe("");
    expect(d2.media).toEqual([img("x.jpg")]);
  });
});
