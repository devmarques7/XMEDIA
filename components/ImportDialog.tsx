"use client";

import { Icon } from "@/components/Icon";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { baseName, mergeCSV, parseFile, type Issue, type Parsed } from "@/lib/io";
import { useT, type Key } from "@/lib/i18n";
import { store } from "@/lib/store";
import { emptyData } from "@/lib/types";

const ACCEPT = ".json,.csv,.ssv,.tsv,.txt,application/json,text/csv,text/plain";

/** Criar projeto a partir de JSON / CSV / SSV / TSV, com validação e templates para corrigir. */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fatal, setFatal] = useState("");
  const [name, setName] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  async function read(f: File) {
    setFatal("");
    setParsed(null);
    try {
      const p = parseFile(f.name, await f.text());
      setParsed(p);
      setName(p.kind === "json" ? p.title : baseName(f.name));
    } catch (e) {
      setFatal(t("err.json", { msg: (e as Error).message }));
    }
  }

  const issueText = (i: Issue) => {
    const msg =
      i.code === "missingCols"
        ? t("err.missingCols", { cols: i.v ?? "" })
        : i.code === "noRows"
          ? t("err.noRows")
          : t(`err.${i.code}` as Key, { v: i.v ?? "", col: i.col ?? "" });
    return i.row > 1 ? t("err.row", { n: i.row, msg }) : msg;
  };

  const blocking = parsed?.kind === "rows" && parsed.rows.length === 0;
  const ready = parsed && !blocking;

  async function create() {
    if (!parsed) return;
    setBusy(true);
    const defs = { format: t("def.format"), look: t("def.look"), gear: t("def.gear") };
    const title = name.trim() || t("newProjectTitle");
    const data = parsed.kind === "json" ? parsed.data : mergeCSV(emptyData(defs), parsed.rows).data;
    const p = await store.create(title, data);
    await store.snapshot(p.id, t("vs.imported", { fmt: parsed.kind === "json" ? "JSON" : parsed.format }));
    router.push(`/p/${p.id}?tab=cenas`);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog stack" role="dialog" aria-modal aria-label={t("import.title")} onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <span className="label">{t("import.title")}</span>
          <button className="btn ghost" onClick={onClose} aria-label={t("cancel")}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {t("import.hint")}
        </p>

        <div
          className={`drop ${over ? "over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) read(f);
          }}
        >
          <button className="btn solid" onClick={() => input.current?.click()}>
            {t("import.choose")}
          </button>
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            {t("import.drop")} · .json .csv .ssv .tsv
          </div>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            hidden
            data-testid="import-file"
            onChange={(e) => e.target.files?.[0] && read(e.target.files[0])}
          />
        </div>

        {fatal && <p className="tone-danger">{fatal}</p>}

        {parsed && (
          <div className="card stack" style={{ background: "var(--panel-2)" }}>
            <div className="row between">
              <span className="pill">{parsed.kind === "json" ? "JSON" : parsed.format}</span>
              <span className="mono" style={{ fontSize: 13 }} data-testid="import-summary">
                {parsed.kind === "json"
                  ? t("import.ok", { n: parsed.scenes })
                  : t("import.rows", { ok: parsed.rows.length, bad: parsed.total - parsed.rows.length })}
              </span>
            </div>
            {parsed.kind === "rows" && parsed.issues.length > 0 && (
              <ul className="mono" style={{ margin: 0, paddingLeft: 18, fontSize: 12, maxHeight: 160, overflow: "auto" }}>
                {parsed.issues.slice(0, 50).map((i, k) => (
                  <li key={k} className={blocking ? "tone-danger" : "tone-warn"}>
                    {issueText(i)}
                  </li>
                ))}
              </ul>
            )}
            {ready && (
              <label className="field">
                <span>{t("import.projectName")}</span>
                <input className="input big" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            )}
            {ready && (
              <div className="row">
                <button className="btn accent" disabled={busy} onClick={create}>
                  {parsed.kind === "rows" && parsed.issues.length ? t("import.goValid") : t("import.go")} <Icon name="arrow" size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="row between" style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
          <span className="label muted">{t("import.templates")}</span>
          <div className="row" style={{ gap: 8 }}>
            {["csv", "ssv", "json"].map((ext) => (
              <a key={ext} className="chip" href={`/templates/template.${ext}`} download={`template.${ext}`}>
                .{ext} <Icon name="download" size={14} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
