// Vídeos no Mux: o src guardado é o stream adaptativo (HLS) — https://stream.mux.com/<playback>.m3u8 — que toca até 4K.
// Daí derivam a imagem de capa e os MP4 estáticos (download e publicação no Instagram).
const RE = /^https:\/\/stream\.mux\.com\/([A-Za-z0-9]+)\.m3u8$/;

export const isMux = (src: string | undefined) => !!src && RE.test(src);
export const muxPlayback = (src: string) => RE.exec(src)?.[1] ?? "";
export const muxSrc = (playbackId: string) => `https://stream.mux.com/${playbackId}.m3u8`;
export const muxPoster = (src: string, width = 720) => `https://image.mux.com/${muxPlayback(src)}/thumbnail.webp?width=${width}&fit_mode=preserve`;
/** MP4 estático (só depois de o Mux o preparar). */
export const muxMp4 = (src: string, name: "720p" | "1080p" | "2160p" = "1080p", download?: string) =>
  `https://stream.mux.com/${muxPlayback(src)}/${name}.mp4${download ? `?download=${encodeURIComponent(download)}` : ""}`;
export const isHls = (url: string | null | undefined) => !!url && /\.m3u8(\?|$)/.test(url);
