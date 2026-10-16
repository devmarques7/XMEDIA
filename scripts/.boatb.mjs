// scripts/boat-build.ts
import { readFileSync, writeFileSync } from "node:fs";

// lib/proposal.ts
var STAGES = ["lead", "diagnosis", "sent", "negotiation", "won", "lost"];
var SLIDE_TYPES = ["cover", "section", "manifest", "case", "gallery", "list", "cycle", "packages", "closing"];
var DEFAULT_THEME = { orange: "#FF4F2E", dark: "#1C1C1C", cream: "#ECE8E1", paper: "#F6F5F2", ink: "#111111", gray: "#7A7A7A" };
var uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
function templateDoc(clientName = "Client") {
  return {
    meta: { brand: "Media Marques Films \xA9", line2: "Portfolio", year: "2026", fao: `[ ${clientName} Proposal ]` },
    theme: { ...DEFAULT_THEME },
    slides: [
      { id: uid(), type: "cover", statement: "Perceived value is not an accident\u2014 it is the intentional construction of every expression of the brand.", mark: "MM\xAE" },
      { id: uid(), type: "section", number: "1", title: "Intro", text: "**Perceived value doesn't just happen. It is built.** \u2014 We work with brands that already have extraordinary quality \u2014 and still don't have the image it demands" },
      {
        id: uid(),
        type: "manifest",
        index: "1.1",
        headline: "*Manifest* \u2014 we **architect perception** through **strategic imagery**, precise **storytelling**, and elevated execution.",
        subtitle: "Why is simple to choose us",
        body: "**Our philosophy is simple** \u2014 perceived value is not an accident \u2014 it is the intentional construction of every expression of a brand.\n\nMany highly skilled **companies are perceived as \u201Cordinary\u201D** because **they allow the market to define their value**, instead of **leading that narrative** themselves."
      },
      { id: uid(), type: "section", number: "2", title: "Cases", text: "Every **project is unique** \u2014 Every **story is personal** \u2014 Here\u2019s how **we transform real moments into visual brand equities.**" },
      {
        id: uid(),
        type: "case",
        index: "2.1",
        title: "Carine Lopes / Hair Studio",
        meta: "2026 MOV",
        overview: "In this project we had the goal to show process and quality, with the most high quality in multiple deliverables.",
        credits: "Marques \u2014 Creative Director\nMarques \u2014 Color Grading\nMarques \u2014 Camera Operator\nMarques \u2014 Film Edit",
        media: []
      },
      { id: uid(), type: "section", number: "3", title: "Timeline", text: "A seamless experience, crafted with intention. \u2014 From the first conversation to the final delivery, **every step of our process is designed to bring clarity, creativity, and confidence.**" },
      {
        id: uid(),
        type: "list",
        index: "3.1",
        title: "Where the cycle starts",
        tone: "dark",
        rows: [
          { n: "1", name: "First call", text: "We begin with a discovery conversation to understand your story, vision, and expectations.\n[ Initial alignment call \u2014 Needs & vision discovery \u2014 Project overview & guidance \u2014 Fit evaluation ]" },
          { n: "2", name: "Proposal", text: "We formalize everything with a tailored proposal aligned to your project.\n[ Customized proposal \u2014 Scope definition \u2014 Package selection \u2014 Booking confirmation & date reservation ]" },
          { n: "3", name: "Pre-prod", text: "We plan every detail to ensure a seamless and intentional production.\n[ Creative direction & storytelling \u2014 Schedule planning \u2014 Location scouting \u2014 Final scope approval ]" },
          { n: "4", name: "Production", text: "We capture your story naturally, following the agreed plan while staying unobtrusive." }
        ]
      },
      {
        id: uid(),
        type: "list",
        index: "3.2",
        title: "Where it ends",
        tone: "light",
        rows: [
          { n: "5", name: "Post-pro", text: "We transform the captured footage into a cinematic story.\n[ Video editing & narrative construction \u2014 Sound design & music \u2014 Cinematic color grading \u2014 Internal review ]\n*Timeline \u2014 [ 7\u201315 days ] depending on project scope*" },
          { n: "6", name: "Delivery", text: "Your final film is delivered in a polished, shareable format.\n[ Private online gallery \u2014 High-resolution files (HD/4K) \u2014 Download & sharing \u2014 Final handover ]" },
          { n: "7", name: "Feedback", text: "We believe your experience matters just as much as the final film. After delivery, we invite you to share your thoughts \u2014 not just as clients, but as part of the Media Family." }
        ]
      },
      {
        id: uid(),
        type: "cycle",
        index: "3.3",
        title: "The cycle \u2014 *because process consistency generates perception consistency.*",
        steps: [
          { days: "Day 1\u20133", name: "Clarity & organization", text: "We align strategy, narrative and brand objectives. Before any camera. \u2192 Delivery: strategic brief, brand narrative and cycle content plan." },
          { days: "Day 4\u20137", name: "Pre-production", text: "Locations, references, visual language, creative script. \u2192 Delivery: creative script, moodboard and approved visual direction." },
          { days: "Day 8\u201310", name: "Production", text: "Filming and photography following the approved plan. \u2192 Delivery: all raw material captured to brief." },
          { days: "Day 11\u201317", name: "Post-production", text: "Editing, color correction and image treatment that communicates your level. \u2192 Delivery: edited videos and treated images.", highlight: true },
          { days: "Day 18\u201320", name: "Delivery & feedback", text: "Joint review. Refinement. Assets ready to position your brand. \u2192 Delivery: final package of approved assets." }
        ],
        note: "Full cycle \u2014 15 to 20 days. The remaining time of the month is not a pause \u2014 it is where we work on the next cycle's strategy.\n\nTogether we build. Month after month."
      },
      { id: uid(), type: "section", number: "4", title: "Proposal", text: "**Content is more than something you watch** \u2014 Over time, meaningful content becomes one of the most valuable assets a brand can own. **\u201CPrice is what you pay. Value is what remains.\u201D**" },
      {
        id: uid(),
        type: "packages",
        index: "4.1",
        title: "Packages",
        packages: [
          {
            name: "Essential",
            price: "\u20AC 750,00 EUR",
            description: "Keeps a steady publishing rhythm without overloading production \u2014 sustains the presence that's already attracting brands. Best for building consistency before scaling.",
            items: ["[4h] Filming session \u2014 monthly", "[4x] Reels \u2014 raw footage to final deliverable", "[1x] Content strategy planning", "Cover / moodboard design \u2014 visual organisation of the posting sequence", "Monthly results review + scheduling platform access"]
          },
          {
            name: "Growth Plan",
            price: "\u20AC 1.250,00 EUR",
            recommended: true,
            description: "(2x per week) Accelerates the growth curve by increasing contact frequency with audience and partner brands. Same production standard, more volume and a lower cost per piece.",
            items: ["[4h] Filming session / month", "[8x] Reels \u2014 raw footage to final deliverable", "[1x] Content strategy planning", "Cover / moodboard design \u2014 visual organisation of the posting sequence", "Monthly results review + scheduling platform access"]
          }
        ],
        note: "[3M] Minimum 3-month period \u2014 Consistency is the strategy. Premium authority is built month by month, through consistency, intention, and high standards."
      },
      {
        id: uid(),
        type: "list",
        index: "4.3",
        title: "FAQ",
        tone: "dark",
        rows: [
          { n: "1", name: "Are travel and transportation costs included?", text: "Transportation within Amsterdam is not included. Travel costs are charged separately at \u20AC0.40/km, plus actual parking expenses." },
          { n: "2", name: "When will we receive our film?", text: "Our standard cycle timeline is 15 to 20 days, depending on the complexity of your project \u2014 never rushed." },
          { n: "3", name: "How does the payment process work?", text: "Monthly payments are due on the date of each cycle, based on the contract date." },
          { n: "4", name: "Can we customize our package?", text: "Absolutely. Every project is unique \u2014 you can upgrade your package or add extra services at any time." }
        ]
      },
      {
        id: uid(),
        type: "closing",
        text: "**Thank you for your time and consideration.**\n\nWe\u2019re available to answer any questions, share additional materials, or discuss the next steps.\n\n**To continue the conversation:**\n+31 06 4875-7414\n\nWe look forward to the opportunity to create something truly extraordinary together.\n\n**MediaMarques | Brand Studio**",
        mark: "MM\xAE"
      }
    ]
  };
}
function emptyProposal(title = "New proposal") {
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
    doc: templateDoc()
  };
}
function blankSlide(type) {
  const id = uid();
  switch (type) {
    case "cover":
      return { id, type, statement: "Perceived value is not an accident.", mark: "MM\xAE" };
    case "section":
      return { id, type, number: "5", title: "Title", text: "**Lead sentence.** \u2014 Supporting text." };
    case "manifest":
      return { id, type, index: "1.1", headline: "*Keyword* \u2014 headline sentence.", subtitle: "Subtitle", body: "Body text." };
    case "case":
      return { id, type, index: "2.1", title: "Client / Project", meta: "2026 MOV", overview: "Overview of the project.", credits: "Marques \u2014 Creative Director", media: [] };
    case "gallery":
      return { id, type, index: "2.1[2]", title: "Client / Project", meta: "2026 PNG", media: [] };
    case "list":
      return { id, type, index: "3.1", title: "Title", tone: "dark", rows: [{ n: "1", name: "Step", text: "Description." }] };
    case "cycle":
      return { id, type, index: "3.3", title: "The cycle", steps: [{ days: "Day 1\u20133", name: "Step", text: "What will be done." }], note: "" };
    case "packages":
      return { id, type, index: "4.1", title: "Packages", packages: [{ name: "Essential", price: "\u20AC 0,00 EUR", description: "", items: [""] }], note: "" };
    case "closing":
      return { id, type, text: "**Thank you.**", mark: "MM\xAE" };
  }
}
var str = (v, d = "") => typeof v === "string" ? v : d;
var media = (v) => {
  const o = v;
  if (!o || typeof o !== "object" || typeof o.src !== "string" || !o.src) return void 0;
  return { src: o.src, kind: o.kind === "video" ? "video" : "image", caption: str(o.caption) || void 0 };
};
var medias = (v) => Array.isArray(v) ? v.map(media).filter((m) => !!m) : [];
function normalizeSlide(raw, i = 0) {
  const o = raw ?? {};
  const type = o.type;
  if (!SLIDE_TYPES.includes(type)) throw new Error(`slide ${i + 1}: "type" deve ser um de ${SLIDE_TYPES.join(", ")}`);
  const id = str(o.id) || uid();
  const base = blankSlide(type);
  const pick = (k) => o[k] === void 0 ? base[k] : o[k];
  switch (type) {
    case "cover":
      return {
        id,
        type,
        statement: str(pick("statement")),
        mark: str(pick("mark"), "MM\xAE"),
        image: media(o.image),
        style: o.style === "gradient" ? "gradient" : "classic",
        title: str(o.title),
        kicker: str(o.kicker)
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
      const rows = (Array.isArray(o.rows) ? o.rows : base.rows).map((r) => ({ n: String(r.n ?? ""), name: str(r.name), text: str(r.text) }));
      return { id, type, index: str(pick("index")), title: str(pick("title")), tone: o.tone === "light" ? "light" : "dark", rows };
    }
    case "cycle": {
      const steps = (Array.isArray(o.steps) ? o.steps : base.steps).map((s2) => ({ days: str(s2.days), name: str(s2.name), text: str(s2.text), highlight: !!s2.highlight }));
      return { id, type, index: str(pick("index")), title: str(pick("title")), steps, note: str(pick("note")) };
    }
    case "packages": {
      const packages = (Array.isArray(o.packages) ? o.packages : base.packages).map((p2) => ({
        name: str(p2.name),
        price: str(p2.price),
        recommended: !!p2.recommended,
        description: str(p2.description),
        items: Array.isArray(p2.items) ? p2.items.map((x) => String(x)) : []
      }));
      return { id, type, index: str(pick("index")), title: str(pick("title")), packages, note: str(pick("note")), media: media(o.media) };
    }
    case "closing":
      return { id, type, text: str(pick("text")), mark: str(pick("mark"), "MM\xAE") };
  }
}
function normalizeDoc(raw) {
  const o = raw ?? {};
  const t = templateDoc();
  const meta = { ...t.meta, ...o.meta ?? {} };
  const theme = { ...t.theme, ...o.theme ?? {} };
  const slides = Array.isArray(o.slides) ? o.slides.map((s2, i) => normalizeSlide(s2, i)) : t.slides;
  return { meta, theme, slides };
}
function normalizeProposal(x) {
  const base = emptyProposal(x.title ?? "New proposal");
  return {
    ...base,
    ...x,
    id: x.id || base.id,
    client: { ...base.client, ...x.client ?? {} },
    value: Number(x.value) || 0,
    currency: x.currency === "GBP" ? "GBP" : "EUR",
    stage: STAGES.includes(x.stage) ? x.stage : "lead",
    doc: x.doc ? normalizeDoc(x.doc) : base.doc
  };
}

