"use client";

import { Icon } from "@/components/Icon";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { ITEMS_TEMPLATE, emptyInvoice, importJson, money, totals, type Invoice, type InvoiceItem } from "@/lib/invoice";
import { download } from "@/lib/io";

export type JsonResult = { items: InvoiceItem[]; patch: Partial<Invoice> };

const isJsonFile = (f: File) => f.type.includes("json") || /\.json$/i.test(f.name) || f.type === "text/plain";

/** Primeiro ficheiro JSON de um evento de drop (ou null). */
export async function jsonFromDrop(e: React.DragEvent | DragEvent): Promise<string | null> {
  const files = Array.from(e.dataTransfer?.files ?? []);
  const f = files.find(isJsonFile);
  if (f) return f.text();
  const text = e.dataTransfer?.getData("text/plain")?.trim() ?? "";
  return text.startsWith("{") || text.startsWith("[") ? text : null;
}

/** Overlay "largue aqui" que cobre a página inteira enquanto se arrasta um ficheiro. */
export function useWindowDrop(onText: (text: string) => void) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setOver(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setOver(false);
    };
    const overFn = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      // drops dentro de uma caixa JSON são tratados pela própria caixa
      if ((e.target as HTMLElement | null)?.closest?.("[data-jsonbox]")) return;
      const text = await jsonFromDrop(e);
      if (text) onText(text);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overFn);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overFn);
      window.removeEventListener("drop", drop);
    };
  }, [onText]);
  return over;
}

export function DropOverlay({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return (
    <div className="dropoverlay" aria-hidden>
      <div>
        <span className="dropicon">{"{ }"}</span>
        <span>{label}</span>
      </div>
    </div>
  );
}

/**
 * Caixa de JSON: escrever/colar, arrastar e largar ficheiro, ou escolher ficheiro.
 * Valida enquanto se escreve e mostra o resumo (itens, cliente, total) antes de aplicar.
 */
export function InvoiceJsonBox({
  initial = "",
  actions,
  onApply,
}: {
  initial?: string;
  actions: { label: string; mode: string; primary?: boolean }[];
  onApply: (r: JsonResult, mode: string) => void;
}) {
  const { t } = useT();
  const [text, setText] = useState(initial);
  const [dragging, setDragging] = useState(false);
  useEffect(() => setText(initial), [initial]);

  const parsed = useMemo(() => (text.trim() ? importJson(text) : null), [text]);
  const preview = useMemo(() => {
    if (!parsed?.items.length) return null;
    const base = emptyInvoice("", "2000-01-01");
    const inv = { ...base, ...parsed.patch, client: parsed.patch.client ?? base.client, items: parsed.items };
    return { t: totals(inv), inv };
  }, [parsed]);

  return (
    <div
      data-jsonbox
      className={`jsonbox stack ${dragging ? "drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragging(false);
        const txt = await jsonFromDrop(e);
        if (txt) setText(txt);
      }}
    >
      <div className="row between">
        <span className="label">{t("fin.jsonTitle")}</span>
        <span className="muted small">{t("fin.jsonDrop")}</span>
      </div>
      <span className="muted small">{t("fin.jsonHint")}</span>
      <textarea
        className="textarea mono"
        rows={9}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={ITEMS_TEMPLATE}
        spellCheck={false}
        aria-label={t("fin.jsonTitle")}
        data-testid="json-input"
        onKeyDown={(e) => {
          // Tab insere 2 espaços (escrever JSON à mão); Cmd/Ctrl+Enter aplica
          if (e.key === "Tab" && !e.shiftKey) {
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: a, selectionEnd: b } = el;
            const next = text.slice(0, a) + "  " + text.slice(b);
            setText(next);
            requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && preview) onApply(parsed!, actions[0].mode);
        }}
      />

      {parsed && (
        <div className={`jsonstatus ${parsed.errors.length ? (preview ? "warn" : "bad") : "ok"}`} data-testid="json-status">
          {preview && (
            <span>
              <Icon name="check" size={14} /> {parsed.items.length === 1 ? t("fin.jsonValid1") : t("fin.jsonValid", { n: parsed.items.length })}
              {preview.inv.client.name && ` · ${preview.inv.client.name}`} · {t("fin.total")} <b className="mono">{money(preview.t.total, preview.inv.currency)}</b>
              {preview.t.btw.label && <span className="muted"> ({preview.t.btw.label})</span>}
            </span>
          )}
          {parsed.errors.map((e) => (
            <span key={e}><Icon name="alert" size={14} /> {e}</span>
          ))}
        </div>
      )}

      <div className="row">
        {actions.map((a) => (
          <button key={a.mode} className={`btn ${a.primary ? "accent" : ""}`} disabled={!preview} onClick={() => onApply(parsed!, a.mode)}>
            {a.label}
          </button>
        ))}
        <label className="btn ghost">
          {t("fin.jsonFile")}
          <input
            type="file"
            accept=".json,application/json,text/plain"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await f.text());
              e.target.value = "";
            }}
          />
        </label>
        <button className="btn ghost" onClick={() => setText(ITEMS_TEMPLATE)}>
          {t("fin.jsonExample")}
        </button>
        <button className="btn ghost" onClick={() => download("xmedia-invoice-items.json", ITEMS_TEMPLATE, "application/json")}>
          <Icon name="download" size={14} /> {t("fin.jsonTemplate")}
        </button>
      </div>
    </div>
  );
}
