"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { ProposalDoc } from "@/lib/proposal";
import { SlideFrame, SlideView } from "./Slide";

/** Apresentação em ecrã inteiro: setas/teclado/deslizar; "PDF" imprime todos os slides em 1920×1080. */
export function Deck({ doc, title, actions }: { doc: ProposalDoc; title: string; actions?: React.ReactNode }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const n = doc.slides.length;
  const touch = useRef<number | null>(null);
  const go = useCallback((d: number) => setI((x) => Math.min(n - 1, Math.max(0, x + d))), [n]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) go(1);
      if (["ArrowLeft", "PageUp"].includes(e.key)) go(-1);
      if (e.key === "Home") setI(0);
      if (e.key === "End") setI(n - 1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [go, n]);

  return (
    <main className="deck">
      <div
        className="deck-stage"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        <div className="deck-fit">
          <SlideFrame>
            <SlideView slide={doc.slides[i]} doc={doc} mode="view" />
          </SlideFrame>
        </div>
      </div>
      <nav className="dk" aria-label="slides">
        <div className="dk-progress" aria-hidden>
          <span style={{ width: `${((i + 1) / n) * 100}%` }} />
        </div>
        <div className="dk-row">
          <div className="dk-title">
            <b>{title}</b>
          </div>
          <div className="dk-nav">
            <button className="dk-arrow" onClick={() => go(-1)} disabled={i === 0} aria-label={t("pr.view.prev")}>
              <Chevron dir="left" />
            </button>
            <span className="dk-count" aria-live="polite">
              <b>{String(i + 1).padStart(2, "0")}</b>
              <span>/ {String(n).padStart(2, "0")}</span>
            </span>
            <button className="dk-arrow" onClick={() => go(1)} disabled={i === n - 1} aria-label={t("pr.view.next")}>
              <Chevron dir="right" />
            </button>
          </div>
          <div className="dk-tools">
            <button className="dk-icon dk-fs" onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Fullscreen" title="Fullscreen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </button>
            <button className="dk-btn dk-ghost" onClick={() => window.print()} title={t("pr.printHint")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              <span>PDF</span>
            </button>
          </div>
          {actions && <div className="dk-actions">{actions}</div>}
        </div>
      </nav>
      <PrintAll doc={doc} />
    </main>
  );
}

/** Todos os slides em tamanho real, só visíveis na impressão (PDF vetorial). */
export function PrintAll({ doc }: { doc: ProposalDoc }) {
  return (
    <div className="print-all" aria-hidden>
      {doc.slides.map((s) => (
        <div key={s.id} className="print-page">
          <SlideView slide={s} doc={doc} mode="print" />
        </div>
      ))}
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}
