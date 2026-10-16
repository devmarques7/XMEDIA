import { describe, expect, it } from "vitest";
import { targetBitrate } from "../lib/videoOptimize";

describe("targetBitrate", () => {
  const MB = 1024 * 1024;
  it("um reel de 60 s cabe em 44 MB a ~5,3 Mbps", () => {
    const b = targetBitrate(44 * MB, 60);
    expect(b).toBeGreaterThan(5_000_000);
    expect(b).toBeLessThan(5_600_000);
    // tamanho final estimado (vídeo + áudio) fica abaixo do alvo
    expect(((b + 128_000) * 60) / 8).toBeLessThan(44 * MB);
  });
  it("vídeos curtos ficam no máximo de 12 Mbps", () => {
    expect(targetBitrate(44 * MB, 10)).toBe(12_000_000);
  });
  it("vídeos longos demais dão bitrate baixo (o upload recusa abaixo de 1,5 Mbps)", () => {
    expect(targetBitrate(44 * MB, 600)).toBeLessThan(1_500_000);
  });
});
