// Informação de uma faixa a partir do link (título, artista, duração, capa, pré-escuta de 30 s).
// Só fala com APIs públicas fixas (Deezer, iTunes, oEmbed do Spotify/YouTube/SoundCloud) — o link do utilizador
// vai apenas como parâmetro, nunca como destino do pedido.
import { parseMusicUrl, type MusicInfo } from "../music";
import { HttpError } from "./admin";

const get = async (url: string) => {
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } });
  return r.ok ? r.json() : null;
};

type DeezerTrack = { title?: string; duration?: number; preview?: string; artist?: { name?: string }; album?: { cover_medium?: string } };
const fromDeezer = (t: DeezerTrack, approx: boolean, source: MusicInfo["source"] = "deezer"): MusicInfo => ({
  source,
  title: t.title ?? "",
  artist: t.artist?.name ?? "",
  duration: typeof t.duration === "number" ? t.duration : null,
  preview: t.preview || undefined,
  cover: t.album?.cover_medium,
  approx,
});

/** Procura no Deezer por título (e artista) — usado quando o serviço não dá a duração. */
async function searchDeezer(q: string, source: MusicInfo["source"], fallback: { title: string; artist: string; cover?: string }): Promise<MusicInfo> {
  const j = q ? await get(`https://api.deezer.com/search?limit=1&q=${encodeURIComponent(q.slice(0, 200))}`) : null;
  const t = (j?.data?.[0] ?? null) as DeezerTrack | null;
  if (!t) return { source, ...fallback, duration: null, approx: true };
  return { ...fromDeezer(t, true, source), title: fallback.title || t.title || "", artist: fallback.artist || t.artist?.name || "", cover: fallback.cover || t.album?.cover_medium };
}

export async function musicInfo(raw: string): Promise<MusicInfo> {
  const m = parseMusicUrl(raw);
  if (!m) throw new HttpError(400, "invalid_url");
  if (m.source === "audio") return { source: "audio", title: decodeURIComponent(new URL(m.url).pathname.split("/").pop() ?? ""), artist: "", duration: null, approx: false, playable: m.url };
  if (m.source === "deezer" && m.id) {
    const t = await get(`https://api.deezer.com/track/${m.id}`);
    if (t && !t.error) return fromDeezer(t, false);
  }
  if (m.source === "apple" && m.id) {
    const j = await get(`https://itunes.apple.com/lookup?id=${encodeURIComponent(m.id)}`);
    const r = j?.results?.[0];
    if (r) return { source: "apple", title: r.trackName ?? "", artist: r.artistName ?? "", duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null, preview: r.previewUrl, cover: r.artworkUrl100, approx: false };
  }
  // sem duração no próprio serviço: título pelo oEmbed e duração aproximada pelo Deezer
  const oembed =
    m.source === "spotify"
      ? `https://open.spotify.com/oembed?url=${encodeURIComponent(m.url)}`
      : m.source === "youtube"
        ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(m.url)}`
        : m.source === "soundcloud"
          ? `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(m.url)}`
          : "";
  const o = oembed ? await get(oembed) : null;
  const rawTitle = String(o?.title ?? "");
  // "Música by Artista" (SoundCloud) / "Artista - Música (Official Video)" (YouTube)
  const by = /^(.*) by (.*)$/.exec(rawTitle);
  const dash = /^(.*?)\s+[-–]\s+(.*)$/.exec(rawTitle);
  const title = (by ? by[1] : dash ? dash[2] : rawTitle).replace(/\s*[([](official|video|lyrics|audio|clip|visualizer)[^)\]]*[)\]]/gi, "").trim();
  const artist = (by ? by[2] : dash ? dash[1] : String(o?.author_name ?? "")).replace(/\s*-\s*Topic$/i, "").trim();
  return searchDeezer(`${artist} ${title}`.trim(), m.source, { title, artist, cover: o?.thumbnail_url });
}
