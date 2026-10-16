// Identidade visual do cliente (brand book): essência, logótipo, paleta, tipografia, persona, voz e imagens.
// Preenchida por passos no portal (ou pelo estúdio), mostrada como apresentação e exportada em PDF com o mesmo
// modelo das propostas. Funções puras (testadas em brand.test.ts).

export type BrandColor = { name: string; hex: string; role: "primary" | "secondary" | "neutral" };
export type BrandFont = { family: string; weights: number[]; usage: string };
export type BrandPillar = { title: string; details: string[] };

export type BrandIdentity = {
  updated_at: string;
  name: string;
  tagline: string;
  about: string; // essência / história
  keywords: string[];
  logo: { primary: string; mark: string; notes: string }; // urls das imagens
  colors: BrandColor[];
  fonts: { primary: BrandFont; secondary: BrandFont };
  persona: { name: string; age: string; role: string; goals: string; pains: string; channels: string; quote: string };
  voice: BrandPillar[];
  dos: string[];
  donts: string[];
  imagery: { notes: string; images: string[] };
};

/** Catálogo de fontes (Google Fonts) para escolher com pré-visualização; outras podem ser escritas à mão. */
export const FONT_CATALOG: { family: string; cat: "sans" | "serif" | "display" | "mono" | "script" }[] = [
  ...["Inter", "Inter Tight", "Manrope", "DM Sans", "Space Grotesk", "Work Sans", "Plus Jakarta Sans", "Outfit", "Sora", "Urbanist", "Figtree", "Onest", "Geist", "Archivo", "Barlow", "IBM Plex Sans", "Montserrat", "Poppins", "Raleway", "Rubik", "Karla", "Lexend", "Hanken Grotesk", "Schibsted Grotesk", "Bricolage Grotesque", "Familjen Grotesk", "Instrument Sans", "Albert Sans", "Red Hat Display", "Public Sans", "Mona Sans", "Hubot Sans", "Funnel Display", "Unbounded"].map((family) => ({ family, cat: "sans" as const })),
  ...["Playfair Display", "Cormorant Garamond", "DM Serif Display", "Fraunces", "Libre Caslon Text", "EB Garamond", "Instrument Serif", "Newsreader", "Lora", "Bodoni Moda", "Gloock", "Young Serif", "Crimson Pro", "Literata", "Spectral"].map((family) => ({ family, cat: "serif" as const })),
  ...["Anton", "Bebas Neue", "Archivo Black", "Syne", "Big Shoulders Display", "Climate Crisis", "Tanker", "Bowlby One", "Monoton", "Rubik Mono One"].map((family) => ({ family, cat: "display" as const })),
  ...["Fragment Mono", "JetBrains Mono", "IBM Plex Mono", "Space Mono", "DM Mono", "Geist Mono", "Martian Mono", "Azeret Mono"].map((family) => ({ family, cat: "mono" as const })),
  ...["Caveat", "Dancing Script", "Great Vibes", "Pinyon Script"].map((family) => ({ family, cat: "script" as const })),
];

