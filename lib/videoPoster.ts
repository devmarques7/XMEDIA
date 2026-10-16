"use client";

// Miniatura automática dos vídeos sem capa: abre o vídeo em segundo plano, salta para o MEIO e guarda esse frame
// como JPEG (object URL). O primeiro frame costuma ser preto; o do meio representa melhor o conteúdo.
// Precisa de CORS de leitura no armazenamento (R2 e Supabase Storage têm); sem CORS devolve null e fica o leitor normal.
import { useEffect, useState } from "react";
import { isHls } from "./mux";

const MAX_SIDE = 720; // chega para cartões e pré-visualizações, e mantém o JPEG leve
const TIMEOUT_MS = 20_000;
const PARALLEL = 2; // um quadro com muitos cartões não abre dezenas de vídeos ao mesmo tempo

const cache = new Map<string, Promise<string | null>>();
let running = 0;
const queue: (() => void)[] = [];

function slot<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve) => {
    const start = () => {
      running++;
      job()
        .then(resolve)
        .finally(() => {
          running--;
          queue.shift()?.();
        });
    };
    if (running < PARALLEL) start();
    else queue.push(start);
  });
}

function grab(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    let settled = false;
    const done = (r: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      v.removeAttribute("src");
      v.load(); // liberta a ligação
      resolve(r);
    };
    const timer = setTimeout(() => done(null), TIMEOUT_MS);
    if (!url.startsWith("blob:")) v.crossOrigin = "anonymous"; // sem isto o canvas fica "tainted" e não exporta
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = v.duration;
      v.currentTime = Number.isFinite(d) && d > 0 ? d / 2 : 0.1;
    };
    v.onseeked = () => {
      try {
        if (!v.videoWidth || !v.videoHeight) return done(null);
        const k = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(v.videoWidth * k);
        c.height = Math.round(v.videoHeight * k);
        c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => done(b ? URL.createObjectURL(b) : null), "image/jpeg", 0.82);
      } catch {
        done(null);
      }
    };
    v.onerror = () => done(null);
    // parâmetro próprio: o browser não reaproveita a resposta do <video> (pedida sem CORS e guardada sem
    // Access-Control-Allow-Origin), que deixaria o canvas "tainted" → miniatura preta
    v.src = url.startsWith("blob:") || url.startsWith("data:") ? url : `${url}${url.includes("?") ? "&" : "?"}xmposter=1`;
  });
}

/** Frame do meio do vídeo como object URL (em cache por sessão); null se não for possível. */
export function videoPoster(url: string): Promise<string | null> {
  if (!url || isHls(url)) return Promise.resolve(null); // Mux/HLS já tem imagem própria
  let p = cache.get(url);
  if (!p) {
    p = slot(() => grab(url));
    cache.set(url, p);
  }
  return p;
}

/** Capa a mostrar num vídeo: a capa definida (`explicit`) ou, se não houver, o frame do meio. */
export function useVideoPoster(url: string | null | undefined, explicit?: string | null) {
  const [auto, setAuto] = useState<string | null>(null);
  useEffect(() => {
    setAuto(null);
    if (explicit || !url) return;
    let alive = true;
    videoPoster(url).then((u) => alive && setAuto(u));
    return () => {
      alive = false;
    };
  }, [url, explicit]);
  return explicit || auto || undefined;
}
