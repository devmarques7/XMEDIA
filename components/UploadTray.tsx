"use client";

// Painel de envios no canto inferior direito: todos os uploads em curso (de qualquer conteúdo), com barra, %,
// velocidade e tempo restante. Continua visível ao mudar de página; avisa antes de fechar a aba a meio de um envio.
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useT, type Key } from "@/lib/i18n";
import { dismissJob, useUploadJobs, type UploadJob } from "@/lib/uploadQueue";

const mb = (b: number) => (b / 1024 / 1024).toFixed(b > 100 * 1024 * 1024 ? 0 : 1);

/** Mensagem legível para os códigos de erro de envio. */
export function uploadErrorText(t: (k: Key, v?: Record<string, string | number>) => string, m: string) {
  if (m === "too_large") return t("up.tooLarge");
  if (m === "too_long_free") return t("up.tooLong");
  if (m === "optimize_stalled") return t("up.stalled");
  if (/^(mux|r2|s3|storage|upload|tus)_/.test(m)) return t("up.muxFail", { code: m });
  return m;
}

/** Uma linha de envio (usada no painel e dentro do editor do conteúdo). */
export function UploadJobRow({ j }: { j: UploadJob }) {
  const { t } = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (j.status !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [j.status]);
  const total = j.sizes.reduce((a, n) => a + n, 0);
  const loaded = j.loaded.reduce((a, n) => a + n, 0);
  const optimizing = j.phase === "optimize";
  const pct = j.status === "done" ? 100 : optimizing ? Math.round((j.optimize ?? 0) * 100) : total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  const secs = Math.max(0.5, (now - j.at) / 1000);
  const speed = loaded / secs;
  const left = speed > 0 ? Math.round((total - loaded) / speed) : 0;
  const status =
    j.status === "done"
      ? t("ut.done")
      : j.status === "error"
        ? uploadErrorText(t, j.error ?? "")
        : optimizing
          ? t("ub.optimizing")
          : secs < 1.2 || !loaded
            ? t("ub.calc")
            : pct >= 100
              ? t("ub.finishing")
              : `${mb(loaded)} / ${mb(total)} MB · ${(speed / 1048576).toFixed(1)} MB/s · ${left >= 60 ? t("ub.minLeft", { n: Math.ceil(left / 60) }) : t("ub.secLeft", { n: left })}`;
  return (
    <li className={`ut-row ${j.status}`} data-testid="ut-row">
      <div className="ut-top">
        <span className="ut-name">
          <Icon name={j.status === "done" ? "check" : j.status === "error" ? "alert" : "upload"} size={13} />
          <b>{j.label}</b>
          <span className="muted"> · {j.names.length > 1 ? t("ut.files", { n: j.names.length }) : j.names[0]}</span>
        </span>
        <span className="mono small">{pct}%</span>
        {j.status !== "running" && (
          <button className="iconbtn" onClick={() => dismissJob(j.id)} aria-label={t("ct.close")}>
            <Icon name="close" size={13} />
          </button>
        )}
      </div>
      <div className="ut-track">
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className={`ut-meta small ${j.status === "error" ? "tone-danger" : "muted"}`}>{status}</span>
    </li>
  );
}

export function UploadTray() {
  const { t } = useT();
  const jobs = useUploadJobs();
  const [open, setOpen] = useState(true);
  const running = jobs.filter((j) => j.status === "running").length;
  useEffect(() => {
    if (!running) return;
    // fechar a aba a meio interrompe os envios
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);
  if (!jobs.length) return null;
  return (
    <aside className="ut" aria-live="polite" data-testid="upload-tray">
      <button className="ut-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name="upload" size={14} />
        <b>{running ? t("ut.running", { n: running }) : t("ut.allDone")}</b>
        <Icon name="chevronDown" size={14} className={open ? "" : "ut-flip"} />
      </button>
      {open && (
        <ul className="ut-list">
          {jobs.map((j) => (
            <UploadJobRow key={j.id} j={j} />
          ))}
        </ul>
      )}
      {running > 0 && open && <p className="ut-hint small muted">{t("ut.hint")}</p>}
    </aside>
  );
}
