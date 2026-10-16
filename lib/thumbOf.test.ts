import { describe, expect, it } from "vitest";
import { emptyPost, thumbOf } from "./customer";

describe("thumbOf (capa como no Instagram)", () => {
  const img = (src: string) => ({ src, kind: "image" as const });
  const vid = (src: string) => ({ src, kind: "video" as const });
  it("carrossel que começa por vídeo: sem imagem (usa-se o frame do vídeo)", () => {
    expect(thumbOf({ ...emptyPost("c", "carousel"), media: [vid("v.mp4"), img("a.jpg")] })).toBe("");
  });
  it("carrossel que começa por imagem: essa imagem", () => {
    expect(thumbOf({ ...emptyPost("c", "carousel"), media: [img("a.jpg"), vid("v.mp4")] })).toBe("a.jpg");
  });
  it("reel: a capa escolhida", () => {
    expect(thumbOf({ ...emptyPost("c", "reel"), cover: "capa.jpg", media: [vid("v.mp4")] })).toBe("capa.jpg");
  });
});
