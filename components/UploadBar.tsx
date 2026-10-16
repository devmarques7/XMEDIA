"use client";

// Barra de carregamento: percentagem, MB enviados, velocidade e tempo restante — para vídeos e imagens grandes.
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { useT } from "@/lib/i18n";

export type UploadState = { name: string; loaded: number; total: number; files: number; index: number; at: number; phase?: "optimize" } | null;

/** Hook: estado da barra + um onProgress por ficheiro (soma os envios em paralelo). */
export function useUploadProgress() {
  const [state, setState] = useState<UploadState>(null);
  const per = useRef<{ names: string[]; sizes: number[]; loaded: number[] }>({ names: [], sizes: [], loaded: [] });
  const start = (files: File[]) => {
    per.current = { names: files.map((f) => f.name), sizes: files.map((f) => f.size), loaded: files.map(() => 0) };
    setState({ name: files[0]?.name ?? "", loaded: 0, total: files.reduce((a, f) => a + f.size, 0), files: files.length, index: 0, at: Date.now() });
  };
  /** onProgress para o ficheiro i. */
  const progressFor = (i: number) => (p: { loaded: number; total?: number; phase?: "optimize" }) => {
    const r = per.current;
    if (p.phase === "optimize") {
      // vídeo a ser otimizado no browser antes do envio: a barra mostra a percentagem da conversão
      setState((s) => (s ? { ...s, name: r.names[i], loaded: p.loaded, total: p.total ?? 1000, phase: "optimize" } : s));
      return;
    }
    if (p.total) r.sizes[i] = p.total; // fotos reduzidas no browser: conta o tamanho realmente enviado
    r.loaded[i] = p.loaded;
    const sum = (a: number[]) => a.reduce((x, n) => x + n, 0);
    const doneN = r.sizes.filter((n, j) => r.loaded[j] >= n).length;
    // ao passar da otimização para o envio, o relógio recomeça (velocidade e tempo só do envio)
    setState((s) => (s ? { ...s, name: r.names[i], loaded: sum(r.loaded), total: sum(r.sizes), index: Math.min(doneN, r.names.length - 1), phase: undefined, at: s.phase ? Date.now() : s.at } : s));
  };
  const done = () => setState(null);
  return { state, start, progressFor, done };
}

const mb = (b: number) => (b / 1024 / 1024).toFixed(b > 100 * 1024 * 1024 ? 0 : 1);

export function UploadBar({ state }: { state: UploadState }) {
  const { t } = useT();
  const [now, setNow] = useState(Date.now());
  const active = !!state;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active]);
  if (!state) return null;
  const pct = state.total ? Math.min(100, Math.round((state.loaded / state.total) * 100)) : 0;
  const secs = Math.max(0.5, (Math.max(now, Date.now()) - state.at) / 1000);
  const speed = state.loaded / secs; // bytes/s
  const left = speed > 0 ? Math.max(0, Math.round((state.total - state.loaded) / speed)) : 0;
  // no primeiro segundo ainda não há velocidade fiável
  const leftTxt = pct >= 100 ? t("ub.finishing") : secs < 1.2 || !state.loaded ? t("ub.calc") : left >= 60 ? t("ub.minLeft", { n: Math.ceil(left / 60) }) : t("ub.secLeft", { n: left });
  return (
    <div className="ub" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} data-testid="upload-bar">
      <div className="ub-top">
        <span className="ub-name">
          <Icon name="upload" size={13} /> {state.name}
          {state.files > 1 && <span className="muted"> · {state.index + 1}/{state.files}</span>}
        </span>
        <b className="mono">{pct}%</b>
      </div>
      <div className="ub-track">
        <i style={{ width: `${pct}%` }} />
      </div>
      {state.phase === "optimize" ? (
        <div className="ub-meta mono small muted">
          <span>{t("ub.optimizing")}</span>
        </div>
      ) : (
      <div className="ub-meta mono small muted">
        <span>
          {mb(state.loaded)} / {mb(state.total)} MB · {(speed / 1024 / 1024).toFixed(1)} MB/s
        </span>
        <span>{leftTxt}</span>
      </div>
      )}
    </div>
  );
}
