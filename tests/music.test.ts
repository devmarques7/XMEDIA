import { describe, expect, it } from "vitest";
import { clampCut, mmss, parseMusicUrl } from "../lib/music";
import { cleanRefs } from "../lib/customer";

describe("música de referência", () => {
  it("reconhece o serviço e o id da faixa", () => {
    expect(parseMusicUrl("https://open.spotify.com/track/69kOkLUCkxIZYexIgSG8rq?si=x")).toMatchObject({ source: "spotify", id: "69kOkLUCkxIZYexIgSG8rq" });
    expect(parseMusicUrl("https://www.deezer.com/en/track/67238735")).toMatchObject({ source: "deezer", id: "67238735" });
    expect(parseMusicUrl("https://music.apple.com/nl/album/get-lucky/617154241?i=617154366")).toMatchObject({ source: "apple", id: "617154366" });
    expect(parseMusicUrl("https://youtu.be/5NV6Rdv1a3I")).toMatchObject({ source: "youtube" });
    expect(parseMusicUrl("https://cdn.example.com/beat.mp3")).toMatchObject({ source: "audio" });
    expect(parseMusicUrl("http://inseguro.com/a.mp3")).toBeNull();
    expect(parseMusicUrl("não é link")).toBeNull();
  });
  it("recorte sempre dentro da faixa, com pelo menos 1 s", () => {
    expect(clampCut(32, 47, 248)).toEqual({ start: 32, end: 47 });
    expect(clampCut(240, 300, 248)).toEqual({ start: 240, end: 248 });
    expect(clampCut(50, 40, 248)).toEqual({ start: 50, end: 51 });
    expect(mmss(75)).toBe("1:15");
  });
  it("guarda o trecho só com música e com fim depois do início", () => {
    expect(cleanRefs({ music: "https://open.spotify.com/track/x", music_start: 32, music_end: 47, music_title: "Daft Punk — Get Lucky", music_duration: 248 })).toMatchObject({ music_start: 32, music_end: 47, music_duration: 248 });
    expect(cleanRefs({ music: "https://open.spotify.com/track/x", music_start: 50, music_end: 40 })?.music_end).toBeUndefined();
    expect(cleanRefs({ music_start: 10, music_end: 20 })).toBeUndefined();
  });
});
