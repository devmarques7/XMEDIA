"use client";

// Definições → Armazenamento: onde ficam os vídeos e ficheiros grandes (Cloudflare R2 ou outro S3), teste da ligação,
// arquivo automático e espaço usado por cliente com o custo estimado. Sem configuração: guia passo a passo.
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { useT } from "@/lib/i18n";
import { isLocalMode } from "@/lib/store";

type Group = { group: string; label: string; bytes: number; files: number };
type State = { configured: boolean; provider?: string; r2?: boolean; publicHost?: string; groups?: Group[]; truncated?: boolean };
type Test = { write: boolean; public: boolean; cors: boolean; corsAuto: boolean; delete: boolean; error: string };

const GB = 1024 ** 3;
const size = (b: number) => (b >= 1024 ** 4 ? `${(b / 1024 ** 4).toFixed(2)} TB` : b >= GB ? `${(b / GB).toFixed(1)} GB` : `${(b / 1024 ** 2).toFixed(0)} MB`);
// Cloudflare R2: 10 GB grátis; Standard 0,015 $/GB; pouco frequente 0,01 $/GB; saída sempre grátis
const r2Cost = (bytes: number, ia = 0) => Math.max(0, bytes / GB - 10) * (0.015 * (1 - ia) + 0.01 * ia);
const ENV = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"];
const CORS = (origin: string) => JSON.stringify([{ AllowedOrigins: [origin], AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 }], null, 2);