/** URL do Google Fonts para carregar as famílias escolhidas (só as do catálogo). */
export function googleFontsUrl(families: string[]) {
  const known = [...new Set(families)].filter((f) => FONT_CATALOG.some((x) => x.family === f));
  if (!known.length) return "";
  return `https://fonts.googleapis.com/css2?${known.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;700`).join("&")}&display=swap`;
}

export const emptyBrand = (name = ""): BrandIdentity => ({
  updated_at: "",
  name,
  tagline: "",
  about: "",
  keywords: [],
  logo: { primary: "", mark: "", notes: "" },
  colors: [
    { name: "Primary", hex: "#ff5a1f", role: "primary" },
    { name: "Ink", hex: "#111111", role: "neutral" },
    { name: "Paper", hex: "#f4f4f2", role: "neutral" },
    { name: "Stone", hex: "#b4b2a8", role: "secondary" },
  ],
  fonts: { primary: { family: "Inter Tight", weights: [400, 700], usage: "Títulos e texto" }, secondary: { family: "Fragment Mono", weights: [400], usage: "Etiquetas e números" } },
  persona: { name: "", age: "", role: "", goals: "", pains: "", channels: "", quote: "" },
  voice: [
    { title: "Direto", details: [] },
    { title: "Considerado", details: [] },
    { title: "Moderno", details: [] },
  ],
  dos: [],
  donts: [],
  imagery: { notes: "", images: [] },
});

const str = (v: unknown, max = 400) => String(v ?? "").slice(0, max);
const list = (v: unknown, max = 12, len = 160) => (Array.isArray(v) ? v.map((x) => str(x, len).trim()).filter(Boolean).slice(0, max) : []);
const HEX = /^#[0-9a-f]{6}$/i;
const url = (v: unknown) => {
  const s = str(v, 2_000_000);
  return /^(https:\/\/|data:image\/|idb:)/.test(s) ? s : "";
};

export function normalizeBrand(x: unknown, name = ""): BrandIdentity {
  const o = (x ?? {}) as Partial<BrandIdentity>;
  const d = emptyBrand(name);
  const font = (f: unknown, df: BrandFont): BrandFont => {
    const v = (f ?? {}) as Partial<BrandFont>;
    return {
      family: /^[\w .'-]{1,60}$/.test(String(v.family ?? "")) ? String(v.family) : df.family,
      weights: (Array.isArray(v.weights) ? v.weights.map(Number).filter((w) => w >= 100 && w <= 900) : df.weights).slice(0, 6),
      usage: str(v.usage ?? df.usage, 120),
    };
  };
  return {
    updated_at: str(o.updated_at, 40),
    name: str(o.name ?? d.name, 80),
    tagline: str(o.tagline, 160),
    about: str(o.about, 1500),
    keywords: list(o.keywords, 10, 40),
    logo: { primary: url(o.logo?.primary), mark: url(o.logo?.mark), notes: str(o.logo?.notes, 600) },
    colors: (Array.isArray(o.colors) ? o.colors : d.colors)
      .map((c) => ({ name: str(c?.name, 40) || "Color", hex: HEX.test(String(c?.hex)) ? String(c.hex).toLowerCase() : "#000000", role: (["primary", "secondary", "neutral"].includes(c?.role as string) ? c.role : "secondary") as BrandColor["role"] }))
      .slice(0, 12),
    fonts: { primary: font(o.fonts?.primary, d.fonts.primary), secondary: font(o.fonts?.secondary, d.fonts.secondary) },
    persona: Object.fromEntries(Object.keys(d.persona).map((k) => [k, str((o.persona as Record<string, unknown> | undefined)?.[k], 400)])) as BrandIdentity["persona"],
    voice: (Array.isArray(o.voice) && o.voice.length ? o.voice : d.voice).slice(0, 5).map((p) => ({ title: str(p?.title, 40), details: list(p?.details, 6, 140) })),
    dos: list(o.dos),
    donts: list(o.donts),
    imagery: { notes: str(o.imagery?.notes, 800), images: (Array.isArray(o.imagery?.images) ? o.imagery!.images.map(url).filter(Boolean) : []).slice(0, 9) },
  };
}

/** Passos do preenchimento (o mesmo número das secções da apresentação). */
export const BRAND_STEPS = ["essence", "logo", "colors", "type", "persona", "voice", "imagery", "review"] as const;
export type BrandStep = (typeof BRAND_STEPS)[number];

/** % preenchido por secção e no total (para o portal e o resumo). */
export function brandProgress(b: BrandIdentity) {
  const parts: Record<Exclude<BrandStep, "review">, number> = {
    essence: [b.name, b.tagline, b.about, b.keywords.length].filter(Boolean).length / 4,
    logo: [b.logo.primary, b.logo.mark || b.logo.notes].filter(Boolean).length / 2,
    colors: Math.min(1, b.colors.length / 4) * (b.colors.some((c) => c.role === "primary") ? 1 : 0.5),
    type: [b.fonts.primary.family, b.fonts.secondary.family].filter(Boolean).length / 2,
    persona: Object.values(b.persona).filter(Boolean).length / 7,
    voice: b.voice.filter((p) => p.title && p.details.length).length / Math.max(1, b.voice.length),
    imagery: [b.imagery.notes, b.imagery.images.length].filter(Boolean).length / 2,
  };
  const total = Math.round((Object.values(parts).reduce((a, x) => a + x, 0) / Object.keys(parts).length) * 100);
  return { parts, total };
}

/** Contraste para texto sobre uma cor (preto ou branco). */
export function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111111" : "#f4f4f2";
}

export function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}
export function hexToCmyk(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return [0, 0, 0, 100];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100));
}
