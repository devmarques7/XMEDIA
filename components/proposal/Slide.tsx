"use client";

// Slides da proposta em 1920×1080 (como no Canva), escalados ao contentor.
// O mesmo componente serve o editor, o link partilhado e o PDF (impressão).
import { StreamVideo } from "@/components/StreamVideo";
import { Icon } from "@/components/Icon";
import { Fragment, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { useMediaSrc } from "@/lib/media";
import { parseMarks, videoEmbed, type Media, type ProposalDoc, type Slide } from "@/lib/proposal";

export type SlideMode = "edit" | "view" | "print";
const W = 1920;
const H = 1080;

/** Escala o slide 1920×1080 para a largura disponível. */
export function SlideFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={`slideframe ${className}`} style={{ aspectRatio: "16 / 9" }}>
      <div className="slidecanvas" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

/** Texto com *destaque*, **negrito** e quebras de linha. */
function Rich({ text, accent, bold }: { text: string; accent: string; bold?: string }) {
  return (
    <>
      {text.split("\n").map((line, li, all) => (
        <Fragment key={li}>
          {parseMarks(line).map((r, i) => (
            <span key={i} style={r.accent ? { color: accent } : r.bold ? { fontWeight: 700, color: bold } : undefined}>
              {r.text}
            </span>
          ))}
          {li < all.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

function Dots({ color, size = 34 }: { color: string; size?: number }) {
  const pts: [number, number][] = [[50, 10], [30, 16], [70, 16], [15, 30], [85, 30], [40, 33], [60, 33], [10, 50], [30, 50], [50, 50], [70, 50], [90, 50], [40, 67], [60, 67], [15, 70], [85, 70], [30, 85], [70, 85], [50, 90]];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={6} fill={color} />
      ))}
    </svg>
  );
}

function Header({ doc, color, dim }: { doc: ProposalDoc; color: string; dim: string }) {
  return (
    <>
      <div className="sl-head" style={{ color }}>
        <span>
          {doc.meta.brand}
          <br />
          {doc.meta.line2}
          <br />
          {doc.meta.year}
        </span>
        <span className="sl-fao">
          <i style={{ background: color }} /> FAO {doc.meta.fao}
        </span>
      </div>
      <div className="sl-dots">
        <Dots color={color} size={30} />
      </div>
      <div className="sl-label-dim" style={{ color: dim }} />
    </>
  );
}

function MediaBox({ m, mode, style }: { m?: Media; mode: SlideMode; style: React.CSSProperties }) {
  const url = useMediaSrc(m?.src);
  if (!m) return <div className="sl-media sl-media-empty" style={style} />;
  if (m.kind === "video") {
    const embed = videoEmbed(m.src);
    if (mode === "print")
      return (
        <div className="sl-media sl-media-video" style={style}>
          <span><Icon name="play" size={14} /> {m.caption || "Video"}</span>
        </div>
      );
    if (embed) return <iframe className="sl-media" style={style} src={embed} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={m.caption || "video"} />;
    return url ? <StreamVideo className="sl-media" style={style} src={url} controls playsInline preload="metadata" /> : <div className="sl-media sl-media-empty" style={style} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className="sl-media" style={style} src={url} alt={m.caption ?? ""} /> : <div className="sl-media sl-media-empty" style={style} />;
}

function Mark({ mark, color, accent }: { mark: string; color: string; accent: string }) {
  const r = mark.endsWith("®") ? mark.slice(0, -1) : mark;
  return (
    <div className="sl-mark" style={{ color }}>
      {r}
      {mark.endsWith("®") && <span style={{ color: accent }}>®</span>}
    </div>
  );
}

function Labels({ items, color, top }: { items: [number, string][]; color: string; top: number }) {
  return (
    <>
      {items.map(([left, t]) => (
        <span key={t + left} className="sl-tiny" style={{ position: "absolute", left, top, color }}>
          <Icon name="download" size={14} /> ({t})
        </span>
      ))}
    </>
  );
}

export function SlideView({ slide, doc, mode = "view" }: { slide: Slide; doc: ProposalDoc; mode?: SlideMode }) {
  const t = doc.theme;
  const white = "#FFFFFF";

  switch (slide.type) {
    case "cover":
      // capa "gradient": a mesma arte do login e do cabeçalho dos emails, com o logo XMEDIA
      if (slide.style === "gradient")
        return (
          <div className="sl sl-cover-g">
            <div className="sl-cg-grain" />
            <div className="sl-cg-brand">
              <Logo size={46} color="#fff" />
              <span>XMEDIA</span>
            </div>
            <div className="sl-cg-meta">
              <span>{doc.meta.brand}</span>
              <span>{doc.meta.fao}</span>
              <span>{doc.meta.year}</span>
            </div>
            <div className="sl-cg-body">
              {slide.kicker && <span className="sl-cg-kicker">{slide.kicker}</span>}
              {slide.title && <h1 className="sl-cg-title">{slide.title}</h1>}
              <p className="sl-cg-statement">{slide.statement}</p>
            </div>
            <span className="sl-cg-foot">MediaMarques · Brand Elevation Studio · Amsterdam</span>
          </div>
        );
      return (
        <div className="sl" style={{ background: t.dark }}>
          {slide.image && <MediaBox m={slide.image} mode={mode} style={{ position: "absolute", inset: 0, width: W, height: H }} />}
          <div className="sl-shade" />
          <Header doc={doc} color={white} dim={white} />
          <p className="sl-statement" style={{ color: white }}>
            {slide.statement}
          </p>
          <Mark mark={slide.mark} color={t.cream} accent={t.orange} />
        </div>
      );

    case "section":
      return (
        <div className="sl" style={{ background: t.orange, color: white }}>
          <Header doc={doc} color={white} dim={white} />
          <div className="sl-rule" style={{ top: 215, background: "rgba(255,255,255,.75)" }} />
          <h2 className="sl-sec-title">{slide.title}</h2>
          <p className="sl-sec-text">
            <Rich text={slide.text} accent={white} />
          </p>
          <div className="sl-sec-num" style={{ color: t.cream }}>
            {slide.number}
          </div>
        </div>
      );

    case "manifest":
      return (
        <div className="sl" style={{ background: t.dark, color: white }}>
          <Header doc={doc} color={white} dim={t.gray} />
          <div className="sl-rule" style={{ top: 215, background: "#3a3a3a" }} />
          <span className="sl-index" style={{ color: t.gray }}>
            {slide.index}
          </span>
          <h2 className="sl-manifest" style={{ color: t.gray }}>
            <Rich text={slide.headline} accent={t.orange} bold={white} />
          </h2>
          <div className="sl-rule" style={{ top: 615, background: "#3a3a3a" }} />
          <span className="sl-tiny" style={{ position: "absolute", left: 265, top: 585, color: t.gray }}>
            <Icon name="download" size={14} /> (What makes us)
          </span>
          <h3 className="sl-subtitle" style={{ left: 265, top: 650 }}>
            {slide.subtitle}
          </h3>
          <p className="sl-body" style={{ left: 265, top: 700, width: 780, color: "#d9d9d9" }}>
            <Rich text={slide.body} accent={t.orange} bold={white} />
          </p>
          <MediaBox m={slide.media} mode={mode} style={{ position: "absolute", left: 1180, top: 650, width: 700, height: 390 }} />
        </div>
      );

    case "case": {
      const media = slide.media.slice(0, 3);
      return (
        <div className="sl" style={{ background: t.dark, color: white }}>
          <Header doc={doc} color={white} dim={t.gray} />
          <div className="sl-rule" style={{ top: 215, background: "#3a3a3a" }} />
          <span className="sl-tiny" style={{ position: "absolute", left: 1215, top: 185, color: t.gray }}>
            <Icon name="download" size={14} /> (Image Description / Credit)
          </span>
          <span className="sl-index" style={{ color: t.gray }}>
            {slide.index}
          </span>
          <h2 className="sl-title" style={{ left: 265, top: 225 }}>
            {slide.title}
          </h2>
          <div className="sl-title" style={{ left: 265, top: 300, color: t.gray }}>
            {slide.meta}
          </div>
          <span className="sl-tiny" style={{ position: "absolute", left: 265, top: 500, color: t.gray }}>
            (Overview)
          </span>
          <p className="sl-small" style={{ left: 500, top: 495, width: 600 }}>
            <Rich text={slide.overview} accent={t.orange} bold={white} />
          </p>
          {slide.credits && (
            <>
              <span className="sl-tiny" style={{ position: "absolute", left: 265, top: 760, color: t.gray }}>
                (Credits)
              </span>
              <p className="sl-small" style={{ left: 500, top: 755, width: 600, color: "#cfcfcf" }}>
                <Rich text={slide.credits} accent={t.orange} />
              </p>
            </>
          )}
          {(media.length ? media : [undefined, undefined, undefined]).map((m, i, all) => {
            const h = Math.floor((830 - (all.length - 1) * 22) / all.length);
            return <MediaBox key={i} m={m} mode={mode} style={{ position: "absolute", left: 1215, top: 235 + i * (h + 22), width: 670, height: h }} />;
          })}
        </div>
      );
    }

    case "gallery": {
      const m = slide.media;
      return (
        <div className="sl" style={{ background: t.dark, color: white }}>
          <Header doc={doc} color={white} dim={t.gray} />
          <div className="sl-rule" style={{ top: 215, background: "#3a3a3a" }} />
          <span className="sl-index" style={{ color: t.gray }}>
            {slide.index}
          </span>
          <h2 className="sl-title" style={{ left: 265, top: 225 }}>
            {slide.title}
          </h2>
          <div className="sl-title" style={{ left: 265, top: 300, color: t.gray }}>
            {slide.meta}
          </div>
          <div className="sl-rule" style={{ top: 420, background: "#3a3a3a" }} />
          <MediaBox m={m[0]} mode={mode} style={{ position: "absolute", left: 30, top: 470, width: 780, height: 570 }} />
          {[1, 2, 3].map((i) => (
            <MediaBox key={i} m={m[i]} mode={mode} style={{ position: "absolute", left: 840 + (i - 1) * 355, top: 470, width: 330, height: 570 }} />
          ))}
        </div>
      );
    }

    case "list": {
      const dark = slide.tone === "dark";
      const bg = dark ? t.dark : t.paper;
      const fg = dark ? white : t.ink;
      const line = dark ? "#3a3a3a" : "#d6d3cd";
      const top = 450;
      const rowH = Math.floor((1050 - top) / Math.max(1, slide.rows.length));
      const long = slide.rows.some((r) => r.name.length > 16);
      const nameSize = long ? Math.min(62, rowH * 0.42) : Math.min(140, rowH * 0.9);
      return (
        <div className="sl" style={{ background: bg, color: fg }}>
          <Header doc={doc} color={fg} dim={t.gray} />
          <div className="sl-rule" style={{ top: 215, background: line }} />
          <span className="sl-index" style={{ color: dark ? t.gray : "#cfcac2" }}>
            {slide.index}
          </span>
          <h2 className="sl-title" style={{ left: 265, top: 225 }}>
            {slide.title}
          </h2>
          <Labels items={[[30, "Stage"], [265, "Name"], [1400, "Includes"]]} color={t.gray} top={top - 40} />
          {slide.rows.map((r, i) => (
            <div key={i} className="sl-row" style={{ top: top + i * rowH, height: rowH, borderTopColor: line }}>
              <span className="sl-row-n" style={{ fontSize: Math.min(140, rowH * 0.9), color: dark ? t.gray : "#e2ded7" }}>
                {r.n}
              </span>
              <span className="sl-row-name" style={{ fontSize: nameSize }}>
                {r.name}
              </span>
              <p className="sl-row-text">
                <Rich text={r.text} accent={t.orange} bold={fg} />
              </p>
            </div>
          ))}
        </div>
      );
    }

    case "cycle": {
      const n = Math.max(1, slide.steps.length);
      const colW = Math.floor((1890 - 265 - (n - 1) * 20) / n);
      return (
        <div className="sl" style={{ background: t.dark, color: white }}>
          <Header doc={doc} color={white} dim={t.gray} />
          <div className="sl-rule" style={{ top: 215, background: "#3a3a3a" }} />
          <span className="sl-index" style={{ color: t.gray }}>
            {slide.index}
          </span>
          <h2 className="sl-manifest" style={{ color: white, fontSize: 58 }}>
            <Rich text={slide.title} accent={t.gray} bold={white} />
          </h2>
          <div className="sl-rule" style={{ top: 470, background: "#3a3a3a" }} />
          <span className="sl-title" style={{ left: 30, top: 520, color: t.gray, fontSize: 52 }}>
            Cycle
          </span>
          {slide.steps.map((s, i) => (
            <div key={i} style={{ position: "absolute", left: 265 + i * (colW + 20), top: 440, width: colW }}>
              <span className="sl-tiny" style={{ color: t.gray }}>
                <Icon name="download" size={14} /> (What will be done)
              </span>
              <div className="sl-cycle-box" style={{ background: s.highlight ? t.orange : i % 2 ? t.cream : white, color: s.highlight ? white : t.ink }}>
                {s.days}
              </div>
              <div className="sl-cycle-name">{s.name}</div>
              <p className="sl-cycle-text">
                <Rich text={s.text} accent={t.orange} bold={white} />
              </p>
            </div>
          ))}
          <div className="sl-rule" style={{ top: 800, background: "#3a3a3a" }} />
          <p className="sl-small" style={{ left: 265, top: 830, width: 640 }}>
            <Rich text={slide.note} accent={t.orange} bold={white} />
          </p>
        </div>
      );
    }

    case "packages": {
      // 2 pacotes (ref. "4.1 Packages"): preço · recomendado · nome + descrição · incluídos numerados; imagem à direita
      const list = slide.packages.slice(0, 3);
      const n = Math.max(1, list.length);
      const top = 448;
      const rowH = Math.floor((1000 - top) / n);
      return (
        <div className="sl" style={{ background: t.paper, color: t.ink }}>
          <Header doc={doc} color={t.ink} dim={t.gray} />
          <div className="sl-rule" style={{ top: 205, background: "#c9c5be" }} />
          <span className="sl-tiny" style={{ position: "absolute", left: 1205, top: 176, color: t.gray }}>
            <Icon name="download" size={14} /> ({slide.media?.caption || "Image Description / Credit"})
          </span>
          <span className="sl-index" style={{ color: "#cfcac2" }}>
            {slide.index}
          </span>
          <h2 className="sl-title" style={{ left: 270, top: 225 }}>
            {slide.title}
          </h2>
          <Labels items={[[38, "Price"], [276, "Packages"], [733, "Included"]]} color={t.gray} top={top - 40} />
          {list.map((p, i) => (
            <div key={i} className={`sl-pkg${p.items.length > 5 ? " dense" : ""}`} style={{ top: top + i * rowH, height: rowH }}>
              <b className="sl-pkg-price">{p.price}</b>
              {p.recommended && (
                <span className="sl-pkg-rec" style={{ color: t.orange }}>
                  Recommended
                </span>
              )}
              <div className="sl-pkg-name">
                {p.name}
                <p>
                  <Rich text={p.description} accent={t.orange} bold={t.ink} />
                </p>
              </div>
              <ol className="sl-pkg-items">
                {p.items.slice(0, 6).map((it, k) => (
                  <li key={k}>
                    <span>{String(k + 1).padStart(2, "0")}</span>
                    <em>{it}</em>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {slide.note && (
            <p className="sl-pkg-note" style={{ color: t.gray }}>
              <Rich text={slide.note} accent={t.orange} bold={t.gray} />
            </p>
          )}
          {slide.media ? (
            <MediaBox m={slide.media} mode={mode} style={{ position: "absolute", left: 1205, top: 228, width: 685, height: 800, borderRadius: 14 }} />
          ) : (
            <div className="sl-pkg-ph" aria-label="image placeholder">
              <span>{doc.meta.brand}</span>
            </div>
          )}
        </div>
      );
    }

    case "closing":
      return (
        <div className="sl" style={{ background: t.dark, color: white }}>
          <Header doc={doc} color={white} dim={t.gray} />
          <span className="sl-tiny" style={{ position: "absolute", left: 30, top: 185, color: t.gray }}>
            <Icon name="download" size={14} /> (What&apos;s next)
          </span>
          <div className="sl-rule" style={{ top: 215, background: "#5a5a5a" }} />
          <p className="sl-closing">
            <Rich text={slide.text} accent={t.orange} bold={white} />
          </p>
          <Mark mark={slide.mark} color={t.cream} accent={t.orange} />
        </div>
      );
  }
}
