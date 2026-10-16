import { describe, expect, it } from "vitest";
import { isHls, isMux, muxMp4, muxPlayback, muxPoster, muxSrc } from "../lib/mux";

describe("mux", () => {
  const src = muxSrc("abC123xyz");
  it("guarda o stream HLS e reconhece-o", () => {
    expect(src).toBe("https://stream.mux.com/abC123xyz.m3u8");
    expect(isMux(src)).toBe(true);
    expect(isHls(src)).toBe(true);
    expect(muxPlayback(src)).toBe("abC123xyz");
  });
  it("não confunde vídeos do Supabase", () => {
    const sb = "https://x.supabase.co/storage/v1/object/public/proposal-media/a/b.mp4";
    expect(isMux(sb)).toBe(false);
    expect(isHls(sb)).toBe(false);
  });
  it("capa e MP4 derivados", () => {
    expect(muxPoster(src)).toBe("https://image.mux.com/abC123xyz/thumbnail.webp?width=720&fit_mode=preserve");
    expect(muxMp4(src, "1080p", "Reel 1.mp4")).toBe("https://stream.mux.com/abC123xyz/1080p.mp4?download=Reel%201.mp4");
  });
});