async function api<T>(body?: unknown, qs = ""): Promise<T> {
  const r = await fetch(`/api/media/storage${qs}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `http_${r.status}`);
  return j as T;
}

export function StoragePanel() {
  const { t } = useT();
  const [s, setS] = useState<State | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [days, setDays] = useState("60");
  const [copied, setCopied] = useState("");
  const origin = typeof location !== "undefined" ? location.origin : "https://xmedia-studio.vercel.app";

  const load = (withUsage = false) => api<State>(undefined, withUsage ? "?usage=1" : "").then(setS).catch((e) => setMsg(e.message));
  useEffect(() => {
    if (!isLocalMode) load();
  }, []);
  const run = async (k: string, fn: () => Promise<unknown>) => {
    setBusy(k);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy("");
  };
  const copy = (k: string, v: string) => navigator.clipboard?.writeText(v).then(() => (setCopied(k), setTimeout(() => setCopied(""), 1500)));

  if (!isLocalMode && !s) return <p className="muted small">…</p>;

  if (isLocalMode || !s?.configured)
    return (
      <div className="stg stack" data-testid="storage-setup">
        <p className="small" style={{ margin: 0 }}>{t("stg.why")}</p>
        <ol className="stg-steps">
          <li>
            <b>{t("stg.s1")}</b> <a className="arrow small" href="https://dash.cloudflare.com/?to=/:account/r2/overview" target="_blank" rel="noreferrer">dash.cloudflare.com</a>
            <span className="muted small">{t("stg.s1h")}</span>
          </li>
          <li>
            <b>{t("stg.s2")}</b>
            <span className="muted small">{t("stg.s2h")}</span>
          </li>
          <li>
            <b>{t("stg.s3")}</b>
            <span className="muted small">{t("stg.s3h")}</span>
          </li>
          <li>
            <b>{t("stg.s4")}</b>
            <span className="stg-env">
              {ENV.map((k) => (
                <button key={k} className="chip mono" onClick={() => copy(k, k)} title={t("stg.copy")}>
                  {copied === k ? <Icon name="check" size={12} /> : <Icon name="copy" size={12} />} {k}
                </button>
              ))}
            </span>
            <span className="muted small">{t("stg.s4h")}</span>
          </li>
          <li>
            <b>{t("stg.s5")}</b>
            <span className="muted small">{t("stg.s5h")}</span>
          </li>
        </ol>
        <details className="stg-cors">
          <summary className="small">{t("stg.corsManual")}</summary>
          <pre className="mono small">{CORS(origin)}</pre>
          <button className="btn ghost small" onClick={() => copy("cors", CORS(origin))}>
            <Icon name={copied === "cors" ? "check" : "copy"} size={13} /> {t("stg.copy")}
          </button>
        </details>
        <p className="muted small" style={{ margin: 0 }}>{t("stg.other")}</p>
      </div>
    );

  const total = (s.groups ?? []).reduce((a, g) => a + g.bytes, 0);
  const max = Math.max(1, ...(s.groups ?? []).map((g) => g.bytes));
  const ok = (v: boolean) => <span className={`label ${v ? "tone-ok" : "tone-danger"}`}>{v ? <Icon name="check" size={12} /> : "✕"}</span>;

  return (
    <div className="stg stack" data-testid="storage">
      <div className="row between">
        <span className="row" style={{ gap: 8 }}>
          <Icon name="database" size={16} /> <b>{s.provider}</b> <span className="mono small muted">{s.publicHost}</span>
        </span>
        <span className="row" style={{ gap: 6 }}>
          <button className="btn small" disabled={!!busy} onClick={() => run("test", async () => setTest(await api<Test>({ action: "test" })))} data-testid="stg-test">
            <Icon name="zap" size={13} /> {busy === "test" ? "…" : t("stg.test")}
          </button>
          <button className="btn small ghost" disabled={!!busy} onClick={() => run("usage", () => load(true))} data-testid="stg-usage">
            <Icon name="chart" size={13} /> {busy === "usage" ? "…" : t("stg.usage")}
          </button>
        </span>
      </div>

      {test && (
        <div className="stg-test">
          <span className="row small" style={{ gap: 6 }}>{ok(test.write)} {t("stg.t.write")}</span>
          <span className="row small" style={{ gap: 6 }}>{ok(test.public)} {t("stg.t.public")}</span>
          <span className="row small" style={{ gap: 6 }}>{ok(test.cors)} {t("stg.t.cors")}</span>
          {!test.public && <p className="note small">{t("stg.fix.public")}</p>}
          {!test.cors && (
            <p className="note small">
              {t("stg.fix.cors")}{" "}
              <button className="btn ghost small" onClick={() => copy("cors2", CORS(origin))}>
                <Icon name={copied === "cors2" ? "check" : "copy"} size={13} /> {t("stg.copy")}
              </button>
            </p>
          )}
          {test.error && <p className="small tone-danger">{test.error}</p>}
        </div>
      )}

      <div className="stg-life">
        <span className="small">{t("stg.life")}</span>
        <Select className="select" value={days} onChange={(e) => setDays(e.target.value)} aria-label={t("stg.life")}>
          {["30", "60", "90", "180"].map((d) => (
            <option key={d} value={d}>
              {t("stg.days", { n: d })}
            </option>
          ))}
        </Select>
        <button
          className="btn small accent"
          disabled={!!busy}
          onClick={() =>
            run("life", async () => {
              const r = await api<{ archive: boolean }>({ action: "lifecycle", days: Number(days) });
              setMsg(r.archive ? t("stg.lifeOk", { n: days }) : t("stg.lifeCleanOnly"));
            })
          }
        >
          {busy === "life" ? "…" : t("stg.apply")}
        </button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>{t("stg.lifeHint")}</p>

      {s.groups && (
        <div className="stg-usage">
          <div className="row between">
            <span className="tile-t">{t("stg.used")}</span>
            <span className="small">
              <b>{size(total)}</b>
              {s.r2 && <span className="muted"> · {t("stg.cost", { a: r2Cost(total, 0.7).toFixed(2), b: r2Cost(total).toFixed(2) })}</span>}
            </span>
          </div>
          {!s.groups.length && <p className="muted small">{t("stg.empty")}</p>}
          <ul className="stg-list">
            {s.groups.map((g) => (
              <li key={g.group}>
                <span className="stg-name">{g.label}</span>
                <span className="stg-bar"><i style={{ width: `${(g.bytes / max) * 100}%` }} /></span>
                <span className="mono small">{size(g.bytes)}</span>
                <span className="mono small muted">{t("stg.files", { n: g.files })}</span>
              </li>
            ))}
          </ul>
          {s.truncated && <p className="muted small">{t("stg.truncated")}</p>}
          {s.r2 && <p className="muted small" style={{ margin: 0 }}>{t("stg.costHint")}</p>}
        </div>
      )}
      {msg && <p className="note small">{msg}</p>}
    </div>
  );
}
