"use client";

// Validação do conteúdo pelo cliente, por tipo: cada critério ✓ (está bem) ou ✕ (ajustar). Um ✕ pede um comentário,
// que entra como item da checklist do editor (nota com o nome do critério).
import { Icon } from "@/components/Icon";
import { useState } from "react";
import type { ContentPost } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { validationState } from "@/lib/validation";

export function ValidationPanel({ post, canAct, onValidate, onNote }: { post: ContentPost; canAct: boolean; onValidate: (key: string, value: "ok" | "fix" | null) => Promise<void>; onNote: (text: string) => Promise<void> }) {
  const { t } = useT();
  const v = validationState(post);
  const [asking, setAsking] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="vl" data-tour="rv-check" data-testid="validation">
      <div className="row between">
        <span className="tile-t">{t("vl.title")}</span>
        <span className="mono small muted">
          <Icon name="check" size={14} /> {v.ok} · <Icon name="close" size={14} /> {v.fix} / {v.list.length}
        </span>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {t("vl.hint")}
      </p>
      <div className="vl-list">
        {v.list.map((k) => {
          const val = post.validation?.[k];
          const label = t(`vl.c.${k}` as Key);
          return (
            <div key={k} className={`vl-row ${val ?? ""}`}>
              <span>{label}</span>
              <span className="row" style={{ gap: 4 }}>
                <button className={`vl-btn ok ${val === "ok" ? "on" : ""}`} disabled={!canAct || busy} onClick={() => run(() => onValidate(k, val === "ok" ? null : "ok"))} aria-label={`${label} ✓`} data-testid={`vl-ok-${k}`}>
                  <Icon name="check" size={14} />
                </button>
                <button className={`vl-btn fix ${val === "fix" ? "on" : ""}`} disabled={!canAct || busy} onClick={() => (val === "fix" ? run(() => onValidate(k, null)) : setAsking(k))} aria-label={`${label} ✕`} data-testid={`vl-fix-${k}`}>
                  <Icon name="close" size={14} />
                </button>
              </span>
              {asking === k && (
                <div className="vl-ask">
                  <input className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t("vl.fixPh", { c: label })} onKeyDown={(e) => e.key === "Enter" && text.trim() && document.getElementById(`vl-send-${k}`)?.click()} />
                  <button
                    id={`vl-send-${k}`}
                    className="btn small accent"
                    disabled={busy || !text.trim()}
                    onClick={() =>
                      run(async () => {
                        await onNote(`[${label}] ${text.trim()}`);
                        await onValidate(k, "fix");
                        setAsking(null);
                        setText("");
                      })
                    }
                  >
                    {t("rv.add")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
