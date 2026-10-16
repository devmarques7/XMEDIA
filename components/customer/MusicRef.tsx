"use client";

// Música de referência: cola-se o link (Spotify, Apple Music, Deezer, YouTube, SoundCloud ou um ficheiro de áudio),
// a app lê o título e a duração da faixa e mostra um recorte "de onde até onde" usar — dois pontos a arrastar,
// atalhos de 7/15/30/60 s e, quando há áudio, ouvir o trecho (ou a amostra de 30 s do serviço).
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { ContentPost } from "@/lib/customer";
import { useT } from "@/lib/i18n";
import { clampCut, mmss, parseMusicUrl, type MusicInfo } from "@/lib/music";

type Refs = NonNullable<ContentPost["refs"]>;

export function MusicRef({ refs, onChange, endpoint, disabled }: { refs: Refs; onChange: (r: Refs) => void; endpoint: "/api/music/info" | "/api/portal/music"; disabled?: boolean }) {
  const { t } = useT();
  const [info, setInfo] = useState<MusicInfo | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = refs.music ?? "";
  const valid = !!parseMusicUrl(url);

  // lê a faixa quando o link muda (com uma pequena espera enquanto se escreve)
  useEffect(() => {
    if (!valid) return setInfo(null);
    let dead = false;
    const id = setTimeout(async () => {
      setState("loading");
      try {
        const r = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);
        const j = r.ok ? ((await r.json()) as MusicInfo) : null;
        if (dead) return;
        if (!j) throw new Error();
        setInfo(j);
        setState("idle");
        // guarda título e duração para mostrar noutros sítios (cartões, portal)
        if (j.duration && (refs.music_duration !== j.duration || !refs.music_title)) {
          const cut = clampCut(refs.music_start ?? 0, refs.music_end ?? Math.min(j.duration, 15), j.duration);
          onChange({ ...refs, music_title: [j.artist, j.title].filter(Boolean).join(" — "), music_duration: j.duration, music_start: cut.start, music_end: cut.end });
        }
      } catch {
        if (!dead) setState("error");
      }
    }, 500);
    return () => {
      dead = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, endpoint]);

  // ficheiro de áudio direto: a duração lê-se no próprio browser
  const onMeta = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const d = Math.round(e.currentTarget.duration);
    if (info?.source === "audio" && d > 0 && refs.music_duration !== d) {
      setInfo({ ...info, duration: d });
      const cut = clampCut(refs.music_start ?? 0, refs.music_end ?? Math.min(d, 15), d);
      onChange({ ...refs, music_duration: d, music_start: cut.start, music_end: cut.end });
    }
  };
  const duration = info?.duration ?? refs.music_duration ?? null;
  const max = duration ?? 300;
  const start = refs.music_start ?? 0;
  const end = refs.music_end ?? Math.min(max, 15);
  const setCut = (s: number, e: number) => {
    const c = clampCut(s, e, duration);
    onChange({ ...refs, music_start: c.start, music_end: c.end });
  };
  const src = info?.playable ?? info?.preview;
  function play() {
    const a = audio.current;
    if (!a || !src) return;
    if (playing) return a.pause();
    // o ficheiro completo toca o trecho exato; a amostra do serviço toca do início (30 s)
    a.currentTime = info?.playable ? start : 0;
    a.play().catch(() => {});
  }
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const tick = () => info?.playable && a.currentTime >= end && a.pause();
    a.addEventListener("timeupdate", tick);
    return () => a.removeEventListener("timeupdate", tick);
  }, [end, info?.playable]);

  return (
    <div className="mref" data-testid="music-ref">
      <label className="dp-ref">
        <Icon name="music" size={14} />
        <input className="input" value={url} onChange={(e) => onChange({ ...refs, music: e.target.value })} placeholder={t("dp.musicPh")} disabled={disabled} data-testid="pe-music" />
      </label>
      {valid && (
        <div className="mref-card">
          <div className="mref-top">
            {info?.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.cover} alt="" className="mref-cover" />
            ) : (
              <span className="mref-cover mref-ph">
                <Icon name="music" size={16} />
              </span>
            )}
            <span className="mref-meta">
              <b>{state === "loading" ? t("mref.loading") : info?.title || refs.music_title || t("mref.unknown")}</b>
              <span className="muted small">
                {info?.artist}
                {duration ? ` · ${mmss(duration)}` : ""}
                {info?.approx && duration ? ` · ${t("mref.approx")}` : ""}
                {state === "error" && t("mref.error")}
              </span>
            </span>
            {src && (
              <button className="btn small" onClick={play} type="button" data-testid="mref-play">
                <Icon name={playing ? "pause" : "play"} size={13} /> {info?.playable ? t("mref.playCut") : t("mref.playPreview")}
              </button>
            )}
          </div>

          {/* recorte: de onde até onde usar */}
          <div className="mref-cut">
            <div className="mref-range" style={{ ["--a" as string]: `${(start / max) * 100}%`, ["--b" as string]: `${(end / max) * 100}%` }}>
              <span className="mref-sel" aria-hidden />
              <input type="range" min={0} max={max} step={1} value={start} onChange={(e) => setCut(Math.min(Number(e.target.value), end - 1), end)} aria-label={t("mref.start")} disabled={disabled} data-testid="mref-start" />
              <input type="range" min={0} max={max} step={1} value={end} onChange={(e) => setCut(start, Math.max(Number(e.target.value), start + 1))} aria-label={t("mref.end")} disabled={disabled} data-testid="mref-end" />
            </div>
            <div className="mref-times mono small">
              <span>{mmss(start)}</span>
              <b data-testid="mref-len">{t("mref.use", { a: mmss(start), b: mmss(end), n: end - start })}</b>
              <span>{mmss(max)}</span>
            </div>
            <div className="mref-presets">
              {[7, 15, 30, 60].map((n) => (
                <button key={n} type="button" className="cb-chip" disabled={disabled || (!!duration && n > duration)} onClick={() => setCut(start, start + n)}>
                  {n} s
                </button>
              ))}
              {!duration && <span className="muted small">{t("mref.noDuration")}</span>}
            </div>
          </div>
          {src && <audio ref={audio} src={src} preload="metadata" onLoadedMetadata={onMeta} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
        </div>
      )}
    </div>
  );
}
