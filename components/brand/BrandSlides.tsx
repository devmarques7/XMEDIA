"use client";

// Brand book em slides 1920×1080 (estilo editorial das referências: números grandes, réguas finas, laranja, preto,
// branco e cinzas). As mesmas peças servem para a pré-visualização ao vivo e para o PDF (mesmo modelo das propostas).
import { Icon } from "@/components/Icon";
import { useEffect } from "react";
import { BRAND_STEPS, googleFontsUrl, hexToCmyk, hexToRgb, inkOn, type BrandIdentity, type BrandStep } from "@/lib/brand";
import { useMediaSrc } from "@/lib/media";

export const BRAND_SLIDES = ["cover", "essence", "logo", "palette", "stripes", "type", "persona", "voice", "imagery"] as const;
export type BrandSlideKey = (typeof BRAND_SLIDES)[number];
/** Que slides cada passo do formulário preenche (para destacar na pré-visualização). */
export const STEP_SLIDES: Record<BrandStep, BrandSlideKey[]> = {
  essence: ["cover", "essence"],
  logo: ["logo"],
  colors: ["palette", "stripes"],
  type: ["type"],
  persona: ["persona"],
  voice: ["voice"],
  imagery: ["imagery"],
  review: [...BRAND_SLIDES],
};
void BRAND_STEPS;

/** Carrega as fontes escolhidas (Google Fonts) uma vez por família. */
export function useBrandFonts(b: BrandIdentity) {
  const href = googleFontsUrl([b.fonts.primary.family, b.fonts.secondary.family]);
  useEffect(() => {
    if (!href || document.querySelector(`link[data-brandfont="${href}"]`)) return;
    const l = Object.assign(document.createElement("link"), { rel: "stylesheet", href });
    l.dataset.brandfont = href;
    document.head.appendChild(l);
  }, [href]);
}

type P = { b: BrandIdentity; year?: string };
const ORANGE = "#ff5a1f";

function Img({ src, className = "", style }: { src: string; className?: string; style?: React.CSSProperties }) {
  const url = useMediaSrc(src);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className={className} style={style} /> : <span className={`bb-ph ${className}`} style={style} />;
}

function Frame({ b, bg, fg, n, title, children, year }: P & { bg: string; fg: string; n?: string; title?: string; children?: React.ReactNode }) {
  const pri = `'${b.fonts.primary.family}', 'Helvetica Neue', Arial, sans-serif`;
  const sec = `'${b.fonts.secondary.family}', ui-monospace, monospace`;
  return (
    <div className="bb" style={{ background: bg, color: fg, fontFamily: pri, ["--bb-sec" as string]: sec, ["--bb-line" as string]: `color-mix(in srgb, ${fg} 22%, transparent)` }}>
      <header className="bb-top">
        <span>
          XMEDIA®
          <br />
          Brand Book
          <br />© {year ?? new Date().getFullYear()}
        </span>
        <span>
          {b.name || "Brand"}
          <br />
          {b.tagline ? b.tagline.slice(0, 40) : "Identity guidelines"}
        </span>
        <i className="bb-dot" />
      </header>
      {title && (
        <h2 className="bb-h">
          {n && <span className="bb-n">{n}</span>}
          <span>{title}</span>
        </h2>
      )}
      {children}
    </div>
  );
}

const lines = (s: string) => s.split(/\n+/).map((x) => x.trim()).filter(Boolean);
const Details = ({ title, items }: { title: string; items: string[] }) =>
  items.length ? (
    <div className="bb-details">
      <span className="bb-mini"><Icon name="download" size={14} /> {title}</span>
      {items.map((x, i) => (
        <span key={i} className="bb-li">
          • {x}
        </span>
      ))}
    </div>
  ) : null;