// lib/invoice.ts
var EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
function resolveBtw(btw, country) {
  if (btw !== "auto") return { rate: btw, label: `BTW ${btw}%`, reason: "manual" };
  const c = (country || "NL").trim().toUpperCase();
  if (c === "NL") return { rate: 21, label: "BTW 21%", reason: "nl" };
  if (EU.includes(c)) return { rate: 0, label: "BTW 0% [REVERSE CHARGE]", reason: "eu_reverse" };
  return { rate: 0, label: "", reason: "outside_eu" };
}
var ITEMS_TEMPLATE = JSON.stringify(
  {
    client: { name: "WE ARE SANCTUM LTD.", address: "1st Floor One Suffolk Way\nSevenoaks TN13 1YL GB", country: "GB", vat: "", email: "" },
    items: [
      { description: "\xAE [MM] Post-Production / Reel PRO: - Complete Edit", qty: 3, rate: 245 },
      { description: "\xAE [MM] Capture Day / Half Day", qty: 1, rate: 450 }
    ],
    note: "Covers the complete edit of 3 final Reels\u2026",
    btw: "auto"
  },
  null,
  2
);

// lib/services.ts
var DEFAULT_RULES = {
  hours_tiers: [
    { min: 1, pct: 0 },
    { min: 4, pct: 8 },
    { min: 8, pct: 15 },
    { min: 16, pct: 20 }
  ],
  hours_on_capture: false,
  volume_tiers: [
    { min: 1, pct: 0 },
    { min: 4, pct: 8 },
    { min: 8, pct: 12 },
    { min: 13, pct: 18 }
  ],
  recurring: [
    { months: 3, pct: 10 },
    { months: 6, pct: 18 },
    { months: 12, pct: 25 }
  ],
  partner_pct: 10,
  cap_pct: 35,
  floor_margin: 50,
  target_margin: 65,
  healthy: [60, 75],
  rush_pct: 125,
  btw: 21,
  deposit_pct: 50
};
var DEFAULT_FOLDERS = [
  { id: "capture", label: "Capta\xE7\xE3o de v\xEDdeo", color: "#ff5a1f", order: 1, hint: "Horas e di\xE1rias de filmagem \u2014 material bruto, sem edi\xE7\xE3o." },
  { id: "edit", label: "Edi\xE7\xE3o de v\xEDdeo", color: "#7c5cff", order: 2, hint: "Edi\xE7\xE3o Basic/PRO, di\xE1rias de edi\xE7\xE3o, legendas." },
  { id: "video_pkg", label: "Reels & pacotes v\xEDdeo", color: "#ffb020", order: 3, hint: "Capta\xE7\xE3o + edi\xE7\xE3o num pre\xE7o fechado; reels extra." },
  { id: "photo", label: "Fotografia", color: "#1fb6ff", order: 4, hint: "Sess\xF5es, eventos, edi\xE7\xE3o e extras de foto." },
  { id: "photo_pkg", label: "Pacotes de foto", color: "#13c296", order: 5, hint: "Assinaturas mensais e banco de imagens da marca." },
  { id: "preprod", label: "Pr\xE9-produ\xE7\xE3o & log\xEDstica", color: "#8a8f98", order: 6, hint: "Estrat\xE9gia, roteiro e deslocamento." }
];
var KIND_OF_FOLDER = { capture: "capture", edit: "edit", video_pkg: "reel", photo: "photo", photo_pkg: "photo", preprod: "strategy" };
var UNIT_HOURS_DEFAULT = { hour: 1, day: 6, item: 1, session: 2, month: 2, trip: 0 };
var round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
var num = (v, d = 0) => typeof v === "number" && isFinite(v) ? v : typeof v === "string" && v.trim() && isFinite(+v) ? +v : d;
var str2 = (v, d = "") => typeof v === "string" ? v : d;
var strs = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : typeof v === "string" ? v.split(/\n|;/).map((x) => x.replace(/^[•\-\s]+/, "").trim()).filter(Boolean) : [];
var oneOf = (v, list, d) => list.includes(v) ? v : d;
var uid2 = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
var slug = (s2) => s2.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || uid2();
var UNITS = ["hour", "day", "item", "session", "month", "trip"];
var PLANS = ["on_demand", "frequency", "day", "extra", "package"];
var KINDS = ["capture", "edit", "reel", "photo", "strategy", "travel"];
var POTS = ["high", "medium", "review", "passthrough"];
function normalizeService(x, folders = DEFAULT_FOLDERS) {
  const name = str2(x.name).trim() || "Novo servi\xE7o";
  const folder = folders.some((f) => f.id === x.folder) ? String(x.folder) : str2(x.folder) ? str2(x.folder) : folders[0]?.id ?? "capture";
  const unit = oneOf(x.unit, UNITS, "hour");
  const pass = Boolean(x.pass_through);
  const kind = oneOf(x.kind, KINDS, pass ? "travel" : KIND_OF_FOLDER[folder] ?? "strategy");
  const m = x.market;
  return {
    id: str2(x.id) || slug(name),
    name,
    folder,
    kind,
    plan: x.plan == null || x.plan === "" ? null : oneOf(x.plan, PLANS, "on_demand"),
    tier: x.tier === "simple" || x.tier === "pro" ? x.tier : null,
    unit,
    price: Math.max(0, round2(num(x.price))),
    crp: Math.max(0, round2(num(x.crp))),
    hours: Math.max(0, num(x.hours, UNIT_HOURS_DEFAULT[unit])),
    min_margin: Math.min(95, Math.max(0, num(x.min_margin, pass ? 0 : kind === "capture" ? 25 : DEFAULT_RULES.floor_margin))),
    pass_through: pass,
    potential: oneOf(x.potential, POTS, pass ? "passthrough" : "medium"),
    deliverable: str2(x.deliverable),
    includes: strs(x.includes),
    use_for: strs(x.use_for),
    not_for: str2(x.not_for),
    notes: str2(x.notes),
    invoice_label: str2(x.invoice_label) || `\xAE [MM] ${name}`,
    market: m && isFinite(+m.low) && isFinite(+m.high) && +m.high > 0 ? { low: +m.low, high: +m.high, per: oneOf(m.per, ["hour", "day", "item", "month"], "hour"), label: str2(m.label), sources: strs(m.sources) } : null,
    tags: strs(x.tags),
    uses: Math.max(0, Math.round(num(x.uses))),
    archived: Boolean(x.archived),
    source: x.source && typeof x.source === "object" ? x.source : void 0,
    history: Array.isArray(x.history) ? x.history.slice(-30) : [],
    created_at: str2(x.created_at) || void 0,
    updated_at: str2(x.updated_at) || void 0
  };
}
function normalizeRules(x) {
  const d = DEFAULT_RULES;
  const tiers = (v, def) => Array.isArray(v) && v.length ? v.map((t) => ({ min: Math.max(0, num(t.min)), pct: Math.min(100, Math.max(0, num(t.pct))) })).sort((a, b) => a.min - b.min) : def;
  return {
    hours_tiers: tiers(x?.hours_tiers, d.hours_tiers),
    hours_on_capture: x?.hours_on_capture ?? d.hours_on_capture,
    volume_tiers: tiers(x?.volume_tiers, d.volume_tiers),
    recurring: Array.isArray(x?.recurring) && x.recurring.length ? x.recurring.map((r) => ({ months: Math.max(1, Math.round(num(r.months))), pct: Math.min(100, Math.max(0, num(r.pct))) })).sort((a, b) => a.months - b.months) : d.recurring,
    partner_pct: Math.min(100, Math.max(0, num(x?.partner_pct, d.partner_pct))),
    cap_pct: Math.min(100, Math.max(0, num(x?.cap_pct, d.cap_pct))),
    floor_margin: Math.min(95, Math.max(0, num(x?.floor_margin, d.floor_margin))),
    target_margin: Math.min(95, Math.max(1, num(x?.target_margin, d.target_margin))),
    healthy: Array.isArray(x?.healthy) && x.healthy.length === 2 ? [num(x.healthy[0], 60), num(x.healthy[1], 75)] : d.healthy,
    rush_pct: Math.max(0, num(x?.rush_pct, d.rush_pct)),
    btw: Math.max(0, num(x?.btw, d.btw)),
    deposit_pct: Math.min(100, Math.max(0, num(x?.deposit_pct, d.deposit_pct))),
    updated_at: x?.updated_at
  };
}
var marginOf = (price, crp) => price > 0 ? round2((price - crp) / price * 100) : 0;
var tierPct = (tiers, n) => tiers.reduce((p2, t) => n >= t.min ? t.pct : p2, 0);
var recurringPct = (rules, months) => rules.recurring.reduce((p2, r) => months >= r.months ? r.pct : p2, 0);
var isReel = (s2) => (s2.kind === "edit" || s2.kind === "reel") && (s2.unit === "item" || s2.unit === "hour");
function quote(input2, catalog, rulesIn) {
  const rules = normalizeRules(rulesIn);
  const byId = new Map(catalog.map((s2) => [s2.id, s2]));
  const warnings = [];
  const picked = input2.lines.map((l) => ({ l, s: byId.get(l.service_id) })).filter((x) => {
    if (!x.s) warnings.push({ code: "unknown_service", detail: x.l.service_id });
    return Boolean(x.s) && num(x.l.qty) > 0;
  });
  const reels = picked.filter((x) => isReel(x.s)).reduce((n, x) => n + (x.s.unit === "item" ? num(x.l.qty) : Math.ceil(num(x.l.qty) * (x.s.hours || 1))), 0);
  const volPct = tierPct(rules.volume_tiers, reels);
  const months = Math.max(0, Math.round(num(input2.recurring_months)));
  const recPct = recurringPct(rules, months);
  const extra = Math.min(100, Math.max(0, num(input2.extra_discount_pct)));
  const lines = picked.map(({ l, s: s2 }) => {
    const qty = num(l.qty);
    const hours = round2(qty * s2.hours);
    const base = l.price_override != null && isFinite(+l.price_override) ? +l.price_override : s2.price;
    const rushAdd = input2.rush && (s2.kind === "edit" || s2.kind === "reel") && !s2.pass_through ? round2(base * rules.rush_pct / 100) : 0;
    const unit_price = round2(base + rushAdd);
    const gross2 = round2(unit_price * qty);
    const crp2 = round2(s2.crp * qty);
    const d = { hours: 0, volume: 0, recurring: 0, partner: 0, extra: 0 };
    if (!s2.pass_through) {
      if (s2.unit !== "item" && (s2.kind !== "capture" || rules.hours_on_capture) && s2.kind !== "travel") d.hours = tierPct(rules.hours_tiers, hours);
      if (isReel(s2)) d.volume = volPct;
      d.recurring = recPct;
      d.partner = input2.partner ? rules.partner_pct : 0;
      d.extra = extra;
    }
    const requested = d.hours + d.volume + d.recurring + d.partner + d.extra;
    let applied = Math.min(requested, rules.cap_pct);
    const capped = requested > rules.cap_pct;
    let floor_limited = false;
    if (!s2.pass_through && gross2 > 0 && applied > 0) {
      const maxD = Math.max(0, (1 - crp2 / (gross2 * (1 - s2.min_margin / 100))) * 100);
      if (applied > maxD) {
        applied = Math.floor(maxD * 10) / 10;
        floor_limited = true;
      }
    }
    const net = round2(gross2 * (1 - applied / 100));
    const blocked = !s2.pass_through && net <= crp2 && gross2 > 0;
    if (capped) warnings.push({ code: "capped", line: s2.id });
    if (floor_limited) warnings.push({ code: "floor_limited", line: s2.id });
    if (blocked) warnings.push({ code: "blocked", line: s2.id });
    else if (!s2.pass_through && marginOf(net, crp2) < s2.min_margin) warnings.push({ code: "below_floor", line: s2.id });
    return {
      service: s2,
      label: l.label || s2.invoice_label,
      qty,
      hours,
      unit_price,
      gross: gross2,
      discounts: d,
      requested_pct: round2(requested),
      applied_pct: round2(applied),
      capped,
      floor_limited,
      net,
      unit_net: qty ? round2(net / qty) : 0,
      crp: crp2,
      margin: marginOf(net, crp2),
      blocked,
      rush: round2(rushAdd * qty)
    };
  });
  const gross = round2(lines.reduce((s2, l) => s2 + l.gross, 0));
  const subtotal = round2(lines.reduce((s2, l) => s2 + l.net, 0));
  const crp = round2(lines.reduce((s2, l) => s2 + l.crp, 0));
  const country = (input2.client.country || "NL").toUpperCase();
  const btwRate = country === "NL" ? rules.btw : resolveBtw("auto", country).rate;
  const btw = round2(subtotal * btwRate / 100);
  const total = round2(subtotal + btw);
  if (months > 0 && recPct === 0) warnings.push({ code: "recurring_short", detail: String(rules.recurring[0]?.months ?? 3) });
  return {
    lines,
    gross,
    discount: round2(gross - subtotal),
    subtotal,
    btw,
    total,
    deposit: round2(total * rules.deposit_pct / 100),
    crp,
    margin: marginOf(subtotal, crp),
    hours: round2(lines.reduce((s2, l) => s2 + l.hours, 0)),
    reels,
    recurring_pct: recPct,
    btw_rate: btwRate,
    months,
    contract_total: months > 0 ? round2(subtotal * months) : subtotal,
    warnings
  };
}
var SRC_VIDEO = ["Ruah Creative House \u2014 Freelance Videographer Rates 2026", "getcameracrew.com \u2014 Amsterdam crew cost", "daily-rate.eu \u2014 Netherlands 2026", "Airframe Media \u2014 London/EU Day Rates 2026"];
var SRC_EDIT = ["solohourly.com \u2014 Germany Video Editor Rates 2026", "reel-rate.com \u2014 Video Editor Rates by Country 2026"];
var SRC_REEL = ["D-MAK Productions \u2014 Social Media Video Pricing 2026", "advids.co \u2014 Amsterdam social video agencies"];
var SRC_PHOTO = ["Benchmark interno NL/EU 2026 (Notion \xA73) \u2014 fotografia de neg\xF3cios"];
var MARKET = {
  capture_hour: { low: 80, high: 380, per: "hour", label: "Videographer freelance \xB7 Amsterd\xE3o", sources: [...SRC_VIDEO, "Adenda 3.1 \u2014 freelancers bons NL a \u20AC80\u2013100/h"] },
  capture_day: { low: 750, high: 2500, per: "day", label: "Di\xE1ria de capta\xE7\xE3o \xB7 Holanda", sources: SRC_VIDEO },
  edit_hour: { low: 45, high: 150, per: "hour", label: "Editor freelance \xB7 Europa (m\xE9dio \u2192 s\xE9nior)", sources: SRC_EDIT },
  reel: { low: 600, high: 2e3, per: "item", label: "V\xEDdeo curto/Reel (ag\xEAncia) \xB7 Holanda", sources: SRC_REEL },
  reel_edit: { low: 95, high: 300, per: "item", label: "Edi\xE7\xE3o de Reel (freelancer \u2192 est\xFAdio)", sources: [...SRC_EDIT, "Tabela validada Notion \xA74 (\u20AC95\u2013185/Reel)"] },
  subtitles: { low: 40, high: 80, per: "item", label: "Legendas simples por v\xEDdeo", sources: ["Notion \u2014 Program Worksheet (Legendas simples \u20AC40\u201380)"] },
  photo_hour: { low: 80, high: 150, per: "hour", label: "Fotografia de neg\xF3cios \xB7 NL", sources: SRC_PHOTO },
  photo_event: { low: 80, high: 250, per: "hour", label: "Fotografia de eventos \xB7 NL", sources: SRC_PHOTO },
  retouch: { low: 30, high: 50, per: "item", label: "Retoque avan\xE7ado por foto", sources: ["Notion \u2014 Program Worksheet (\u20AC30\u201350/foto)"] },
  retainer: { low: 3500, high: 8e3, per: "month", label: "Retainer de conte\xFAdo mensal (marca)", sources: SRC_REEL }
};

