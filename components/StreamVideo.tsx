"use client";

// <video> que também toca streams HLS (vídeos no Mux, até 4K, qualidade adaptada à rede):
// Usa hls.js sempre que o browser o suporta (MSE) — o "maybe" nativo do Chrome não é fiável; sem MSE (iPhone) toca nativamente.
// Para vídeos do Mux usa a imagem do próprio Mux como poster se não houver outra.
import { useEffect, useRef } from "react";
import { isHls, isMux, muxPoster } from "@/lib/mux";

type Props = Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "src"> & { src: string; ref?: React.Ref<HTMLVideoElement> };

export function StreamVideo({ src, ref, poster, ...rest }: Props) {
  const own = useRef<HTMLVideoElement | null>(null);
  const hls = isHls(src);
  useEffect(() => {
    const el = own.current;
    if (!el || !hls) return;
    let dead = false;
    let player: import("hls.js").default | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    import("hls.js").then(({ default: Hls }) => {
      if (dead) return;
      if (!Hls.isSupported()) {
        el.src = src; // sem MSE (iPhone): HLS nativo
        return;
      }
      player = new Hls({ capLevelToPlayerSize: true, startLevel: -1 });
      player.loadSource(src);
      player.attachMedia(el);
      player.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal || !player) return;
        // vídeo ainda a ser preparado pelo Mux, ou rede instável: tenta de novo
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR) retry = setTimeout(() => player?.loadSource(src), 6000);
        else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) player.recoverMediaError();
      });
    });
    return () => {
      dead = true;
      clearTimeout(retry);
      player?.destroy();
    };
  }, [src, hls]);
  const setRef = (el: HTMLVideoElement | null) => {
    own.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as React.RefObject<HTMLVideoElement | null>).current = el;
  };
  return <video ref={setRef} src={hls ? undefined : src} poster={poster || (isMux(src) ? muxPoster(src) : undefined)} {...rest} />;
}
