"use client";

// Mostra um PDF página a página (pdf.js, worker em /pdf.worker.min.mjs) e põe por cima de cada página uma camada
// (overlay) com o tamanho exato da página — onde o editor e a página de assinatura desenham os campos.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { resolveMedia } from "@/lib/media";

type Page = { w: number; h: number; url: string };

export function usePdfPages(src: string | null, scale = 1.6) {
  const [pages, setPages] = useState<Page[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!src) return;
    let alive = true;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const url = await resolveMedia(src);
        const pdf = await pdfjs.getDocument({ url }).promise;
        const out: Page[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
          out.push({ w: vp.width, h: vp.height, url: canvas.toDataURL("image/jpeg", 0.85) });
          if (alive && i === 1) setPages([...out]);
        }
        if (alive) setPages(out);
      } catch (e) {
        if (alive) setErr((e as Error).message || "pdf_error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [src, scale]);
  return { pages, err };
}

/** Páginas empilhadas; `overlay(i)` desenha a camada da página i (coordenadas em frações 0–1). */
export function PdfView({ src, overlay, onPageRef, className = "" }: { src: string | null; overlay?: (page: number) => ReactNode; onPageRef?: (page: number, el: HTMLDivElement | null) => void; className?: string }) {
  const { pages, err } = usePdfPages(src);
  if (err) return <p className="muted small pdf-err">{err}</p>;
  if (!pages) return <div className="pdf-load gh" />;
  return (
    <div className={`pdf ${className}`}>
      {pages.map((p, i) => (
        <div key={i} className="pdf-page" style={{ aspectRatio: `${p.w} / ${p.h}` }} ref={(el) => onPageRef?.(i, el)} data-page={i}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt={`page ${i + 1}`} draggable={false} />
          {overlay && <div className="pdf-ov">{overlay(i)}</div>}
        </div>
      ))}
    </div>
  );
}

/** Miniaturas das páginas (coluna direita do editor). */
export function PdfThumbs({ src, active, counts, onPick }: { src: string | null; active: number; counts: number[]; onPick: (i: number) => void }) {
  const { pages } = usePdfPages(src, 0.35);
  const ref = useRef<HTMLDivElement>(null);
  if (!pages) return <div className="gh" style={{ height: 160 }} />;
  return (
    <div className="pdf-thumbs" ref={ref}>
      {pages.map((p, i) => (
        <button key={i} className={`pdf-thumb ${active === i ? "on" : ""}`} onClick={() => onPick(i)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt="" style={{ aspectRatio: `${p.w} / ${p.h}` }} />
          {counts[i] > 0 && <span className="pdf-thumb-n">{counts[i]}</span>}
          <span className="mono small muted">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}