// lib/proposalPricing.ts
var eurPkg = (n) => `\u20AC ${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
var INV_PREFIX = "inv-";
var round22 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
var eur2 = (n) => `\u20AC${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
var input = (pr, lines) => ({
  client: { name: "", country: pr.country || "NL" },
  lines: lines.map((l) => ({ service_id: l.service_id, qty: l.qty, price_override: l.price_override ?? null })),
  partner: pr.partner,
  recurring_months: pr.recurring_months,
  rush: pr.rush
});
function pricingSummary(pr, catalog, rules) {
  const by = (g) => pr.lines.filter((l) => l.group === g && l.qty > 0 && catalog.some((s2) => s2.id === l.service_id));
  const prod = by("production");
  const baseLines = [...prod, ...by("deliverable")];
  const base = quote(input(pr, baseLines), catalog, rules);
  const extraLines = pr.lines.filter((l) => l.group === "extra");
  const packages = (pr.packages ?? []).map((pk, index) => {
    const chosen = pk.extras.map((i) => extraLines[i]).filter((l) => !!l && l.qty > 0 && catalog.some((s2) => s2.id === l.service_id));
    const q = quote(input(pr, [...baseLines, ...chosen]), catalog, rules);
    return { index, name: pk.name, quote: q, extras: chosen.map((line) => ({ line, service: catalog.find((s2) => s2.id === line.service_id), price: 0, total_with: q.subtotal })) };
  });
  return {
    packages,
    production: quote(input(pr, prod), catalog, rules),
    base,
    extras: by("extra").map((line) => {
      const withIt = quote(input(pr, [...baseLines, line]), catalog, rules);
      return { line, service: catalog.find((s2) => s2.id === line.service_id), price: round22(withIt.subtotal - base.subtotal), total_with: withIt.subtotal };
    }),
    full: quote(input(pr, [...baseLines, ...by("extra")]), catalog, rules)
  };
}
var short = (s2) => s2.invoice_label.replace(/^®\s*\[MM\]\s*/, "");
var unitWord = { hour: ["hour", "hours"], day: ["day", "days"], item: ["", ""], session: ["session", "sessions"], month: ["month", "months"], trip: ["trip", "trips"] };
function lineMath(q, id) {
  const l = q.lines.find((x) => x.service.id === id);
  if (!l) return "";
  const [one, many] = unitWord[l.service.unit] ?? ["", ""];
  const u = one ? ` ${l.qty === 1 ? one : many}` : "";
  const qty = l.qty === 1 && !u ? "" : `${+l.qty.toFixed(2)}${u} \xD7 ${eur2(l.unit_price)}`;
  const disc = l.applied_pct ? ` \u2212 ${l.applied_pct}%` : "";
  return qty ? `${qty}${disc} = ${eur2(l.net)}` : `${eur2(l.net)}${disc ? ` (${disc.trim()})` : ""}`;
}
function pricingSlides(pr, sum, catalog, rulesIn, index = "4") {
  const rules = normalizeRules(rulesIn);
  const svc = (id) => catalog.find((s2) => s2.id === id);
  const b = sum.base;
  const n = (i) => String(i).padStart(2, "0");
  const prod = pr.lines.filter((l) => l.group === "production" && b.lines.some((x) => x.service.id === l.service_id));
  const deliv = pr.lines.filter((l) => l.group === "deliverable" && b.lines.some((x) => x.service.id === l.service_id));
  let k = 0;
  const rows = [
    ...prod.map((l) => ({ n: n(++k), name: l.label || short(svc(l.service_id)), text: `${l.note || svc(l.service_id).deliverable}
${lineMath(b, l.service_id)}` })),
    ...deliv.map((l) => ({ n: n(++k), name: l.label || short(svc(l.service_id)), text: `${l.note || svc(l.service_id).deliverable}
${lineMath(b, l.service_id)}` })),
    {
      n: "\u03A3",
      name: "Total",
      text: `*${eur2(b.subtotal)} excl. BTW* \u2014 BTW ${b.btw_rate}% ${eur2(b.btw)} \u2014 **${eur2(b.total)} incl. BTW**${b.months ? `
[ Per month \xB7 ${b.months}-month contract ]` : ""}`
    }
  ];
  const usePk = !!pr.packages?.length;
  const extraLines = pr.lines.filter((l) => l.group === "extra");
  const inPackage = new Set((pr.packages ?? []).flatMap((p2) => p2.extras));
  const itemOf = (l) => (l.item || `${l.label || short(svc(l.service_id))}`).toUpperCase();
  const slides = usePk ? [
    {
      id: `${INV_PREFIX}packages`,
      type: "packages",
      index: `${index}.1`,
      title: "Packages",
      packages: pr.packages.map((pk, i) => ({
        name: pk.name,
        price: eurPkg(sum.packages[i]?.quote.subtotal ?? 0),
        recommended: !!pk.recommended,
        description: pk.description,
        items: (pk.items?.length ? pk.items : [...[...prod, ...deliv].map(itemOf), ...pk.extras.map((k2) => extraLines[k2]).filter(Boolean).map(itemOf), ...pr.base_items ?? []]).slice(0, 6)
      })),
      note: pr.note || `Prices excl. BTW ${b.btw_rate}%. ${rules.deposit_pct}% deposit to confirm the date \u2014 balance within 5 days after final delivery.`,
      ...pr.image ? { media: pr.image } : {}
    }
  ] : [{ id: `${INV_PREFIX}base`, type: "list", index: `${index}.1`, title: "Investment", tone: "dark", rows }];
  const loose = usePk ? sum.extras.filter((e) => !inPackage.has(extraLines.indexOf(e.line))) : sum.extras;
  if (loose.length)
    slides.push({
      id: `${INV_PREFIX}extras`,
      type: "list",
      index: `${index}.2`,
      title: "Optional extras",
      tone: "light",
      rows: [
        ...loose.map((e, i) => ({
          n: String.fromCharCode(65 + i),
          name: e.line.label || short(e.service),
          text: `${e.line.note || e.service.deliverable}
*+ ${eur2(e.price)} excl. BTW*${usePk ? " \u2014 can be added to any package" : ""}`
        })),
        ...usePk ? [] : [{ n: "\u2014", name: "Everything", text: `Base plus all extras: ${eur2(sum.full.subtotal)} excl. BTW \u2014 ${eur2(sum.full.total)} incl. BTW.` }]
      ]
    });
  const capture = catalog.find((s2) => pr.lines.some((l) => l.group === "production" && l.service_id === s2.id) && s2.unit === "hour" && s2.kind === "capture");
  const valid = pr.valid_until ? (/* @__PURE__ */ new Date(pr.valid_until + "T12:00:00")).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "30 days";
  const discounts = b.discount > 0 || sum.full.discount > 0;
  slides.push({
    id: `${INV_PREFIX}terms`,
    type: "list",
    index: `${index}.${loose.length ? 3 : 2}`,
    title: "Conditions",
    tone: "light",
    rows: [
      { n: "A", name: "Basis", text: `MediaMarques ${(/* @__PURE__ */ new Date()).getFullYear()} rate card \u2014 production first, then the deliverable; extras only if you need them.${discounts ? ` Volume conditions already applied (combined discounts never exceed ${rules.cap_pct}%).` : ""}` },
      ...capture ? [{ n: "B", name: "Extra time", text: `If the event runs longer: ${eur2(capture.price)} per additional hour on location, agreed on the day.` }] : [],
      { n: capture ? "C" : "B", name: "Payment", text: `${rules.deposit_pct}% deposit to confirm the date; balance within 5 days after final delivery.` },
      { n: capture ? "D" : "C", name: "Validity", text: `Prices valid until ${valid}, excl. BTW ${b.btw_rate}%.` }
    ]
  });
  return slides;
}
function applyPricing(p2, catalog, rules) {
  const pr = p2.pricing;
  if (!pr) return p2;
  const sum = pricingSummary(pr, catalog, rules);
  const old = p2.doc.slides;
  const firstInv = old.findIndex((s2) => s2.id.startsWith(INV_PREFIX));
  const kept = old.filter((s2) => !s2.id.startsWith(INV_PREFIX));
  let at = firstInv >= 0 ? old.slice(0, firstInv).filter((s2) => !s2.id.startsWith(INV_PREFIX)).length : -1;
  if (at < 0 && pr.insert_after) at = kept.findIndex((s2) => s2.id === pr.insert_after) + 1 || -1;
  if (at < 0) at = Math.max(0, kept.findLastIndex((s2) => s2.type === "closing"));
  const anchor = kept.slice(0, at).reverse().find((s2) => s2.type === "section");
  const slides = [...kept.slice(0, at), ...pricingSlides(pr, sum, catalog, rules, anchor?.number ?? "4"), ...kept.slice(at)];
  const rec = pr.packages?.findIndex((x) => x.recommended) ?? -1;
  const value = rec >= 0 && sum.packages[rec] ? sum.packages[rec].quote.subtotal : sum.base.subtotal;
  const r = normalizeRules(rules);
  const pkSlide = slides.find((x) => x.id === `${INV_PREFIX}packages`);
  const offer = {
    packages: sum.packages.length ? sum.packages.map((k, i) => ({ name: k.name, subtotal: k.quote.subtotal, recommended: !!pr.packages[i].recommended, items: pkSlide?.type === "packages" ? pkSlide.packages[i]?.items ?? [] : [] })) : [{ name: "Proposal", subtotal: sum.base.subtotal, recommended: true, items: [] }],
    extras: sum.extras.filter((e) => !(pr.packages ?? []).some((pk) => pk.extras.includes(pr.lines.filter((l) => l.group === "extra").indexOf(e.line)))).map((e) => ({ label: e.line.label || short(e.service), price: e.price })),
    btw_rate: sum.base.btw_rate,
    deposit_pct: r.deposit_pct,
    valid_until: pr.valid_until
  };
  return { ...p2, value, valid_until: pr.valid_until || p2.valid_until, pricing: { ...pr, offer }, doc: { ...p2.doc, slides } };
}

// lib/services-seed.ts
var NOTION = "https://app.notion.com/p/2f51c41fbb3380c9b7cae3b438c0eb39";
var CAP_SIMPLE = ["1 c\xE2mera", "Luz simples ou ambiente otimizada", "Plano fixo ou movimentos b\xE1sicos", "\xC1udio simples (microfone direto)", "Dire\xE7\xE3o b\xE1sica de pose e enquadramento"];
var CAP_PRO = ["Planeamento t\xE9cnico pr\xE9vio", "Setup avan\xE7ado de ilumina\xE7\xE3o", "Gimbal, tracking e movimentos din\xE2micos", "M\xFAltiplos enquadramentos e takes", "\xC1udio dedicado (quando aplic\xE1vel)", "Dire\xE7\xE3o ativa de cena e performance"];
var USE_SIMPLE = ["Reels simples", "Bastidores", "Depoimentos curtos", "Conte\xFAdo recorrente"];
var USE_PRO = ["Reels cinematogr\xE1ficos", "Campanhas e an\xFAncios", "V\xEDdeos de marca/autoridade", "Fashion films"];
var EDIT_BASIC = ["Corte seco", "Trilha sonora b\xE1sica", "Legendas padr\xE3o", "1 v\xEDdeo 30\u201360s por hora"];
var EDIT_PRO = ["Montagem narrativa", "Color grading avan\xE7ado", "Sound design", "Legendas din\xE2micas e VFX leves"];
var RAW = [
  // ---------- Captação
  {
    id: "cap-day-pro",
    name: "Di\xE1ria Produ\xE7\xE3o | PRO | Capturing",
    folder: "capture",
    plan: "day",
    tier: "pro",
    unit: "day",
    price: 960,
    crp: 480,
    hours: 6,
    min_margin: 25,
    potential: "high",
    deliverable: "1 di\xE1ria de capta\xE7\xE3o PRO (~6h efetivas): material bruto para m\xFAltiplos Reels/cenas complexas, setup avan\xE7ado de luz e movimento. N\xE3o inclui edi\xE7\xE3o.",
    includes: CAP_PRO,
    use_for: [...USE_PRO, "Cases profissionais"],
    not_for: "Se s\xF3 precisa de 1\u20132 Reels, use horas PRO On-Demand.",
    invoice_label: "\xAE [MM] Capturing Day \u2014 PRO (6h)",
    market: MARKET.capture_day,
    tags: ["di\xE1ria", "filmagem", "dia completo"]
  },
  {
    id: "cap-day-simple",
    name: "Di\xE1ria Produ\xE7\xE3o | Simples | Capturing",
    folder: "capture",
    plan: "day",
    tier: "simple",
    unit: "day",
    price: 642,
    crp: 480,
    hours: 6,
    min_margin: 25,
    potential: "high",
    deliverable: "Material bruto captado (1 c\xE2mera, luz simples), 1 di\xE1ria completa (~6h efetivas).",
    includes: CAP_SIMPLE,
    use_for: USE_SIMPLE,
    not_for: "Para est\xE9tica cinematogr\xE1fica use a Di\xE1ria PRO.",
    invoice_label: "\xAE [MM] Capturing Day \u2014 Basic (6h)",
    market: MARKET.capture_day,
    tags: ["di\xE1ria", "filmagem"],
    notes: "Tarifa/margem Basic ainda por rever (diferencia\xE7\xE3o Basic vs. PRO)."
  },
  {
    id: "cap-basic-frequency",
    name: "Production | Basic | Frequency",
    folder: "capture",
    plan: "frequency",
    tier: "simple",
    unit: "hour",
    price: 107,
    crp: 80,
    hours: 1,
    min_margin: 25,
    potential: "review",
    deliverable: "Material bruto captado (1 c\xE2mera, b\xE1sico) para 1 v\xEDdeo curto.",
    includes: CAP_SIMPLE,
    use_for: USE_SIMPLE,
    not_for: "Congelado ao pre\xE7o On-Demand at\xE9 a base ter folga de margem (adenda 3.1).",
    invoice_label: "\xAE [MM] Capturing \u2014 Basic (hour)",
    market: MARKET.capture_hour,
    tags: ["hora", "recorrente"]
  },
  {
    id: "cap-basic-simple-frequency",
    name: "Production | Basic | Simples | Frequency",
    folder: "capture",
    plan: "frequency",
    tier: "simple",
    unit: "hour",
    price: 80,
    crp: 80,
    hours: 1,
    min_margin: 25,
    potential: "review",
    deliverable: "Material bruto captado (1 c\xE2mera, b\xE1sico) para 1 v\xEDdeo curto (30\u201360s). N\xE3o inclui edi\xE7\xE3o.",
    includes: CAP_SIMPLE,
    use_for: USE_SIMPLE,
    not_for: "Pre\xE7o = CRP (margem 0%): bloqueado pela regra 6.1 \u2014 n\xE3o usar em propostas at\xE9 ser corrigido.",
    invoice_label: "\xAE [MM] Capturing \u2014 Basic (hour)",
    market: MARKET.capture_hour,
    tags: ["hora"]
  },
  {
    id: "cap-pro-on-demand",
    name: "Production | PRO | ON-Demand",
    folder: "capture",
    plan: "on_demand",
    tier: "pro",
    unit: "hour",
    price: 114,
    crp: 80,
    hours: 1,
    min_margin: 25,
    potential: "medium",
    deliverable: "Capta\xE7\xE3o PRO por hora \u2014 est\xE9tica cinematogr\xE1fica, maior impacto visual e perce\xE7\xE3o premium de marca.",
    includes: CAP_PRO,
    use_for: USE_PRO,
    not_for: "Mais de 6h no mesmo dia: compare com a Di\xE1ria PRO.",
    invoice_label: "\xAE [MM] Capturing \u2014 PRO (hour)",
    market: MARKET.capture_hour,
    tags: ["hora", "avulso"]
  },
  // ---------- Edição
  {
    id: "edit-day-pro",
    name: "Di\xE1ria Edi\xE7\xE3o | PRO",
    folder: "edit",
    plan: "day",
    tier: "pro",
    unit: "day",
    price: 400,
    crp: 260,
    hours: 4,
    potential: "review",
    deliverable: "Bloco de edi\xE7\xE3o PRO (~4h efetivas): 3\u20134 v\xEDdeos com color grading, sound design e legendas din\xE2micas.",
    includes: EDIT_PRO,
    use_for: ["Lotes de 3\u20134 Reels PRO"],
    not_for: "Margem 35% (abaixo do piso de 50%) \u2014 rever pre\xE7o antes de propor.",
    invoice_label: "\xAE [MM] Post-Production Day \u2014 PRO (4h)",
    market: MARKET.edit_hour,
    tags: ["di\xE1ria", "p\xF3s-produ\xE7\xE3o"]
  },
  {
    id: "edit-day-simple",
    name: "Di\xE1ria Edi\xE7\xE3o | Simples",
    folder: "edit",
    plan: "day",
    tier: "simple",
    unit: "hour",
    price: 122,
    crp: 35,
    hours: 1,
    potential: "high",
    deliverable: "1 v\xEDdeo curto editado (corte seco, trilha b\xE1sica, legendas padr\xE3o). Nome sugere di\xE1ria mas o valor \xE9 o de 1h.",
    includes: EDIT_BASIC,
    use_for: USE_SIMPLE,
    not_for: "Rever nomenclatura (\xE9 1h, n\xE3o di\xE1ria).",
    invoice_label: "\xAE [MM] Post-Production \u2014 Basic (hour)",
    market: MARKET.edit_hour,
    tags: ["edi\xE7\xE3o"]
  },
  {
    id: "edit-pro-frequency",
    name: "Edi\xE7\xE3o | PRO | Frequency (-30%)",
    folder: "edit",
    plan: "frequency",
    tier: "pro",
    unit: "day",
    price: 280,
    crp: 260,
    hours: 4,
    potential: "review",
    deliverable: "Bloco de edi\xE7\xE3o PRO (~4h efetivas) com desconto de recorr\xEAncia de 30% sobre a di\xE1ria.",
    includes: EDIT_PRO,
    use_for: ["Clientes com volume e const\xE2ncia"],
    not_for: "Margem 7%: abaixo do piso \u2014 usar a Di\xE1ria PRO + desconto C (o motor limita ao piso).",
    invoice_label: "\xAE [MM] Post-Production Day \u2014 PRO (recurring)",
    market: MARKET.edit_hour,
    tags: ["recorrente"]
  },
  {
    id: "edit-simple-frequency",
    name: "Edi\xE7\xE3o | Simples | Frequency",
    folder: "edit",
    plan: "frequency",
    tier: "simple",
    unit: "hour",
    price: 85,
    crp: 35,
    hours: 1,
    potential: "high",
    deliverable: "1 v\xEDdeo curto editado, com desconto de recorr\xEAncia de 30%.",
    includes: EDIT_BASIC,
    use_for: ["Clientes com const\xE2ncia e volume"],
    invoice_label: "\xAE [MM] Post-Production \u2014 Basic (recurring)",
    market: MARKET.edit_hour,
    tags: ["recorrente"]
  },
  {
    id: "edit-subtitles",
    name: "Production | Editing - Subtitle [Extra]",
    folder: "edit",
    plan: "extra",
    unit: "item",
    price: 60,
    crp: 15,
    hours: 0.25,
    potential: "high",
    deliverable: "Legendas adicionadas a 1 v\xEDdeo j\xE1 editado.",
    includes: ["Legendas simples sobre v\xEDdeo editado"],
    use_for: ["V\xEDdeos j\xE1 editados sem legendas"],
    invoice_label: "\xAE [MM] Subtitles [Extra]",
    market: MARKET.subtitles,
    tags: ["legendas", "extra"]
  },
  {
    id: "edit-basic",
    name: "Production | Editing Basic",
    folder: "edit",
    plan: "frequency",
    tier: "simple",
    unit: "hour",
    price: 122,
    crp: 35,
    hours: 1,
    potential: "high",
    deliverable: "1 v\xEDdeo curto finalizado (30\u201360s), corte seco, trilha b\xE1sica, legendas padr\xE3o.",
    includes: EDIT_BASIC,
    use_for: [...USE_SIMPLE, "Get ready with me", "Avisos r\xE1pidos"],
    not_for: "Etiquetado como Frequency mas com valor igual ao On-Demand \u2014 rever plano.",
    invoice_label: "\xAE [MM] Post-Production / Reel Basic: - Complete Edit",
    market: MARKET.reel_edit,
    tags: ["reel", "edi\xE7\xE3o"]
  },
  {
    id: "edit-pro",
    name: "Production | Editing PRO",
    folder: "edit",
    plan: "on_demand",
    tier: "pro",
    unit: "item",
    price: 185,
    crp: 65,
    hours: 1,
    potential: "high",
    deliverable: "1 v\xEDdeo finalizado com montagem narrativa, color grading e sound design (grading de 1 v\xEDdeo j\xE1 inclu\xEDdo).",
    includes: EDIT_PRO,
    use_for: USE_PRO,
    not_for: "1 Reel = \u20AC185 direto, nunca somar grading. 2+ Reels com 1 passagem de grading partilhada: regra 10.4.",
    invoice_label: "\xAE [MM] Post-Production / Reel PRO: - Complete Edit",
    market: MARKET.reel_edit,
    tags: ["reel", "edi\xE7\xE3o", "color"]
  },
  // ---------- Reels & pacotes vídeo
  {
    id: "pkg-color-grading",
    name: "Production PRO | Reel adicional [EXTRA] | P\xF3s-produ\xE7\xE3o / Color Grading",
    folder: "video_pkg",
    plan: "extra",
    tier: "pro",
    unit: "item",
    price: 200,
    crp: 50,
    hours: 1,
    potential: "high",
    deliverable: "1 v\xEDdeo com corre\xE7\xE3o de cor e look cinematogr\xE1fico (sem grava\xE7\xE3o/edi\xE7\xE3o base inclu\xEDda).",
    includes: ["Corre\xE7\xE3o de cor", "Look cinematogr\xE1fico", "Consist\xEAncia visual"],
    use_for: ["Material j\xE1 cortado pelo cliente"],
    not_for: "Nunca como linha \xE0 parte quando j\xE1 h\xE1 edi\xE7\xE3o completa no pacote (regra 10).",
    invoice_label: "\xAE [MM] Color Grading [Extra]",
    tags: ["color", "grading", "extra"]
  },
  {
    id: "pkg-basic",
    name: "Production | Basic | PKG",
    folder: "video_pkg",
    plan: "on_demand",
    tier: "simple",
    unit: "item",
    price: 366,
    crp: 105,
    hours: 3,
    potential: "high",
    deliverable: "1 Reel finalizado (30\u201360s), corte limpo, 1 rodada de ajustes \u2014 inclui 1h de capta\xE7\xE3o + 2h de edi\xE7\xE3o Basic.",
    includes: ["1h de capta\xE7\xE3o", "2h de edi\xE7\xE3o Basic", "1 rodada de ajustes"],
    use_for: ["Produto de entrada \u2014 volume", ...USE_SIMPLE],
    invoice_label: "\xAE [MM] Reel Basic \u2014 Capture + Edit",
    market: MARKET.reel,
    tags: ["reel", "pacote", "entrada"]
  },
  {
    id: "pkg-pro",
    name: "Production | PRO | PKG",
    folder: "video_pkg",
    plan: "frequency",
    tier: "pro",
    unit: "item",
    price: 500,
    crp: 175,
    hours: 3,
    potential: "high",
    deliverable: "1 Reel PRO finalizado (capta\xE7\xE3o + edi\xE7\xE3o PRO).",
    includes: ["1h de capta\xE7\xE3o PRO", "2h de edi\xE7\xE3o PRO", "1 rodada de ajustes"],
    use_for: USE_PRO,
    invoice_label: "\xAE [MM] Reel PRO \u2014 Capture + Edit",
    market: MARKET.reel,
    tags: ["reel", "pacote", "premium"]
  },
  {
    id: "pkg-extra-basic",
    name: "Production | Reel adicional [EXTRA] | BASIC",
    folder: "video_pkg",
    plan: "extra",
    tier: "simple",
    unit: "item",
    price: 125,
    crp: 35,
    hours: 1,
    potential: "high",
    deliverable: "1 Reel Basic extra no mesmo ciclo (edi\xE7\xE3o adicional sobre material j\xE1 captado).",
    includes: EDIT_BASIC,
    use_for: ["Mais um Reel do mesmo dia de capta\xE7\xE3o"],
    invoice_label: "\xAE [MM] Additional Reel \u2014 Basic",
    market: MARKET.reel_edit,
    tags: ["reel", "extra"]
  },
  {
    id: "pkg-extra-pro",
    name: "Production | Reel adicional [EXTRA] | PRO",
    folder: "video_pkg",
    plan: "extra",
    tier: "pro",
    unit: "item",
    price: 150,
    crp: 65,
    hours: 1,
    potential: "medium",
    deliverable: "1 Reel PRO extra, adicionado ao mesmo ciclo de produ\xE7\xE3o.",
    includes: EDIT_PRO,
    use_for: ["Mais um Reel PRO do mesmo dia de capta\xE7\xE3o"],
    invoice_label: "\xAE [MM] Additional Reel \u2014 PRO",
    market: MARKET.reel_edit,
    tags: ["reel", "extra"]
  },
  // ---------- Pacotes de foto
  {
    id: "photo-sub-on-demand",
    name: "Assinatura mensal (recorr\xEAncia) | Photos On-Demand",
    folder: "photo_pkg",
    plan: "on_demand",
    unit: "month",
    price: 350,
    crp: 50,
    hours: 2,
    potential: "high",
    deliverable: "1 sess\xE3o de fotos/m\xEAs (2h), 15\u201325 fotos editadas entregues.",
    includes: ["1 sess\xE3o por m\xEAs (2h)", "15\u201325 fotos editadas"],
    use_for: ["Marcas com presen\xE7a social cont\xEDnua"],
    invoice_label: "\xAE [MM] Monthly Photo Session (2h)",
    tags: ["assinatura", "mensal"]
  },
  {
    id: "photo-sub-frequency",
    name: "Assinatura mensal (recorr\xEAncia) | Photos - Frequency",
    folder: "photo_pkg",
    plan: "frequency",
    unit: "month",
    price: 350,
    crp: 50,
    hours: 2,
    potential: "review",
    deliverable: "1 sess\xE3o/m\xEAs, 15\u201325 fotos. Frequency sem desconto \u2014 rever r\xF3tulo (j\xE1 \xE9 o produto de maior margem).",
    includes: ["1 sess\xE3o por m\xEAs (2h)", "15\u201325 fotos editadas"],
    use_for: ["Contratos \u22653 meses"],
    invoice_label: "\xAE [MM] Monthly Photo Session (2h) \u2014 recurring",
    tags: ["assinatura", "recorrente"]
  },
  {
    id: "photo-brand-library",
    name: "Banco de imagens da marca",
    folder: "photo_pkg",
    plan: "package",
    unit: "item",
    price: 250,
    crp: 112,
    hours: 4,
    potential: "medium",
    deliverable: "Sess\xE3o dedicada (~4h) para acervo de imagens de marca (uso interno/social cont\xEDnuo).",
    includes: ["Sess\xE3o de ~4h", "Acervo de imagens da marca"],
    use_for: ["Empresas \u2014 muito comum"],
    not_for: "Margem 55% e \u20AC62,5/h: abaixo do benchmark de fotografia \u2014 rever.",
    invoice_label: "\xAE [MM] Brand Image Library Session",
    tags: ["acervo", "banco de imagens"]
  },
  // ---------- Fotografia
  {
    id: "photo-event-frequency",
    name: "Corporative Events Shooting | Frequency",
    folder: "photo",
    plan: "frequency",
    unit: "hour",
    price: 130,
    crp: 30,
    hours: 1,
    potential: "review",
    deliverable: "Cobertura de evento corporativo, ~25 fotos editadas por hora (75 em 3h).",
    includes: ["Cobertura profissional do evento", "~25 fotos editadas/h"],
    use_for: ["Eventos empresariais", "Websites e LinkedIn"],
    not_for: "Frequency sem desconto face ao On-Demand \u2014 rever.",
    invoice_label: "\xAE [MM] Corporate Event Photography (hour)",
    market: MARKET.photo_event,
    tags: ["evento", "corporate"],
    notes: "Uso comercial ampliado (campanhas, ads, internacional): +20% a +40%."
  },
  {
    id: "photo-event-on-demand",
    name: "Corporative Events Shooting | On Demand",
    folder: "photo",
    plan: "on_demand",
    unit: "hour",
    price: 130,
    crp: 30,
    hours: 1,
    potential: "high",
    deliverable: "Cobertura de evento corporativo, ~25 fotos editadas por hora (75 em 3h).",
    includes: ["Cobertura profissional do evento", "~25 fotos editadas/h"],
    use_for: ["Eventos empresariais", "Websites e LinkedIn"],
    invoice_label: "\xAE [MM] Corporate Event Photography (hour)",
    market: MARKET.photo_event,
    tags: ["evento", "corporate"],
    notes: "Uso comercial ampliado (campanhas, ads, internacional): +20% a +40%."
  },
  {
    id: "photo-corporate-frequency",
    name: "Corporative Shooting | Frequency",
    folder: "photo",
    plan: "frequency",
    unit: "hour",
    price: 130,
    crp: 30,
    hours: 1,
    potential: "review",
    deliverable: "Sess\xE3o corporativa (1h), ~8 fotos editadas.",
    includes: ["Dire\xE7\xE3o", "Enquadramento", "Consist\xEAncia visual", "8 fotos editadas/h"],
    use_for: ["Empresas", "Profissionais", "Websites e LinkedIn"],
    not_for: "Frequency sem desconto \u2014 rever.",
    invoice_label: "\xAE [MM] Corporate Photography (hour)",
    market: MARKET.photo_hour,
    tags: ["retrato", "corporate"]
  },
  {
    id: "photo-corporate-on-demand",
    name: "Corporative Shooting | On-Demand",
    folder: "photo",
    plan: "on_demand",
    unit: "hour",
    price: 130,
    crp: 30,
    hours: 1,
    potential: "high",
    deliverable: "Sess\xE3o corporativa (1h), ~8 fotos editadas.",
    includes: ["Dire\xE7\xE3o", "Enquadramento", "Consist\xEAncia visual", "8 fotos editadas/h"],
    use_for: ["Empresas", "Profissionais", "Websites e LinkedIn"],
    invoice_label: "\xAE [MM] Corporate Photography (hour)",
    market: MARKET.photo_hour,
    tags: ["retrato", "corporate"]
  },
  {
    id: "photo-extra",
    name: "Photo [Extra]",
    folder: "photo",
    plan: "extra",
    unit: "item",
    price: 15,
    crp: 2.5,
    hours: 0.1,
    potential: "high",
    deliverable: "1 foto adicional editada, sem nova sess\xE3o de capta\xE7\xE3o.",
    includes: ["Edi\xE7\xE3o de 1 foto j\xE1 captada"],
    use_for: ["Cliente quer mais fotos da mesma sess\xE3o"],
    invoice_label: "\xAE [MM] Additional Edited Photo",
    tags: ["foto", "extra"]
  },
  {
    id: "photo-editing-frequency",
    name: "Photo Editing | Frequency",
    folder: "photo",
    plan: "frequency",
    unit: "hour",
    price: 122,
    crp: 20,
    hours: 1,
    potential: "review",
    deliverable: "Edi\xE7\xE3o de at\xE9 10 fotos j\xE1 capturadas (n\xEDvel profissional).",
    includes: ["1h = at\xE9 10 fotos", "Acima disso: hora extra ou pacote"],
    use_for: ["Fotos j\xE1 captadas"],
    not_for: "Frequency sem desconto \u2014 rever.",
    invoice_label: "\xAE [MM] Photo Editing (hour, up to 10 photos)",
    market: MARKET.photo_hour,
    tags: ["edi\xE7\xE3o", "foto"]
  },
  {
    id: "photo-editing-on-demand",
    name: "Photo Editing | On Demand",
    folder: "photo",
    plan: "on_demand",
    unit: "hour",
    price: 122,
    crp: 20,
    hours: 1,
    potential: "high",
    deliverable: "Edi\xE7\xE3o de at\xE9 10 fotos j\xE1 capturadas (n\xEDvel profissional).",
    includes: ["1h = at\xE9 10 fotos", "Acima disso: hora extra ou pacote"],
    use_for: ["Fotos j\xE1 captadas"],
    invoice_label: "\xAE [MM] Photo Editing (hour, up to 10 photos)",
    market: MARKET.photo_hour,
    tags: ["edi\xE7\xE3o", "foto"]
  },
  {
    id: "photo-express",
    name: "Photo Express Delivery [Extra]",
    folder: "photo",
    plan: "extra",
    unit: "item",
    price: 80,
    crp: 20,
    hours: 0.5,
    potential: "high",
    deliverable: "Entrega priorit\xE1ria em 24\u201348h da mesma sess\xE3o.",
    includes: ["Entrega em 24\u201348h"],
    use_for: ["Prazos curtos"],
    invoice_label: "\xAE [MM] Express Delivery 24\u201348h [Extra]",
    tags: ["urgente", "extra"]
  },
  {
    id: "photo-retouch",
    name: "Photo Retouch [Extra]",
    folder: "photo",
    plan: "extra",
    unit: "item",
    price: 30,
    crp: 7.5,
    hours: 0.25,
    potential: "high",
    deliverable: "Retoque avan\xE7ado (pele, remo\xE7\xE3o de objetos) em 1 foto.",
    includes: ["Pele", "Remo\xE7\xE3o de objetos", "Ajustes finos"],
    use_for: ["Retratos e produto"],
    invoice_label: "\xAE [MM] Advanced Retouch (per photo)",
    market: MARKET.retouch,
    tags: ["retoque", "extra"]
  },
  {
    id: "photo-shooting-frequency",
    name: "Shooting | frequency",
    folder: "photo",
    plan: "frequency",
    unit: "hour",
    price: 122,
    crp: 25,
    hours: 1,
    potential: "review",
    deliverable: "Sess\xE3o de retrato/branding pessoal (1h), 10\u201320 fotos editadas.",
    includes: ["10\u201320 fotos editadas/h"],
    use_for: ["Conte\xFAdo social", "Retratos simples", "Branding pessoal"],
    not_for: "Frequency sem desconto \u2014 rever.",
    invoice_label: "\xAE [MM] Photo Session (hour)",
    market: MARKET.photo_hour,
    tags: ["retrato", "branding"]
  },
  {
    id: "photo-shooting-on-demand",
    name: "Shooting | On-Demand",
    folder: "photo",
    plan: "on_demand",
    unit: "hour",
    price: 122,
    crp: 25,
    hours: 1,
    potential: "high",
    deliverable: "Sess\xE3o de retrato/branding pessoal (1h), 10\u201320 fotos editadas.",
    includes: ["10\u201320 fotos editadas/h"],
    use_for: ["Conte\xFAdo social", "Retratos simples", "Branding pessoal"],
    invoice_label: "\xAE [MM] Photo Session (hour)",
    market: MARKET.photo_hour,
    tags: ["retrato", "branding"]
  },
  // ---------- Pré-produção & logística
  {
    id: "travel-frequency",
    name: "Deslocamento | Frequency",
    folder: "preprod",
    plan: "frequency",
    unit: "trip",
    price: 150,
    crp: 150,
    hours: 0,
    pass_through: true,
    potential: "passthrough",
    deliverable: "Deslocamento at\xE9 ao local \u2014 custo real (\u20AC0,40/km + parking), sem margem.",
    includes: ["\u20AC0,40/km", "Parking ao valor real"],
    use_for: ["Produ\xE7\xF5es fora de Amsterd\xE3o"],
    not_for: "Agrupe produ\xE7\xF5es no mesmo dia para reduzir desloca\xE7\xF5es.",
    invoice_label: "\xAE [MM] Travel (\u20AC0.40/km + parking)",
    kind: "travel",
    tags: ["km", "transporte"]
  },
  {
    id: "travel-on-demand",
    name: "Deslocamento | On Demand",
    folder: "preprod",
    plan: "on_demand",
    unit: "trip",
    price: 150,
    crp: 150,
    hours: 0,
    pass_through: true,
    potential: "passthrough",
    deliverable: "Deslocamento at\xE9 ao local \u2014 custo real (\u20AC0,40/km + parking), sem margem.",
    includes: ["\u20AC0,40/km", "Parking ao valor real"],
    use_for: ["Produ\xE7\xF5es fora de Amsterd\xE3o"],
    invoice_label: "\xAE [MM] Travel (\u20AC0.40/km + parking)",
    kind: "travel",
    tags: ["km", "transporte"]
  },
  {
    id: "strategy-frequency",
    name: "Estrat\xE9gia / Roteiro | Frequency",
    folder: "preprod",
    plan: "frequency",
    unit: "hour",
    price: 150,
    crp: 45,
    hours: 1,
    potential: "review",
    deliverable: "1 roteiro curto ou estrutura de conte\xFAdo entregue por escrito.",
    includes: ["Roteiro", "Estrutura narrativa", "Planeamento de conte\xFAdo", "Dire\xE7\xE3o criativa"],
    use_for: ["Antes de cada ciclo de capta\xE7\xE3o"],
    not_for: "Frequency sem desconto \u2014 rever. Upsell: planeamento mensal \u20AC300\u2013600; campanha \u20AC500+.",
    invoice_label: "\xAE [MM] Strategy / Script (hour)",
    kind: "strategy",
    tags: ["roteiro", "estrat\xE9gia"]
  },
  {
    id: "strategy-on-demand",
    name: "Estrat\xE9gia / Roteiro | On Demand",
    folder: "preprod",
    plan: "on_demand",
    unit: "hour",
    price: 150,
    crp: 45,
    hours: 1,
    potential: "high",
    deliverable: "1 roteiro curto ou estrutura de conte\xFAdo entregue por escrito.",
    includes: ["Roteiro", "Estrutura narrativa", "Planeamento de conte\xFAdo", "Dire\xE7\xE3o criativa"],
    use_for: ["Antes de cada ciclo de capta\xE7\xE3o"],
    not_for: "Upsell: planeamento mensal \u20AC300\u2013600; estrat\xE9gia de campanha \u20AC500+.",
    invoice_label: "\xAE [MM] Strategy / Script (hour)",
    kind: "strategy",
    tags: ["roteiro", "estrat\xE9gia"]
  }
];
var SEED_SERVICES = RAW.map((r) => normalizeService({ ...r, source: { notion: NOTION } }));

// scripts/boat-build.ts
var src = JSON.parse(readFileSync("proposals/boat-event-2026-11-14.json", "utf8"));
var p = applyPricing(normalizeProposal(src), SEED_SERVICES);
var s = pricingSummary(p.pricing, SEED_SERVICES);
p.notes = `Estimated proposal for M\xF3nica. Packages: ${s.packages.map((k) => `${k.name} \u20AC${k.quote.subtotal.toFixed(2)}`).join(" \xB7 ")} excl. BTW (recommended: Essential + Social). Production \u20AC${s.production.subtotal.toFixed(2)} + highlight film = base \u20AC${s.base.subtotal.toFixed(2)}. Loose extras: ${s.extras.map((e) => `${e.line.label} +\u20AC${e.price.toFixed(2)}`).join(" \xB7 ")}. Prices from the XMEDIA services catalogue; travel estimated at cost. 3h on location chosen for best value: ~30 min set-up + 2h30 event; extra hour offered as an option.`;
var { created_at: _c, updated_at: _u, ...out } = p;
writeFileSync("proposals/boat-event-2026-11-14.json", JSON.stringify(out, null, 2));
writeFileSync("lib/bundled/boat-event.json", JSON.stringify(out));
console.log(JSON.stringify({ base: [s.production.subtotal, s.base.subtotal, s.base.total], extras: s.extras.map((e) => [e.line.label, e.price]), full: s.full.subtotal, warn: s.full.warnings, slides: p.doc.slides.map((x) => x.id) }));
