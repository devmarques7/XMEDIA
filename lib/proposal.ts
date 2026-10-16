// Propostas MediaMarques: documento de slides (réplica da apresentação "© MM/Proposta[2026]" do Canva)
// + dados de CRM (cliente, valor, fase). Funções puras: usadas no browser, no servidor e no MCP.

export const STAGES = ["lead", "diagnosis", "sent", "negotiation", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ["lead", "diagnosis", "sent", "negotiation"];

/** Media: URL (https, YouTube, Vimeo, Frame.io…) ou "idb:<id>" (ficheiro guardado neste browser). */
export type Media = { src: string; kind: "image" | "video"; caption?: string };

export type Row = { n: string; name: string; text: string };
export type CycleStep = { days: string; name: string; text: string; highlight?: boolean };
export type Package = { name: string; price: string; recommended?: boolean; description: string; items: string[] };

export type Slide =
  | { id: string; type: "cover"; statement: string; mark: string; image?: Media; style?: "classic" | "gradient"; title?: string; kicker?: string }
  | { id: string; type: "section"; number: string; title: string; text: string }
  | { id: string; type: "manifest"; index: string; headline: string; subtitle: string; body: string; media?: Media }
  | { id: string; type: "case"; index: string; title: string; meta: string; overview: string; credits: string; media: Media[] }
  | { id: string; type: "gallery"; index: string; title: string; meta: string; media: Media[] }
  | { id: string; type: "list"; index: string; title: string; tone: "dark" | "light"; rows: Row[] }
  | { id: string; type: "cycle"; index: string; title: string; steps: CycleStep[]; note: string }
  | { id: string; type: "packages"; index: string; title: string; packages: Package[]; note: string; media?: Media }
  | { id: string; type: "closing"; text: string; mark: string };

export type SlideType = Slide["type"];
export const SLIDE_TYPES: SlideType[] = ["cover", "section", "manifest", "case", "gallery", "list", "cycle", "packages", "closing"];

export type ProposalTheme = { orange: string; dark: string; cream: string; paper: string; ink: string; gray: string };
export const DEFAULT_THEME: ProposalTheme = { orange: "#FF4F2E", dark: "#1C1C1C", cream: "#ECE8E1", paper: "#F6F5F2", ink: "#111111", gray: "#7A7A7A" };

export type ProposalDoc = {
  meta: { brand: string; line2: string; year: string; fao: string };
  theme: ProposalTheme;
  slides: Slide[];
};

export type Proposal = {
  id: string;
  title: string;
  client: { name: string; company: string; email: string };
  value: number;
  currency: "EUR" | "GBP";
  stage: Stage;
  sent_at: string; // AAAA-MM-DD ou ""
  valid_until: string;
  notes: string;
  doc: ProposalDoc;
  /** Investimento ligado ao catálogo de serviços (produção → entregável → extras); gera os slides "inv-*". */
  pricing?: ProposalPricing;
  /** Propostas incluídas na app (criadas sem SQL): versão do conteúdo de origem. */
  bundle_version?: number;
  /** Data a reservar quando o cliente aprova (ex.: o dia do evento). */
  booking?: Booking;
  /** Decisão do cliente no link digital (aprovar / recusar). */
  decision?: Decision;
  created_at?: string;
  updated_at?: string;
};

export type Booking = { date: string; time?: string; place?: string };
/** Oferta "congelada" quando o investimento é aplicado: é o que o cliente escolhe no link digital. */
export type Offer = { packages: { name: string; subtotal: number; recommended?: boolean; items: string[] }[]; extras: { label: string; price: number }[]; btw_rate: number; deposit_pct: number; valid_until?: string };
export type Decision = {
  status: "approved" | "declined";
  at: string;
  name: string;
  email: string;
  package?: number;
  extras?: number[];
  note?: string;
  totals?: { subtotal: number; btw: number; total: number; deposit: number };
  emailed?: boolean;
};

export type PricingGroup = "production" | "deliverable" | "extra";
/** item = texto curto (maiúsculas) na coluna "Included" do slide de pacotes. */
export type PricingLine = { service_id: string; qty: number; group: PricingGroup; label?: string; note?: string; item?: string; price_override?: number | null };
/** Pacote = base (produção + entregável) + extras escolhidos (índices das linhas "extra"). */
export type PricingPackage = { name: string; description: string; extras: number[]; recommended?: boolean; items?: string[] };
export type ProposalPricing = {
  lines: PricingLine[];
  partner: boolean;
  recurring_months: number;
  rush: boolean;
  country: string;
  valid_until?: string;
  insert_after?: string;
  packages?: PricingPackage[];
  base_items?: string[]; // itens extra comuns a todos os pacotes (ex.: "UP TO 2 ROUNDS OF ADJUSTMENTS")
  image?: Media;
  note?: string;
  offer?: Offer;
};

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

/** Texto com ênfase: *palavra* → cor de destaque, **palavra** → negrito. */
export type Run = { text: string; accent?: boolean; bold?: boolean };
export function parseMarks(s: string): Run[] {
  const out: Run[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  for (const m of s.matchAll(re)) {
    if (m.index! > last) out.push({ text: s.slice(last, m.index) });
    const t = m[0];
    out.push(t.startsWith("**") ? { text: t.slice(2, -2), bold: true } : { text: t.slice(1, -1), accent: true });
    last = m.index! + t.length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

// ---------- template base (conteúdo e estrutura da apresentação MediaMarques no Canva) ----------
export function templateDoc(clientName = "Client"): ProposalDoc {
  return {
    meta: { brand: "Media Marques Films ©", line2: "Portfolio", year: "2026", fao: `[ ${clientName} Proposal ]` },
    theme: { ...DEFAULT_THEME },
    slides: [
      { id: uid(), type: "cover", statement: "Perceived value is not an accident— it is the intentional construction of every expression of the brand.", mark: "MM®" },
      { id: uid(), type: "section", number: "1", title: "Intro", text: "**Perceived value doesn't just happen. It is built.** — We work with brands that already have extraordinary quality — and still don't have the image it demands" },
      {
        id: uid(),
        type: "manifest",
        index: "1.1",
        headline: "*Manifest* — we **architect perception** through **strategic imagery**, precise **storytelling**, and elevated execution.",
        subtitle: "Why is simple to choose us",
        body: "**Our philosophy is simple** — perceived value is not an accident — it is the intentional construction of every expression of a brand.\n\nMany highly skilled **companies are perceived as “ordinary”** because **they allow the market to define their value**, instead of **leading that narrative** themselves.",
      },
      { id: uid(), type: "section", number: "2", title: "Cases", text: "Every **project is unique** — Every **story is personal** — Here’s how **we transform real moments into visual brand equities.**" },
      {
        id: uid(),
        type: "case",
        index: "2.1",
        title: "Carine Lopes / Hair Studio",
        meta: "2026 MOV",
        overview: "In this project we had the goal to show process and quality, with the most high quality in multiple deliverables.",
        credits: "Marques — Creative Director\nMarques — Color Grading\nMarques — Camera Operator\nMarques — Film Edit",
        media: [],
      },
      { id: uid(), type: "section", number: "3", title: "Timeline", text: "A seamless experience, crafted with intention. — From the first conversation to the final delivery, **every step of our process is designed to bring clarity, creativity, and confidence.**" },
      {
        id: uid(),
        type: "list",
        index: "3.1",
        title: "Where the cycle starts",
        tone: "dark",
        rows: [
          { n: "1", name: "First call", text: "We begin with a discovery conversation to understand your story, vision, and expectations.\n[ Initial alignment call — Needs & vision discovery — Project overview & guidance — Fit evaluation ]" },
          { n: "2", name: "Proposal", text: "We formalize everything with a tailored proposal aligned to your project.\n[ Customized proposal — Scope definition — Package selection — Booking confirmation & date reservation ]" },
          { n: "3", name: "Pre-prod", text: "We plan every detail to ensure a seamless and intentional production.\n[ Creative direction & storytelling — Schedule planning — Location scouting — Final scope approval ]" },
          { n: "4", name: "Production", text: "We capture your story naturally, following the agreed plan while staying unobtrusive." },
        ],
      },
      {
        id: uid(),
        type: "list",
        index: "3.2",
        title: "Where it ends",
        tone: "light",
        rows: [
          { n: "5", name: "Post-pro", text: "We transform the captured footage into a cinematic story.\n[ Video editing & narrative construction — Sound design & music — Cinematic color grading — Internal review ]\n*Timeline — [ 7–15 days ] depending on project scope*" },
          { n: "6", name: "Delivery", text: "Your final film is delivered in a polished, shareable format.\n[ Private online gallery — High-resolution files (HD/4K) — Download & sharing — Final handover ]" },
          { n: "7", name: "Feedback", text: "We believe your experience matters just as much as the final film. After delivery, we invite you to share your thoughts — not just as clients, but as part of the Media Family." },
        ],
      },
      {
        id: uid(),
        type: "cycle",
        index: "3.3",
        title: "The cycle — *because process consistency generates perception consistency.*",
        steps: [
          { days: "Day 1–3", name: "Clarity & organization", text: "We align strategy, narrative and brand objectives. Before any camera. → Delivery: strategic brief, brand narrative and cycle content plan." },
          { days: "Day 4–7", name: "Pre-production", text: "Locations, references, visual language, creative script. → Delivery: creative script, moodboard and approved visual direction." },
          { days: "Day 8–10", name: "Production", text: "Filming and photography following the approved plan. → Delivery: all raw material captured to brief." },
          { days: "Day 11–17", name: "Post-production", text: "Editing, color correction and image treatment that communicates your level. → Delivery: edited videos and treated images.", highlight: true },
          { days: "Day 18–20", name: "Delivery & feedback", text: "Joint review. Refinement. Assets ready to position your brand. → Delivery: final package of approved assets." },
        ],
        note: "Full cycle — 15 to 20 days. The remaining time of the month is not a pause — it is where we work on the next cycle's strategy.\n\nTogether we build. Month after month.",
      },
      { id: uid(), type: "section", number: "4", title: "Proposal", text: "**Content is more than something you watch** — Over time, meaningful content becomes one of the most valuable assets a brand can own. **“Price is what you pay. Value is what remains.”**" },
      {
        id: uid(),
        type: "packages",
        index: "4.1",
        title: "Packages",
        packages: [
          {
            name: "Essential",
            price: "€ 750,00 EUR",
            description: "Keeps a steady publishing rhythm without overloading production — sustains the presence that's already attracting brands. Best for building consistency before scaling.",
            items: ["[4h] Filming session — monthly", "[4x] Reels — raw footage to final deliverable", "[1x] Content strategy planning", "Cover / moodboard design — visual organisation of the posting sequence", "Monthly results review + scheduling platform access"],
          },
          {
            name: "Growth Plan",
            price: "€ 1.250,00 EUR",
            recommended: true,
            description: "(2x per week) Accelerates the growth curve by increasing contact frequency with audience and partner brands. Same production standard, more volume and a lower cost per piece.",
            items: ["[4h] Filming session / month", "[8x] Reels — raw footage to final deliverable", "[1x] Content strategy planning", "Cover / moodboard design — visual organisation of the posting sequence", "Monthly results review + scheduling platform access"],
          },
        ],
        note: "[3M] Minimum 3-month period — Consistency is the strategy. Premium authority is built month by month, through consistency, intention, and high standards.",
      },
      {
        id: uid(),
        type: "list",
        index: "4.3",
        title: "FAQ",
        tone: "dark",
        rows: [
          { n: "1", name: "Are travel and transportation costs included?", text: "Transportation within Amsterdam is not included. Travel costs are charged separately at €0.40/km, plus actual parking expenses." },
          { n: "2", name: "When will we receive our film?", text: "Our standard cycle timeline is 15 to 20 days, depending on the complexity of your project — never rushed." },
          { n: "3", name: "How does the payment process work?", text: "Monthly payments are due on the date of each cycle, based on the contract date." },
          { n: "4", name: "Can we customize our package?", text: "Absolutely. Every project is unique — you can upgrade your package or add extra services at any time." },
        ],
      },
      {
        id: uid(),
        type: "closing",
        text: "**Thank you for your time and consideration.**\n\nWe’re available to answer any questions, share additional materials, or discuss the next steps.\n\n**To continue the conversation:**\n+31 06 4875-7414\n\nWe look forward to the opportunity to create something truly extraordinary together.\n\n**MediaMarques | Brand Studio**",
        mark: "MM®",
      },
    ],
  };
}

export function emptyProposal(title = "New proposal"): Proposal {
  return {
    id: uid(),
    title,
    client: { name: "", company: "", email: "" },
    value: 0,
    currency: "EUR",
    stage: "lead",
    sent_at: "",
    valid_until: "",
    notes: "",
    doc: templateDoc(),
  };
}

/** Novo slide de um tipo, com conteúdo de exemplo. */
export function blankSlide(type: SlideType): Slide {
  const id = uid();
  switch (type) {
    case "cover":
      return { id, type, statement: "Perceived value is not an accident.", mark: "MM®" };
    case "section":
      return { id, type, number: "5", title: "Title", text: "**Lead sentence.** — Supporting text." };
    case "manifest":
      return { id, type, index: "1.1", headline: "*Keyword* — headline sentence.", subtitle: "Subtitle", body: "Body text." };
    case "case":
      return { id, type, index: "2.1", title: "Client / Project", meta: "2026 MOV", overview: "Overview of the project.", credits: "Marques — Creative Director", media: [] };
    case "gallery":
      return { id, type, index: "2.1[2]", title: "Client / Project", meta: "2026 PNG", media: [] };
    case "list":
      return { id, type, index: "3.1", title: "Title", tone: "dark", rows: [{ n: "1", name: "Step", text: "Description." }] };
    case "cycle":
      return { id, type, index: "3.3", title: "The cycle", steps: [{ days: "Day 1–3", name: "Step", text: "What will be done." }], note: "" };
    case "packages":
      return { id, type, index: "4.1", title: "Packages", packages: [{ name: "Essential", price: "€ 0,00 EUR", description: "", items: [""] }], note: "" };
    case "closing":
      return { id, type, text: "**Thank you.**", mark: "MM®" };
  }
}

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const media = (v: unknown): Media | undefined => {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || typeof o.src !== "string" || !o.src) return undefined;
  return { src: o.src, kind: o.kind === "video" ? "video" : "image", caption: str(o.caption) || undefined };
};
const medias = (v: unknown) => (Array.isArray(v) ? v.map(media).filter((m): m is Media => !!m) : []);

/** Valida/normaliza um slide vindo de JSON (IA, import, MCP). Lança erro com mensagem clara. */
export function normalizeSlide(raw: unknown, i = 0): Slide {
  const o = (raw ?? {}) as Record<string, unknown>;
  const type = o.type as SlideType;
  if (!SLIDE_TYPES.includes(type)) throw new Error(`slide ${i + 1}: "type" deve ser um de ${SLIDE_TYPES.join(", ")}`);
  const id = str(o.id) || uid();
  const base = blankSlide(type) as Record<string, unknown>;
  const pick = (k: string) => (o[k] === undefined ? base[k] : o[k]);
  switch (type) {
    case "cover":
      return {
        id,
        type,
        statement: str(pick("statement")),
        mark: str(pick("mark"), "MM®"),
        image: media(o.image),
        style: o.style === "gradient" ? "gradient" : "classic",
        title: str(o.title),
        kicker: str(o.kicker),
      };
    case "section":
      return { id, type, number: String(pick("number") ?? ""), title: str(pick("title")), text: str(pick("text")) };
    case "manifest":
      return { id, type, index: str(pick("index")), headline: str(pick("headline")), subtitle: str(pick("subtitle")), body: str(pick("body")), media: media(o.media) };
    case "case":
      return { id, type, index: str(pick("index")), title: str(pick("title")), meta: str(pick("meta")), overview: str(pick("overview")), credits: str(pick("credits")), media: medias(o.media) };
    case "gallery":
      return { id, type, index: str(pick("index")), title: str(pick("title")), meta: str(pick("meta")), media: medias(o.media) };
    case "list": {
      const rows = (Array.isArray(o.rows) ? o.rows : (base.rows as Row[])).map((r: Record<string, unknown>) => ({ n: String(r.n ?? ""), name: str(r.name), text: str(r.text) }));
      return { id, type, index: str(pick("index")), title: str(pick("title")), tone: o.tone === "light" ? "light" : "dark", rows };
    }
    case "cycle": {
      const steps = (Array.isArray(o.steps) ? o.steps : (base.steps as CycleStep[])).map((s: Record<string, unknown>) => ({ days: str(s.days), name: str(s.name), text: str(s.text), highlight: !!s.highlight }));
      return { id, type, index: str(pick("index")), title: str(pick("title")), steps, note: str(pick("note")) };
    }
    case "packages": {
      const packages = (Array.isArray(o.packages) ? o.packages : (base.packages as Package[])).map((p: Record<string, unknown>) => ({
        name: str(p.name),
        price: str(p.price),
        recommended: !!p.recommended,
        description: str(p.description),
        items: Array.isArray(p.items) ? p.items.map((x) => String(x)) : [],
      }));
      return { id, type, index: str(pick("index")), title: str(pick("title")), packages, note: str(pick("note")), media: media(o.media) };
    }
    case "closing":
      return { id, type, text: str(pick("text")), mark: str(pick("mark"), "MM®") };
  }
}

export function normalizeDoc(raw: unknown): ProposalDoc {
  const o = (raw ?? {}) as Record<string, unknown>;
  const t = templateDoc();
  const meta = { ...t.meta, ...((o.meta as object) ?? {}) } as ProposalDoc["meta"];
  const theme = { ...t.theme, ...((o.theme as object) ?? {}) } as ProposalTheme;
  const slides = Array.isArray(o.slides) ? o.slides.map((s, i) => normalizeSlide(s, i)) : t.slides;
  return { meta, theme, slides };
}

export function normalizeProposal(x: Partial<Proposal> & { id?: string }): Proposal {
  const base = emptyProposal(x.title ?? "New proposal");
  return {
    ...base,
    ...x,
    id: x.id || base.id,
    client: { ...base.client, ...(x.client ?? {}) },
    value: Number(x.value) || 0,
    currency: x.currency === "GBP" ? "GBP" : "EUR",
    stage: STAGES.includes(x.stage as Stage) ? (x.stage as Stage) : "lead",
    doc: x.doc ? normalizeDoc(x.doc) : base.doc,
  };
}

/** Importa JSON: proposta completa, { doc }, só { slides: [...] } ou uma lista de slides. */
export function importProposalJson(text: string): { patch: Partial<Proposal>; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { patch: {}, errors: [`JSON inválido: ${(e as Error).message}`] };
  }
  try {
    if (Array.isArray(raw)) return { patch: { doc: normalizeDoc({ slides: raw }) }, errors: [] };
    const o = raw as Record<string, unknown>;
    const patch: Partial<Proposal> = {};
    if (o.doc) patch.doc = normalizeDoc(o.doc);
    else if (o.slides) patch.doc = normalizeDoc({ slides: o.slides, meta: o.meta, theme: o.theme });
    for (const k of ["title", "notes", "sent_at", "valid_until"] as const) if (typeof o[k] === "string") patch[k] = o[k] as string;
    if (o.value !== undefined) patch.value = Number(o.value) || 0;
    if (STAGES.includes(o.stage as Stage)) patch.stage = o.stage as Stage;
    if (o.client && typeof o.client === "object") patch.client = o.client as Proposal["client"];
    if (!Object.keys(patch).length) return { patch, errors: ['Nada para importar (use "slides", "doc" ou uma proposta completa).'] };
    return { patch, errors: [] };
  } catch (e) {
    return { patch: {}, errors: [(e as Error).message] };
  }
}

export function pipeline(list: Proposal[]) {
  const open = list.filter((p) => OPEN_STAGES.includes(p.stage));
  const won = list.filter((p) => p.stage === "won");
  const closed = list.filter((p) => p.stage === "won" || p.stage === "lost");
  return {
    openValue: open.reduce((s, p) => s + p.value, 0),
    openCount: open.length,
    wonValue: won.reduce((s, p) => s + p.value, 0),
    winRate: closed.length ? Math.round((won.length / closed.length) * 100) : null,
  };
}

/** Embed de vídeo para URLs conhecidas (YouTube/Vimeo); mp4/webm e "idb:" tocam em <video>. */
export function videoEmbed(src: string): string | null {
  const yt = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(src);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`;
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(src);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}
