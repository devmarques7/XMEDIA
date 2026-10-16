// Aparência da app (sistema de design configurável). Paleta padrão: preto, branco, cinza escuro e um único destaque
// laranja (#ff5a1f). Os nomes "tile-blue"/"tile-sand" ficam por compatibilidade = tile de destaque / tile de contraste.
// Paleta de cores por tema, tipografia (2 fontes:
// BioGrotesk para texto e Fragment Mono para etiquetas/números), cantos, intervalo da grelha e opções.
// Tudo é convertido em variáveis CSS (:root) — os componentes só usam tokens, nunca cores fixas.
// Funções puras (testadas em appearance.test.ts).

export const COLOR_TOKENS = [
  // base
  { k: "bg", group: "base" },
  { k: "panel", group: "base" },
  { k: "panel-2", group: "base" },
  { k: "line", group: "base" },
  { k: "dim", group: "base" },
  { k: "fg", group: "base" },
  { k: "muted", group: "base" },
  // marca e destaque
  { k: "accent", group: "brand" },
  { k: "accent-ink", group: "brand" },
  { k: "tile-blue", group: "brand" },
  { k: "tile-blue-ink", group: "brand" },
  { k: "tile-sand", group: "brand" },
  { k: "tile-sand-ink", group: "brand" },
  // estados
  { k: "ok", group: "state" },
  { k: "warn", group: "state" },
  { k: "danger", group: "state" },
  { k: "live", group: "state" },
  // tipos de conteúdo
  { k: "ty-reel", group: "content" },
  { k: "ty-post", group: "content" },
  { k: "ty-carousel", group: "content" },
  { k: "ty-story", group: "content" },
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number]["k"];
export type Palette = Record<ColorToken, string>;
export const COLOR_GROUPS = ["base", "brand", "state", "content"] as const;

export type FontFile = { weight: number; url: string; name?: string };
export type Appearance = {
  version: 1;
  dark: Palette;
  light: Palette;
  fonts: {
    sans: { family: string; files: FontFile[]; fallback: string };
    mono: { family: string; files: FontFile[]; fallback: string };
  };
  /** Números grandes dos tiles: "mono" (Fragment Mono) ou "sans" (BioGrotesk). */
  numbers: "mono" | "sans";
  radius: number; // px
  gap: number; // px, intervalo entre tiles
  defaultTheme: "dark" | "light";
  /** Títulos de página em maiúsculas. */
  uppercaseTitles: boolean;
};

export const DEFAULT_DARK: Palette = {
  bg: "#0b0b0c",
  panel: "#1a1a1c",
  "panel-2": "#242427",
  line: "#2c2c30",
  dim: "#38383d",
  fg: "#f4f4f2",
  muted: "#8a8a88",
  accent: "#ff5a1f",
  "accent-ink": "#0b0b0c",
  "tile-blue": "#ff5a1f",
  "tile-blue-ink": "#0b0b0c",
  "tile-sand": "#f4f4f2",
  "tile-sand-ink": "#0b0b0c",
  ok: "#f4f4f2",
  warn: "#ff9a6b",
  danger: "#ff5a1f",
  live: "#ff5a1f",
  "ty-reel": "#ff5a1f",
  "ty-post": "#f4f4f2",
  "ty-carousel": "#8a8a88",
  "ty-story": "#ffb08c",
};
export const DEFAULT_LIGHT: Palette = {
  bg: "#ececea",
  panel: "#ffffff",
  "panel-2": "#f4f4f2",
  line: "#dcdcd8",
  dim: "#d2d2ce",
  fg: "#0b0b0c",
  muted: "#77777a",
  accent: "#ff5a1f",
  "accent-ink": "#0b0b0c",
  "tile-blue": "#ff5a1f",
  "tile-blue-ink": "#0b0b0c",
  "tile-sand": "#1a1a1c",
  "tile-sand-ink": "#f4f4f2",
  ok: "#0b0b0c",
  warn: "#c2410c",
  danger: "#e5480f",
  live: "#ff5a1f",
  "ty-reel": "#ff5a1f",
  "ty-post": "#0b0b0c",
  "ty-carousel": "#8a8a88",
  "ty-story": "#ffb08c",
};

