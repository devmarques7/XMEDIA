"use client";

// Peças do layout bento: tile (título + número grande), barras, anel e o desenho de linhas do tile de destaque.
import Link from "next/link";
import { Icon } from "./Icon";

type TileProps = {
  title: React.ReactNode;
  value?: React.ReactNode;
  of?: React.ReactNode;
  tone?: "blue" | "sand";
  span?: number;
  tall?: boolean;
  href?: string;
  go?: boolean; // botão ↗ no canto
  className?: string;
  children?: React.ReactNode; // conteúdo entre o título e o número
  foot?: React.ReactNode; // linha separada em baixo
  small?: boolean;
  testid?: string;
  /** Tile inteiro clicável (abre a página daquele dado). */
  onClick?: () => void;
};

export function Tile({ title, value, of, tone, span, tall, href, go, className = "", children, foot, small, testid, onClick }: TileProps) {
  return (
    <div
      className={`w tile ${tone ?? ""} ${tall ? "tall" : ""} ${span ? `span-${span}` : ""} ${onClick ? "click" : ""} ${className}`}
      data-testid={testid}
      {...(onClick ? { role: "button", tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick()) } : {})}
    >
      <div className="tile-head">
        <span className="tile-t">{title}</span>
        {onClick ? (
          <GoArrow />
        ) : href && go ? (
          <Link href={href} className="tile-go" aria-label={typeof title === "string" ? title : "open"}>
            <Icon name="arrow" size={18} />
          </Link>
        ) : href ? (
          <Link href={href} className="tile-menu" aria-label={typeof title === "string" ? title : "open"}>
            <Icon name="more" size={16} />
          </Link>
        ) : null}
      </div>
      {children}
      {(value !== undefined || of) && (
        <div className="tile-foot">
          {value !== undefined && <span className={`tile-num ${small || String(value).length > 6 ? "sm" : ""}`}>{value}</span>}
          {of && <span className="tile-of">{of}</span>}
        </div>
      )}
      {foot && <div className="tile-sep">{foot}</div>}
    </div>
  );
}

/** Barras verticais; `on` = índice destacado (com etiqueta por cima). */
export function Bars({ values, labels, on, tip, small }: { values: number[]; labels?: string[]; on?: number; tip?: React.ReactNode; small?: boolean }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ minWidth: 0 }}>
      <div className={`bars ${small ? "sm" : ""}`} role="img" aria-label={values.join(", ")}>
        {values.map((v, i) => (
          <span key={i} className={`${i === on ? "on" : ""} ${v === 0 ? "zero" : ""}`} title={labels?.[i] ? `${labels[i]}: ${v}` : String(v)}>
            {i === on && tip && <em>{tip}</em>}
            <i style={{ height: `${Math.max(2, (v / max) * (tip ? 78 : 100))}%` }} />
          </span>
        ))}
      </div>
      {labels && !small && (
        <div className="bars-x" aria-hidden>
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Anel de progresso (0–1) com conteúdo ao centro. */
export function Ring({ value, children }: { value: number; children: React.ReactNode }) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle className="bg" cx="50" cy="50" r={r} />
        <circle className="fg" cx="50" cy="50" r={r} strokeDasharray={`${v * c} ${c}`} />
      </svg>
      <div>{children}</div>
    </div>
  );
}

/** Linhas finas (círculo + raios) do tile de destaque. */
export function TileLines() {
  return (
    <svg className="tile-lines" viewBox="0 0 200 150" fill="none" stroke="currentColor" strokeWidth="0.7" aria-hidden>
      <circle cx="150" cy="10" r="95" />
      <path d="M150 10V100M150 100L190 -20M150 100H260" />
    </svg>
  );
}

/** Pontos de paginação (decorativos ou clicáveis). */
export function Dots({ n, on, onPick }: { n: number; on: number; onPick?: (i: number) => void }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      {Array.from({ length: n }, (_, i) => (
        <button
          key={i}
          onClick={() => onPick?.(i)}
          aria-label={String(i + 1)}
          style={{ width: 8, height: 8, padding: 0, borderRadius: "50%", border: "1px solid currentColor", background: i === on ? "currentColor" : "transparent", cursor: onPick ? "pointer" : "default" }}
        />
      ))}
    </span>
  );
}

/** Seta ↗ (45°) no canto do tile: o tile inteiro é clicável e abre a página daquele dado. */
export function GoArrow({ extra }: { extra?: React.ReactNode }) {
  return (
    <span className="tile-head-r">
      {extra}
      <span className="tile-go" aria-hidden>
        <Icon name="arrow" size={18} />
      </span>
    </span>
  );
}