export function BrandSlide({ k, b, year }: { k: BrandSlideKey } & P) {
  const primary = b.colors.find((c) => c.role === "primary")?.hex ?? ORANGE;
  const ink = inkOn(primary);
  switch (k) {
    case "cover":
      return (
        <Frame b={b} year={year} bg={primary} fg={ink}>
          <div className="bb-cover">
            <span className="bb-big">1.0</span>
            <span className="bb-big">{(b.name || "BRAND").toUpperCase()}</span>
            <div className="bb-cover-row">
              <p className="bb-p">{b.about ? b.about.slice(0, 320) : "This brand book defines the essence, logo, colour, typography, persona and voice — so every touchpoint stays clear, recognisable and consistent."}</p>
              <ol className="bb-index">
                {["Essence", "Logo", "Palette", "Colour", "Typography", "Persona", "Voice", "Imagery"].map((x, i) => (
                  <li key={x}>
                    <span>{`${Math.floor(i / 2) + 1}.${i % 2}`}</span> {x}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Frame>
      );
    case "essence":
      return (
        <Frame b={b} year={year} bg="#f4f4f2" fg="#111" n="1.1" title="ESSENCE">
          <div className="bb-2col">
            <div>
              <span className="bb-mini">Tagline</span>
              <p className="bb-lead">{b.tagline || "—"}</p>
            </div>
            <div>
              <p className="bb-p">{b.about || "Who the brand is, what it stands for and why it exists."}</p>
              <div className="bb-tags">
                {(b.keywords.length ? b.keywords : ["Keyword"]).map((w) => (
                  <span key={w} style={{ borderColor: "#111" }}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Frame>
      );
    case "logo":
      return (
        <Frame b={b} year={year} bg="#1b1b1d" fg="#f4f4f2" n="1.2" title="LOGO">
          <div className="bb-2col">
            <div className="bb-logo">
              {b.logo.primary ? <Img src={b.logo.primary} className="bb-logo-img" /> : <span className="bb-big" style={{ fontSize: 150 }}>{(b.name || "BRAND").toUpperCase()}</span>}
              {b.logo.mark && <Img src={b.logo.mark} className="bb-mark" />}
            </div>
            <div>
              <p className="bb-p">The logo system is the foundation of the identity. Use the approved files only and keep alignment, clear space and proportions.</p>
              <Details title="Usage" items={lines(b.logo.notes).length ? lines(b.logo.notes) : ["Do not alter typeface or scale", "Keep clear space around the logo", "Use only approved colour versions"]} />
            </div>
          </div>
        </Frame>
      );
    case "palette": {
      const rows = (["primary", "secondary", "neutral"] as const).map((r) => ({ r, list: b.colors.filter((c) => c.role === r) }));
      return (
        <Frame b={b} year={year} bg="#fff" fg="#111" n="2.1" title="PALETTE">
          <div className="bb-pal">
            {rows.map(({ r, list }) => (
              <div key={r} className="bb-pal-row">
                <span className="bb-mini">{r.toUpperCase()}</span>
                <div className="bb-circles">
                  {list.map((c) => (
                    <span key={c.hex + c.name} className="bb-circle-wrap">
                      <i className="bb-circle" style={{ background: c.hex }} />
                      <span className="bb-mini">
                        {c.name}
                        <br />
                        {c.hex.toUpperCase()}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Frame>
      );
    }
    case "stripes":
      return (
        <Frame b={b} year={year} bg="#fff" fg="#111" n="2.2" title="COLOR">
          <div className="bb-stripes">
            {b.colors.slice(0, 6).map((c, i) => {
              const [r, g, bl] = hexToRgb(c.hex);
              const [cc, m, y, kk] = hexToCmyk(c.hex);
              return (
                <div key={i} className="bb-stripe" style={{ background: c.hex, color: inkOn(c.hex) }}>
                  <span className="bb-stripe-l">{String.fromCharCode(65 + i)}</span>
                  <span className="bb-stripe-l">{String(i + 1).padStart(2, "0")}</span>
                  <span className="bb-mini">{c.name}</span>
                  <span className="bb-mini">
                    CMYK C{cc} M{m} Y{y} K{kk}
                  </span>
                  <span className="bb-mini">
                    RGB {r} {g} {bl}
                  </span>
                  <span className="bb-mini">HEX {c.hex.toUpperCase()}</span>
                </div>
              );
            })}
          </div>
        </Frame>
      );
    case "type":
      return (
        <Frame b={b} year={year} bg="#1b1b1d" fg="#f4f4f2" n="3.1" title="TYPEFACE">
          <div className="bb-2col">
            <div className="bb-type-sq" style={{ background: primary, color: ink, fontFamily: `'${b.fonts.primary.family}', sans-serif` }}>
              Aa
            </div>
            <div className="bb-type">
              <span className="bb-mini">Main · {b.fonts.primary.usage}</span>
              <p style={{ fontFamily: `'${b.fonts.primary.family}', sans-serif`, fontSize: 64, margin: "10px 0 6px", lineHeight: 1 }}>{b.fonts.primary.family}</p>
              <p style={{ fontFamily: `'${b.fonts.primary.family}', sans-serif`, fontSize: 30, margin: 0, opacity: 0.85 }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</p>
              <span className="bb-mini">Weights · {b.fonts.primary.weights.join(" / ")}</span>
              <div className="bb-rule" />
              <span className="bb-mini">Secondary · {b.fonts.secondary.usage}</span>
              <p style={{ fontFamily: `'${b.fonts.secondary.family}', monospace`, fontSize: 40, margin: "10px 0 6px" }}>{b.fonts.secondary.family}</p>
              <p style={{ fontFamily: `'${b.fonts.secondary.family}', monospace`, fontSize: 24, margin: 0, opacity: 0.85 }}>ABCDEFGHIJKLM 0123456789 € % # @</p>
            </div>
          </div>
        </Frame>
      );
    case "persona":
      return (
        <Frame b={b} year={year} bg="#b4b2a8" fg="#111" n="4.1" title="PERSONA">
          <div className="bb-2col">
            <div>
              <p className="bb-lead" style={{ fontSize: 72 }}>{b.persona.name || "Persona"}</p>
              <span className="bb-mini">
                {[b.persona.age, b.persona.role].filter(Boolean).join(" · ") || "Age · Role"}
              </span>
              {b.persona.quote && <p className="bb-quote">“{b.persona.quote}”</p>}
            </div>
            <div className="bb-fields">
              {(
                [
                  ["Goals", b.persona.goals],
                  ["Pains", b.persona.pains],
                  ["Channels", b.persona.channels],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <span className="bb-mini"><Icon name="download" size={14} /> {k}</span>
                  <p className="bb-p" style={{ fontSize: 26 }}>
                    {v || "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Frame>
      );
    case "voice":
      return (
        <Frame b={b} year={year} bg="#1b1b1d" fg="#f4f4f2" n="5.1" title="BRAND VOICE">
          <div className="bb-voice">
            {b.voice.map((p, i) => (
              <div key={i} className="bb-voice-row">
                <span className="bb-voice-n">{i + 1}</span>
                <span className="bb-voice-t">{(p.title || "—").toUpperCase()}</span>
                <Details title="Details" items={p.details} />
              </div>
            ))}
            {(b.dos.length > 0 || b.donts.length > 0) && (
              <div className="bb-dodont">
                <Details title="Do" items={b.dos} />
                <Details title="Avoid" items={b.donts} />
              </div>
            )}
          </div>
        </Frame>
      );
    case "imagery":
      return (
        <Frame b={b} year={year} bg="#fff" fg="#111" n="6.1" title="IMAGERY">
          <div className="bb-2col">
            <div className="bb-imgs">
              {(b.imagery.images.length ? b.imagery.images : ["", "", ""]).slice(0, 6).map((src, i) => (
                <Img key={i} src={src} className="bb-img" />
              ))}
            </div>
            <p className="bb-p">{b.imagery.notes || "Light, colour and framing that define the brand's images."}</p>
          </div>
        </Frame>
      );
  }
}