export const DEFAULT_APPEARANCE: Appearance = {
  version: 1,
  dark: DEFAULT_DARK,
  light: DEFAULT_LIGHT,
  fonts: {
    sans: { family: "BioGrotesk", files: [], fallback: "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif" },
    // Fragment Mono vem do Google Fonts (next/font) como --font-fragment; ficheiros próprios substituem-no
    mono: { family: "Fragment Mono", files: [], fallback: "ui-monospace, 'SF Mono', Menlo, monospace" },
  },
  numbers: "mono",
  radius: 4,
  gap: 12,
  defaultTheme: "dark",
  uppercaseTitles: true,
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const clampN = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
};
const famRe = /^[\w .-]{1,60}$/;
const safeUrl = (u: unknown) => {
  const s = String(u ?? "");
  return /^(https:\/\/|data:font\/|data:application\/(font|x-font|octet-stream)|\/fonts\/)/.test(s) && !/[\s"'()<>]/.test(s.slice(0, 2000).replace(/^data:[^,]*,/, "")) ? s : "";
};

function palette(x: unknown, d: Palette): Palette {
  const o = (x ?? {}) as Record<string, unknown>;
  const p = { ...d };
  for (const { k } of COLOR_TOKENS) if (typeof o[k] === "string" && HEX.test(o[k] as string)) p[k] = (o[k] as string).toLowerCase();
  return p;
}
function font(x: unknown, d: Appearance["fonts"]["sans"]) {
  const o = (x ?? {}) as Record<string, unknown>;
  const files = (Array.isArray(o.files) ? o.files : [])
    .map((f) => ({ weight: clampN((f as FontFile).weight, 100, 900, 400), url: safeUrl((f as FontFile).url), name: String((f as FontFile).name ?? "").slice(0, 80) }))
    .filter((f) => f.url)
    .slice(0, 6);
  return {
    family: typeof o.family === "string" && famRe.test(o.family) ? o.family : d.family,
    files,
    fallback: typeof o.fallback === "string" && /^[\w ,'".-]{1,160}$/.test(o.fallback) ? o.fallback : d.fallback,
  };
}

export function normalizeAppearance(x: unknown): Appearance {
  const o = (x ?? {}) as Partial<Appearance>;
  const d = DEFAULT_APPEARANCE;
  return {
    version: 1,
    dark: palette(o.dark, d.dark),
    light: palette(o.light, d.light),
    fonts: { sans: font(o.fonts?.sans, d.fonts.sans), mono: font(o.fonts?.mono, d.fonts.mono) },
    numbers: o.numbers === "sans" ? "sans" : "mono",
    radius: clampN(o.radius, 0, 24, d.radius),
    gap: clampN(o.gap, 4, 32, d.gap),
    defaultTheme: o.defaultTheme === "light" ? "light" : "dark",
    uppercaseTitles: o.uppercaseTitles !== false,
  };
}

const vars = (p: Palette) => COLOR_TOKENS.map(({ k }) => `--${k}:${p[k]};`).join("");
const q = (s: string) => `'${s.replace(/'/g, "")}'`;

/** CSS com @font-face, variáveis dos dois temas e opções. Injetado em <style id="xm-appearance">. */
export function appearanceCss(a: Appearance) {
  const faces = (["sans", "mono"] as const)
    .flatMap((k) =>
      a.fonts[k].files.map((f) => `@font-face{font-family:${q(a.fonts[k].family)};src:url("${f.url}");font-weight:${f.weight};font-style:normal;font-display:swap;}`)
    )
    .join("");
  const sans = `${q(a.fonts.sans.family)},${a.fonts.sans.fallback}`;
  // sem ficheiros próprios, a mono é a Fragment Mono do Google Fonts (next/font)
  const mono = a.fonts.mono.files.length ? `${q(a.fonts.mono.family)},${a.fonts.mono.fallback}` : `var(--font-fragment),${q(a.fonts.mono.family)},${a.fonts.mono.fallback}`;
  return (
    faces +
    `html:root{--font-sans:${sans};--font-mono:${mono};--mono:var(--font-mono);--dotf:${a.numbers === "sans" ? "var(--font-sans)" : "var(--font-mono)"};--radius:${a.radius}px;--gap:${a.gap}px;--yellow:var(--warn);${vars(a.dark)}}` +
    `html:root[data-theme="light"]{${vars(a.light)}}` +
    (a.uppercaseTitles ? "" : `.pagehead .h1,.po-name,.tile-big{text-transform:none!important}`)
  );
}

export const APPEARANCE_LS = "xmedia:appearance";
