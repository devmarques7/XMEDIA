// Música de referência: de que serviço é o link, o id da faixa e formatação do tempo. Partilhado (browser e servidor).
export type MusicSource = "deezer" | "apple" | "spotify" | "youtube" | "soundcloud" | "audio" | "other";
export type MusicInfo = { source: MusicSource; title: string; artist: string; duration: number | null; preview?: string; cover?: string; approx: boolean; playable?: string };

export function parseMusicUrl(raw: string): { source: MusicSource; id?: string; url: string } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.replace(/^www\./, "");
  const url = u.toString();
  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(u.pathname)) return { source: "audio", url };
  if (h.endsWith("deezer.com")) return { source: "deezer", id: /\/track\/(\d+)/.exec(u.pathname)?.[1], url };
  if (h === "music.apple.com" || h === "itunes.apple.com") return { source: "apple", id: u.searchParams.get("i") ?? /\/song\/[^/]+\/(\d+)/.exec(u.pathname)?.[1] ?? undefined, url };
  if (h === "open.spotify.com") return { source: "spotify", id: /\/track\/([A-Za-z0-9]+)/.exec(u.pathname)?.[1], url };
  if (h === "youtube.com" || h === "m.youtube.com" || h === "music.youtube.com" || h === "youtu.be") return { source: "youtube", url };
  if (h === "soundcloud.com" || h === "on.soundcloud.com") return { source: "soundcloud", url };
  return { source: "other", url };
}

/** 75 → "1:15". */
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Recorte válido dentro da duração (início < fim, mínimo 1 s). */
export function clampCut(start: number, end: number, duration: number | null): { start: number; end: number } {
  const max = duration && duration > 0 ? duration : Math.max(end, start + 1, 30);
  const s = Math.max(0, Math.min(Math.round(start), max - 1));
  const e = Math.max(s + 1, Math.min(Math.round(end), max));
  return { start: s, end: e };
}
