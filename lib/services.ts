// Catálogo de serviços MediaMarques: modelo, pastas, regras de preço editáveis, motor de orçamento
// (descontos A/B/C + parceiro, teto 35%, piso de margem, urgência), banda de mercado, médias e pesquisa.
// Funções puras (testadas em services.test.ts). Fonte dos dados iniciais: Notion "MM - Program Worksheet".
import { resolveBtw } from "./invoice";

export type ServiceUnit = "hour" | "day" | "item" | "session" | "month" | "trip";
export type ServicePlan = "on_demand" | "frequency" | "day" | "extra" | "package";
export type ServiceTier = "simple" | "pro";
export type Potential = "high" | "medium" | "review" | "passthrough";
/** Família de desconto: decide que tabelas (A horas, B volume de reels, C recorrência) se aplicam. */
export type ServiceKind = "capture" | "edit" | "reel" | "photo" | "strategy" | "travel";

export type MarketBand = { low: number; high: number; per: "hour" | "day" | "item" | "month"; label: string; sources: string[] };

export type ServiceChange = { at: string; by?: string; field: string; from: string; to: string };

export type Service = {
  id: string;
  name: string;
  folder: string; // id de ServiceFolder
  kind: ServiceKind;
  plan: ServicePlan | null;
  tier: ServiceTier | null;
  unit: ServiceUnit;
  price: number; // preço ao cliente por unidade (excl. BTW)
  crp: number; // custo real de produção por unidade
  hours: number; // horas efetivas por unidade (0 = sem tempo, ex.: deslocamento)
  min_margin: number; // % — piso desta linha (50 produção própria, 25 captação/parceiro, 0 repasse)
  pass_through: boolean; // repasse puro (deslocamento): sem margem nem desconto
  potential: Potential;
  deliverable: string; // "Entregável válido"
  includes: string[];
  use_for: string[]; // indicado para
  not_for: string; // quando NÃO usar / alternativa
  notes: string;
  invoice_label: string; // texto da linha no PDF/invoice (EN)
  market: MarketBand | null;
  tags: string[];
  uses: number; // vezes usado em orçamentos guardados
  archived: boolean;
  source?: { notion?: string };
  history: ServiceChange[];
  created_at?: string;
  updated_at?: string;
};

export type ServiceFolder = { id: string; label: string; color: string; order: number; hint: string };

export type Tier = { min: number; pct: number };
export type PricingRules = {
  hours_tiers: Tier[]; // A — por horas da linha (mesmo dia/local)
  hours_on_capture: boolean; // A suspensa na captação enquanto a base estiver no piso (adenda 3.1)
  volume_tiers: Tier[]; // B — por nº de reels/entregáveis de edição no orçamento
  recurring: { months: number; pct: number }[]; // C — contrato Frequency
  partner_pct: number; // desconto de parceiro (editável)
  cap_pct: number; // teto da soma dos descontos
  floor_margin: number; // piso por defeito (produção própria)
  target_margin: number; // margem-alvo para itens novos: preço = CRP ÷ (1 − alvo)
  healthy: [number, number]; // banda saudável
  rush_pct: number; // urgência/same-day sobre linhas de edição
  btw: number;
  deposit_pct: number;
  updated_at?: string;
};

export const DEFAULT_RULES: PricingRules = {
  hours_tiers: [
    { min: 1, pct: 0 },
    { min: 4, pct: 8 },
    { min: 8, pct: 15 },
    { min: 16, pct: 20 },
  ],
  hours_on_capture: false,
  volume_tiers: [
    { min: 1, pct: 0 },
    { min: 4, pct: 8 },
    { min: 8, pct: 12 },
    { min: 13, pct: 18 },
  ],
  recurring: [
    { months: 3, pct: 10 },
    { months: 6, pct: 18 },
    { months: 12, pct: 25 },
  ],
  partner_pct: 10,
  cap_pct: 35,
  floor_margin: 50,
  target_margin: 65,
  healthy: [60, 75],
  rush_pct: 125,
  btw: 21,
  deposit_pct: 50,
};

export const DEFAULT_FOLDERS: ServiceFolder[] = [
  { id: "capture", label: "Captação de vídeo", color: "#ff5a1f", order: 1, hint: "Horas e diárias de filmagem — material bruto, sem edição." },
  { id: "edit", label: "Edição de vídeo", color: "#7c5cff", order: 2, hint: "Edição Basic/PRO, diárias de edição, legendas." },
  { id: "video_pkg", label: "Reels & pacotes vídeo", color: "#ffb020", order: 3, hint: "Captação + edição num preço fechado; reels extra." },
  { id: "photo", label: "Fotografia", color: "#1fb6ff", order: 4, hint: "Sessões, eventos, edição e extras de foto." },
  { id: "photo_pkg", label: "Pacotes de foto", color: "#13c296", order: 5, hint: "Assinaturas mensais e banco de imagens da marca." },
  { id: "preprod", label: "Pré-produção & logística", color: "#8a8f98", order: 6, hint: "Estratégia, roteiro e deslocamento." },
];

export const KIND_OF_FOLDER: Record<string, ServiceKind> = { capture: "capture", edit: "edit", video_pkg: "reel", photo: "photo", photo_pkg: "photo", preprod: "strategy" };
export const UNIT_HOURS_DEFAULT: Record<ServiceUnit, number> = { hour: 1, day: 6, item: 1, session: 2, month: 2, trip: 0 };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && v.trim() && isFinite(+v) ? +v : d);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x: string) => x.trim()) : typeof v === "string" ? v.split(/\n|;/).map((x) => x.replace(/^[•\-\s]+/, "").trim()).filter(Boolean) : []);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || uid();

const UNITS = ["hour", "day", "item", "session", "month", "trip"] as const;
const PLANS = ["on_demand", "frequency", "day", "extra", "package"] as const;
const KINDS = ["capture", "edit", "reel", "photo", "strategy", "travel"] as const;
const POTS = ["high", "medium", "review", "passthrough"] as const;

/** Aceita dados parciais (JSON importado, MCP, Supabase) e devolve um serviço válido. */
export function normalizeService(x: Partial<Service> & Record<string, unknown>, folders: ServiceFolder[] = DEFAULT_FOLDERS): Service {
  const name = str(x.name).trim() || "Novo serviço";
  const folder = folders.some((f) => f.id === x.folder) ? String(x.folder) : str(x.folder) ? str(x.folder) : folders[0]?.id ?? "capture";
  const unit = oneOf(x.unit, UNITS, "hour");
  const pass = Boolean(x.pass_through);
  const kind = oneOf(x.kind, KINDS, pass ? "travel" : KIND_OF_FOLDER[folder] ?? "strategy");
  const m = x.market as MarketBand | null | undefined;
  return {
    id: str(x.id) || slug(name),
    name,
    folder,
    kind,
    plan: x.plan == null || (x.plan as string) === "" ? null : oneOf(x.plan, PLANS, "on_demand"),
    tier: x.tier === "simple" || x.tier === "pro" ? x.tier : null,
    unit,
    price: Math.max(0, round2(num(x.price))),
    crp: Math.max(0, round2(num(x.crp))),
    hours: Math.max(0, num(x.hours, UNIT_HOURS_DEFAULT[unit])),
    min_margin: Math.min(95, Math.max(0, num(x.min_margin, pass ? 0 : kind === "capture" ? 25 : DEFAULT_RULES.floor_margin))),
    pass_through: pass,
    potential: oneOf(x.potential, POTS, pass ? "passthrough" : "medium"),
    deliverable: str(x.deliverable),
    includes: strs(x.includes),
    use_for: strs(x.use_for),
    not_for: str(x.not_for),
    notes: str(x.notes),
    invoice_label: str(x.invoice_label) || `® [MM] ${name}`,
    market: m && isFinite(+m.low) && isFinite(+m.high) && +m.high > 0 ? { low: +m.low, high: +m.high, per: oneOf(m.per, ["hour", "day", "item", "month"] as const, "hour"), label: str(m.label), sources: strs(m.sources) } : null,
    tags: strs(x.tags),
    uses: Math.max(0, Math.round(num(x.uses))),
    archived: Boolean(x.archived),
    source: x.source && typeof x.source === "object" ? (x.source as Service["source"]) : undefined,
    history: Array.isArray(x.history) ? (x.history as ServiceChange[]).slice(-30) : [],
    created_at: str(x.created_at) || undefined,
    updated_at: str(x.updated_at) || undefined,
  };
}

export function normalizeRules(x: Partial<PricingRules> | null | undefined): PricingRules {
  const d = DEFAULT_RULES;
  const tiers = (v: unknown, def: Tier[]) =>
    Array.isArray(v) && v.length ? (v as Tier[]).map((t) => ({ min: Math.max(0, num(t.min)), pct: Math.min(100, Math.max(0, num(t.pct))) })).sort((a, b) => a.min - b.min) : def;
  return {
    hours_tiers: tiers(x?.hours_tiers, d.hours_tiers),
    hours_on_capture: x?.hours_on_capture ?? d.hours_on_capture,
    volume_tiers: tiers(x?.volume_tiers, d.volume_tiers),
    recurring:
      Array.isArray(x?.recurring) && x.recurring.length
        ? x.recurring.map((r) => ({ months: Math.max(1, Math.round(num(r.months))), pct: Math.min(100, Math.max(0, num(r.pct))) })).sort((a, b) => a.months - b.months)
        : d.recurring,
    partner_pct: Math.min(100, Math.max(0, num(x?.partner_pct, d.partner_pct))),
    cap_pct: Math.min(100, Math.max(0, num(x?.cap_pct, d.cap_pct))),
    floor_margin: Math.min(95, Math.max(0, num(x?.floor_margin, d.floor_margin))),
    target_margin: Math.min(95, Math.max(1, num(x?.target_margin, d.target_margin))),
    healthy: Array.isArray(x?.healthy) && x.healthy.length === 2 ? [num(x.healthy[0], 60), num(x.healthy[1], 75)] : d.healthy,
    rush_pct: Math.max(0, num(x?.rush_pct, d.rush_pct)),
    btw: Math.max(0, num(x?.btw, d.btw)),
    deposit_pct: Math.min(100, Math.max(0, num(x?.deposit_pct, d.deposit_pct))),
    updated_at: x?.updated_at,
  };
}

// ---------------------------------------------------------------- análise de um serviço

/** Margem real = (preço − CRP) ÷ preço, em %. */
export const marginOf = (price: number, crp: number) => (price > 0 ? round2(((price - crp) / price) * 100) : 0);
/** €/h real (preço por unidade ÷ horas efetivas por unidade). */
export const hourlyOf = (s: Pick<Service, "price" | "hours">) => (s.hours > 0 ? round2(s.price / s.hours) : null);
/** Preço sugerido para a margem-alvo: CRP ÷ (1 − alvo). */
export const priceForMargin = (crp: number, marginPct: number) => (marginPct >= 100 ? 0 : round2(crp / (1 - marginPct / 100)));

export type MarginVerdict = "blocked" | "below_floor" | "tight" | "healthy" | "premium" | "passthrough";
export function verdict(s: Pick<Service, "price" | "crp" | "min_margin" | "pass_through">, rules: PricingRules = DEFAULT_RULES): MarginVerdict {
  if (s.pass_through) return "passthrough";
  if (s.price <= s.crp) return "blocked";
  const m = marginOf(s.price, s.crp);
  if (m < s.min_margin) return "below_floor";
  if (m < rules.healthy[0]) return "tight";
  if (m <= rules.healthy[1]) return "healthy";
  return "premium";
}

/** Valor do serviço comparável à banda de mercado (por hora, por dia, por item ou por mês). */
export function comparableValue(s: Service): number | null {
  if (!s.market) return null;
  if (s.market.per === "hour") return hourlyOf(s);
  if (s.market.per === "day") return s.unit === "day" ? s.price : s.hours > 0 ? round2((s.price / s.hours) * 6) : null;
  return s.price;
}

export type MarketSegment = "below" | "entry" | "mid" | "premium" | "luxury";
export const SEGMENTS: { id: MarketSegment; from: number; to: number }[] = [
  { id: "entry", from: 0, to: 25 },
  { id: "mid", from: 25, to: 60 },
  { id: "premium", from: 60, to: 85 },
  { id: "luxury", from: 85, to: 100 },
];
/** Posição na banda: 0% = mínimo de mercado, 100% = máximo; fatia (segmento) de mercado. */
export function marketPosition(s: Service): { value: number; pct: number; segment: MarketSegment; delta_low: number; mid: number } | null {
  const v = comparableValue(s);
  if (!s.market || v == null) return null;
  const { low, high } = s.market;
  const pct = high > low ? round2(((v - low) / (high - low)) * 100) : 50;
  const segment: MarketSegment = pct < 0 ? "below" : pct >= 100 ? "luxury" : (SEGMENTS.find((x) => pct >= x.from && pct < x.to)?.id ?? "luxury");
  return { value: v, pct, segment, delta_low: round2(v - low), mid: round2((low + high) / 2) };
}

// ---------------------------------------------------------------- orçamento / calculadora

export type QuoteLineInput = { service_id: string; qty: number; label?: string; price_override?: number | null };
export type QuoteInput = {
  client: { name: string; company?: string; email?: string; country?: string; customer_id?: string | null };
  lines: QuoteLineInput[];
  partner: boolean;
  recurring_months: number; // 0 = avulso (On-Demand)
  rush: boolean;
  extra_discount_pct?: number; // condição especial manual (conta para o teto)
  note?: string;
};

export type LineDiscounts = { hours: number; volume: number; recurring: number; partner: number; extra: number };
export type QuoteLine = {
  service: Service;
  label: string;
  qty: number;
  hours: number; // horas da linha (qty × horas/unidade)
  unit_price: number; // preço base por unidade (com urgência)
  gross: number;
  discounts: LineDiscounts;
  requested_pct: number; // soma pedida
  applied_pct: number; // depois do teto e do piso
  capped: boolean;
  floor_limited: boolean;
  net: number;
  unit_net: number;
  crp: number;
  margin: number;
  blocked: boolean;
  rush: number; // acréscimo de urgência (€)
};
export type QuoteResult = {
  lines: QuoteLine[];
  gross: number;
  discount: number;
  subtotal: number;
  btw: number;
  total: number;
  deposit: number;
  crp: number;
  margin: number;
  hours: number;
  reels: number;
  recurring_pct: number;
  btw_rate: number;
  months: number;
  contract_total: number; // subtotal × meses (Frequency)
  warnings: { code: string; line?: string; detail?: string }[];
};

const tierPct = (tiers: Tier[], n: number) => tiers.reduce((p, t) => (n >= t.min ? t.pct : p), 0);
export const recurringPct = (rules: PricingRules, months: number) => rules.recurring.reduce((p, r) => (months >= r.months ? r.pct : p), 0);
const isReel = (s: Service) => (s.kind === "edit" || s.kind === "reel") && (s.unit === "item" || s.unit === "hour");

/** Calcula o orçamento linha a linha. Regras: A (horas), B (reels), C (recorrência), parceiro, extra; teto; piso de margem; urgência. */
export function quote(input: QuoteInput, catalog: Service[], rulesIn?: Partial<PricingRules>): QuoteResult {
  const rules = normalizeRules(rulesIn);
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const warnings: QuoteResult["warnings"] = [];
  const picked = input.lines
    .map((l) => ({ l, s: byId.get(l.service_id) }))
    .filter((x): x is { l: QuoteLineInput; s: Service } => {
      if (!x.s) warnings.push({ code: "unknown_service", detail: x.l.service_id });
      return Boolean(x.s) && num(x.l.qty) > 0;
    });
  const reels = picked.filter((x) => isReel(x.s)).reduce((n, x) => n + (x.s.unit === "item" ? num(x.l.qty) : Math.ceil(num(x.l.qty) * (x.s.hours || 1))), 0);
  const volPct = tierPct(rules.volume_tiers, reels);
  const months = Math.max(0, Math.round(num(input.recurring_months)));
  const recPct = recurringPct(rules, months);
  const extra = Math.min(100, Math.max(0, num(input.extra_discount_pct)));

  const lines: QuoteLine[] = picked.map(({ l, s }) => {
    const qty = num(l.qty);
    const hours = round2(qty * s.hours);
    const base = l.price_override != null && isFinite(+l.price_override) ? +l.price_override : s.price;
    const rushAdd = input.rush && (s.kind === "edit" || s.kind === "reel") && !s.pass_through ? round2((base * rules.rush_pct) / 100) : 0;
    const unit_price = round2(base + rushAdd);
    const gross = round2(unit_price * qty);
    const crp = round2(s.crp * qty);
    const d: LineDiscounts = { hours: 0, volume: 0, recurring: 0, partner: 0, extra: 0 };
    if (!s.pass_through) {
      if (s.unit !== "item" && (s.kind !== "capture" || rules.hours_on_capture) && s.kind !== "travel") d.hours = tierPct(rules.hours_tiers, hours);
      if (isReel(s)) d.volume = volPct;
      d.recurring = recPct;
      d.partner = input.partner ? rules.partner_pct : 0;
      d.extra = extra;
    }
    const requested = d.hours + d.volume + d.recurring + d.partner + d.extra;
    let applied = Math.min(requested, rules.cap_pct);
    const capped = requested > rules.cap_pct;
    // piso: preço × (1 − d) × (1 − piso) ≥ CRP
    let floor_limited = false;
    if (!s.pass_through && gross > 0 && applied > 0) {
      const maxD = Math.max(0, (1 - crp / (gross * (1 - s.min_margin / 100))) * 100);
      if (applied > maxD) {
        applied = Math.floor(maxD * 10) / 10;
        floor_limited = true;
      }
    }
    const net = round2(gross * (1 - applied / 100));
    const blocked = !s.pass_through && net <= crp && gross > 0;
    if (capped) warnings.push({ code: "capped", line: s.id });
    if (floor_limited) warnings.push({ code: "floor_limited", line: s.id });
    if (blocked) warnings.push({ code: "blocked", line: s.id });
    else if (!s.pass_through && marginOf(net, crp) < s.min_margin) warnings.push({ code: "below_floor", line: s.id });
    return {
      service: s,
      label: l.label || s.invoice_label,
      qty,
      hours,
      unit_price,
      gross,
      discounts: d,
      requested_pct: round2(requested),
      applied_pct: round2(applied),
      capped,
      floor_limited,
      net,
      unit_net: qty ? round2(net / qty) : 0,
      crp,
      margin: marginOf(net, crp),
      blocked,
      rush: round2(rushAdd * qty),
    };
  });

  const gross = round2(lines.reduce((s, l) => s + l.gross, 0));
  const subtotal = round2(lines.reduce((s, l) => s + l.net, 0));
  const crp = round2(lines.reduce((s, l) => s + l.crp, 0));
  // NL (ou país em branco) → taxa das regras; UE → 0% reverse charge; fora da UE → sem BTW
  const country = (input.client.country || "NL").toUpperCase();
  const btwRate = country === "NL" ? rules.btw : resolveBtw("auto", country).rate;
  const btw = round2((subtotal * btwRate) / 100);
  const total = round2(subtotal + btw);
  if (months > 0 && recPct === 0) warnings.push({ code: "recurring_short", detail: String(rules.recurring[0]?.months ?? 3) });
  return {
    lines,
    gross,
    discount: round2(gross - subtotal),
    subtotal,
    btw,
    total,
    deposit: round2((total * rules.deposit_pct) / 100),
    crp,
    margin: marginOf(subtotal, crp),
    hours: round2(lines.reduce((s, l) => s + l.hours, 0)),
    reels,
    recurring_pct: recPct,
    btw_rate: btwRate,
    months,
    contract_total: months > 0 ? round2(subtotal * months) : subtotal,
    warnings,
  };
}

/** Simulação de um serviço por N horas (ou unidades): converte horas em unidades conforme a unidade do serviço. */
export function unitsForHours(s: Service, hours: number) {
  if (s.unit === "hour" || s.hours <= 0) return hours;
  return Math.max(1, Math.ceil(hours / s.hours));
}

// ---------------------------------------------------------------- catálogo: médias, popularidade, pesquisa

export function folderStats(services: Service[], folders: ServiceFolder[] = DEFAULT_FOLDERS) {
  return folders
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((f) => {
      const list = services.filter((s) => s.folder === f.id && !s.archived);
      const priced = list.filter((s) => !s.pass_through && s.price > 0);
      const hourly = priced.map(hourlyOf).filter((x): x is number => x != null);
      return {
        folder: f,
        count: list.length,
        avg_price: priced.length ? round2(priced.reduce((s, x) => s + x.price, 0) / priced.length) : 0,
        avg_hourly: hourly.length ? round2(hourly.reduce((s, x) => s + x, 0) / hourly.length) : 0,
        avg_margin: priced.length ? round2(priced.reduce((s, x) => s + marginOf(x.price, x.crp), 0) / priced.length) : 0,
        min: priced.length ? Math.min(...priced.map((x) => x.price)) : 0,
        max: priced.length ? Math.max(...priced.map((x) => x.price)) : 0,
        review: list.filter((s) => s.potential === "review" || ["blocked", "below_floor"].includes(verdict(s))).length,
      };
    });
}

export function catalogStats(services: Service[], rules: PricingRules = DEFAULT_RULES) {
  const live = services.filter((s) => !s.archived);
  const priced = live.filter((s) => !s.pass_through && s.price > 0);
  const v = priced.map((s) => verdict(s, rules));
  const hourly = priced.map(hourlyOf).filter((x): x is number => x != null);
  const pos = live.map(marketPosition).filter((x): x is NonNullable<ReturnType<typeof marketPosition>> => x != null);
  return {
    count: live.length,
    avg_price: priced.length ? round2(priced.reduce((s, x) => s + x.price, 0) / priced.length) : 0,
    avg_hourly: hourly.length ? round2(hourly.reduce((s, x) => s + x, 0) / hourly.length) : 0,
    avg_margin: priced.length ? round2(priced.reduce((s, x) => s + marginOf(x.price, x.crp), 0) / priced.length) : 0,
    verdicts: { blocked: 0, below_floor: 0, tight: 0, healthy: 0, premium: 0, passthrough: 0, ...Object.fromEntries((["blocked", "below_floor", "tight", "healthy", "premium"] as const).map((k) => [k, v.filter((x) => x === k).length])) } as Record<MarginVerdict, number>,
    market: { compared: pos.length, below: pos.filter((p) => p.segment === "below").length, avg_pct: pos.length ? round2(pos.reduce((s, p) => s + p.pct, 0) / pos.length) : 0 },
    review: live.filter((s) => s.potential === "review").length,
  };
}

const POT_W: Record<Potential, number> = { high: 3, medium: 2, review: 1, passthrough: 0 };
/** Mais requisitados: uso real em orçamentos primeiro, depois potencial de saída (Notion). */
export function popular(services: Service[], n = 6) {
  return services
    .filter((s) => !s.archived && !s.pass_through)
    .slice()
    .sort((a, b) => b.uses - a.uses || POT_W[b.potential] - POT_W[a.potential] || Number(b.plan === "on_demand" || b.plan === "day" || b.plan === "package") - Number(a.plan === "on_demand" || a.plan === "day" || a.plan === "package") || b.price - a.price)
    .slice(0, n);
}

/** Alternativas para decidir "é este ou outro?": mesma pasta e mesmo tipo, ordenadas por preço. */
export function alternatives(s: Service, services: Service[]) {
  return services
    .filter((x) => x.id !== s.id && !x.archived && (x.folder === s.folder || x.kind === s.kind))
    .sort((a, b) => Number(b.folder === s.folder) - Number(a.folder === s.folder) || a.price - b.price)
    .slice(0, 6);
}

export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Pesquisa global do catálogo: todos os termos têm de aparecer; nome pesa mais. Aceita "€100", "<150", ">200", "pro", "frequency". */
export function searchServices(services: Service[], q: string, folders: ServiceFolder[] = DEFAULT_FOLDERS) {
  const terms = fold(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return services.filter((s) => !s.archived);
  const price: ((p: number) => boolean)[] = [];
  const words: string[] = [];
  for (const t of terms) {
    const m = /^([<>]=?)?€?(\d+(?:[.,]\d+)?)€?$/.exec(t);
    if (m) {
      const v = +m[2].replace(",", ".");
      price.push(m[1]?.startsWith("<") ? (p) => p <= v : m[1]?.startsWith(">") ? (p) => p >= v : (p) => Math.abs(p - v) <= Math.max(10, v * 0.15));
    } else words.push(t);
  }
  const label = (id: string) => folders.find((f) => f.id === id)?.label ?? id;
  return services
    .filter((s) => !s.archived && price.every((f) => f(s.price)))
    .map((s) => {
      const name = fold(s.name);
      const hay = fold([s.name, label(s.folder), s.plan ?? "", s.plan === "on_demand" ? "on-demand avulso" : s.plan === "frequency" ? "frequency recorrente mensal" : "", s.tier ?? "", s.tier === "pro" ? "complexo premium" : "simples basic", s.deliverable, s.includes.join(" "), s.use_for.join(" "), s.tags.join(" "), s.invoice_label].join(" "));
      const hayToks = new Set(hay.split(/[^a-z0-9]+/));
      // termos curtos ("pro", "4k") têm de ser palavra inteira — senão "pro" apanharia "production"
      if (!words.every((w) => (w.length <= 3 ? hayToks.has(w) : hay.includes(w)))) return null;
      const toks = name.split(/[^a-z0-9]+/);
      const score = words.reduce((n, w) => n + (toks.includes(w) ? 6 : toks.some((t) => t.startsWith(w)) ? 4 : name.includes(w) ? 2 : 1), 0) + s.uses * 0.1 + POT_W[s.potential] * 0.2 - name.length * 0.01;
      return { s, score };
    })
    .filter((x): x is { s: Service; score: number } => x != null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

/** Regista as diferenças entre a versão antiga e a nova no histórico do serviço (ativo no painel de atividade). */
export function withHistory(prev: Service | null, next: Service, by?: string): Service {
  if (!prev) return { ...next, history: [{ at: new Date().toISOString(), by, field: "created", from: "", to: next.name }] };
  const fields: (keyof Service)[] = ["name", "folder", "price", "crp", "hours", "unit", "plan", "tier", "min_margin", "potential", "deliverable", "archived"];
  const changes: ServiceChange[] = fields
    .filter((f) => JSON.stringify(prev[f]) !== JSON.stringify(next[f]))
    .map((f) => ({ at: new Date().toISOString(), by, field: String(f), from: String(prev[f] ?? ""), to: String(next[f] ?? "") }));
  return { ...next, history: [...prev.history, ...changes].slice(-30) };
}

// ---------------------------------------------------------------- importação / exportação JSON

export type CatalogFile = { format: "xmedia.services"; version: 1; exported_at: string; folders: ServiceFolder[]; rules: PricingRules; services: Service[] };

export function exportCatalog(services: Service[], folders: ServiceFolder[], rules: PricingRules): CatalogFile {
  return { format: "xmedia.services", version: 1, exported_at: new Date().toISOString(), folders, rules, services };
}

/** Lê JSON: ficheiro de catálogo, lista de serviços, ou linhas no formato do Notion (Equipment/Service Cost/CRP…). */
export function parseCatalog(text: string, folders: ServiceFolder[] = DEFAULT_FOLDERS): { services: Service[]; folders?: ServiceFolder[]; rules?: PricingRules; errors: string[] } {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { services: [], errors: [`JSON inválido: ${(e as Error).message}`] };
  }
  const obj = raw as Record<string, unknown>;
  const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray(obj?.services) ? (obj.services as unknown[]) : Array.isArray(obj?.results) ? (obj.results as unknown[]) : [];
  if (!list.length) errors.push("Nenhum serviço encontrado (esperado: lista, {services: [...]} ou {results: [...]} do Notion).");
  const fs = Array.isArray(obj?.folders) ? (obj.folders as ServiceFolder[]).filter((f) => f && typeof f.id === "string") : undefined;
  const services = list
    .map((r, i) => {
      if (!r || typeof r !== "object") {
        errors.push(`linha ${i + 1}: não é um objeto`);
        return null;
      }
      const o = r as Record<string, unknown>;
      return "Equipment" in o ? fromNotionRow(o) : normalizeService(o as Partial<Service>, fs ?? folders);
    })
    .filter((s): s is Service => s != null);
  return { services, folders: fs, rules: obj?.rules ? normalizeRules(obj.rules as PricingRules) : undefined, errors };
}

const NOTION_FOLDER: Record<string, string> = {
  "Capturing | C": "capture",
  "MOV - [Material Edit]": "edit",
  "EDIT - Subtitles": "edit",
  "Packages | C": "video_pkg",
  "Photography | P": "photo",
  "PHT - [Material Edit]": "photo",
  "Packages | P": "photo_pkg",
  "Pre-Production": "preprod",
  "Media - Transport": "preprod",
};
const NOTION_POT: Record<string, Potential> = { Alto: "high", "Médio": "medium", Revisar: "review", "N/A - Repasse": "passthrough" };

/** Converte uma linha do "MM - Program Worksheet" (export/consulta do Notion) num serviço. */
export function fromNotionRow(o: Record<string, unknown>): Service {
  const name = str(o.Equipment).trim();
  const plan = str(o["Plan Service"]);
  const folder = NOTION_FOLDER[str(o.Type)] ?? "preprod";
  const pass = str(o["Potencial de Saída"]) === "N/A - Repasse";
  const realH = num(o["Horas Reais"]);
  const unit: ServiceUnit = pass ? "trip" : /diária|day/i.test(name) || plan.includes("/Day") ? "day" : /assinatura|mensal/i.test(name) ? "month" : /extra|reel|pkg|banco/i.test(name) ? "item" : "hour";
  return normalizeService({
    id: slug(name),
    name,
    folder,
    kind: pass ? "travel" : /estrat|roteiro/i.test(name) ? "strategy" : KIND_OF_FOLDER[folder],
    plan: plan.includes("Frequency") ? "frequency" : plan.includes("On-Demand") ? "on_demand" : plan.includes("/Day") ? "day" : /\[extra\]/i.test(name) ? "extra" : /pkg|banco|assinatura/i.test(name) ? "package" : null,
    tier: str(o.Complexity) === "Complexo" || /\bpro\b/i.test(name) ? "pro" : str(o.Complexity) === "Simples" || /basic|simples/i.test(name) ? "simple" : null,
    unit,
    price: num(o["Service Cost"]),
    crp: num(o["CRP (Custo Real)"]),
    hours: realH,
    pass_through: pass,
    potential: NOTION_POT[str(o["Potencial de Saída"])] ?? "medium",
    deliverable: str(o["Entregável Válido"]),
    notes: str(o.Notes),
    source: { notion: str(o.url) || "MM - Program Worksheet" },
  });
}

// ---------------------------------------------------------------- bandas de mercado (Notion §3, 2026)

const SRC_VIDEO = ["Ruah Creative House — Freelance Videographer Rates 2026", "getcameracrew.com — Amsterdam crew cost", "daily-rate.eu — Netherlands 2026", "Airframe Media — London/EU Day Rates 2026"];
const SRC_EDIT = ["solohourly.com — Germany Video Editor Rates 2026", "reel-rate.com — Video Editor Rates by Country 2026"];
const SRC_REEL = ["D-MAK Productions — Social Media Video Pricing 2026", "advids.co — Amsterdam social video agencies"];
const SRC_PHOTO = ["Benchmark interno NL/EU 2026 (Notion §3) — fotografia de negócios"];
export const MARKET: Record<string, MarketBand> = {
  capture_hour: { low: 80, high: 380, per: "hour", label: "Videographer freelance · Amsterdão", sources: [...SRC_VIDEO, "Adenda 3.1 — freelancers bons NL a €80–100/h"] },
  capture_day: { low: 750, high: 2500, per: "day", label: "Diária de captação · Holanda", sources: SRC_VIDEO },
  edit_hour: { low: 45, high: 150, per: "hour", label: "Editor freelance · Europa (médio → sénior)", sources: SRC_EDIT },
  reel: { low: 600, high: 2000, per: "item", label: "Vídeo curto/Reel (agência) · Holanda", sources: SRC_REEL },
  reel_edit: { low: 95, high: 300, per: "item", label: "Edição de Reel (freelancer → estúdio)", sources: [...SRC_EDIT, "Tabela validada Notion §4 (€95–185/Reel)"] },
  subtitles: { low: 40, high: 80, per: "item", label: "Legendas simples por vídeo", sources: ["Notion — Program Worksheet (Legendas simples €40–80)"] },
  photo_hour: { low: 80, high: 150, per: "hour", label: "Fotografia de negócios · NL", sources: SRC_PHOTO },
  photo_event: { low: 80, high: 250, per: "hour", label: "Fotografia de eventos · NL", sources: SRC_PHOTO },
  retouch: { low: 30, high: 50, per: "item", label: "Retoque avançado por foto", sources: ["Notion — Program Worksheet (€30–50/foto)"] },
  retainer: { low: 3500, high: 8000, per: "month", label: "Retainer de conteúdo mensal (marca)", sources: SRC_REEL },
};

// ---------------------------------------------------------------- orçamento → linhas de documento (PDF/invoice)

export type DocItem = { description: string; qty: number; rate: number };
const DISC_LABEL: Record<keyof LineDiscounts, (q: QuoteResult, r: PricingRules) => string> = {
  hours: () => "® Volume Discount — hours (same day/location)",
  volume: (q) => `® Volume Discount — ${q.reels} deliverables`,
  recurring: (q) => `® Recurring Contract Discount — ${q.months} months (${q.recurring_pct}%)`,
  partner: (_q, r) => `® Partnership Discount (${r.partner_pct}%)`,
  extra: () => "® Special Condition",
};

/** Linhas do documento: serviços ao preço cheio + uma linha negativa por tipo de desconto (nunca escondido no preço). */
export function quoteItems(q: QuoteResult, rulesIn?: Partial<PricingRules>): DocItem[] {
  const rules = normalizeRules(rulesIn);
  const items: DocItem[] = q.lines.map((l) => ({ description: l.label + (l.rush ? " (rush)" : ""), qty: l.qty, rate: l.unit_price }));
  const sums: Record<keyof LineDiscounts, number> = { hours: 0, volume: 0, recurring: 0, partner: 0, extra: 0 };
  for (const l of q.lines) {
    const off = l.gross - l.net;
    if (off <= 0 || l.requested_pct <= 0) continue;
    for (const k of Object.keys(sums) as (keyof LineDiscounts)[]) sums[k] += (off * l.discounts[k]) / l.requested_pct;
  }
  const keys = (Object.keys(sums) as (keyof LineDiscounts)[]).filter((k) => round2(sums[k]) > 0);
  const rounded = keys.map((k) => round2(sums[k]));
  const residual = round2(q.discount - rounded.reduce((a, b) => a + b, 0));
  if (keys.length && residual) rounded[rounded.indexOf(Math.max(...rounded))] = round2(rounded[rounded.indexOf(Math.max(...rounded))] + residual);
  keys.forEach((k, i) => items.push({ description: DISC_LABEL[k](q, rules), qty: 1, rate: -rounded[i] }));
  return items;
}

/** Nota explicativa (bloco NOTE do PDF): descontos, teto/piso, recorrência, depósito. Em inglês, como o template. */
export function quoteNote(q: QuoteResult, input: QuoteInput, rulesIn?: Partial<PricingRules>) {
  const rules = normalizeRules(rulesIn);
  const parts: string[] = [];
  if (q.discount > 0) parts.push(`Discounts applied: ${round2((q.discount / q.gross) * 100)}% on the full On-Demand price (combined discounts are capped at ${rules.cap_pct}%).`);
  if (q.lines.some((l) => l.floor_limited)) parts.push("Some discounts were limited to keep the production standard of each service.");
  if (q.months > 0) parts.push(`Monthly fee for a ${q.months}-month contract — contract value €${q.contract_total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} excl. BTW.`);
  if (input.rush) parts.push(`Same-day/rush delivery: +${rules.rush_pct}% on editing.`);
  parts.push(`${rules.deposit_pct}% deposit to confirm the date.`);
  if (input.note) parts.push(input.note);
  return parts.join(" ");
}

/**
 * Texto da proposta no formato padrão MediaMarques (Notion §9, a partir da proposta Intuity Coaching):
 * 1) CONTEXT em prosa; 2) nome do pacote; 3) tabela PRICE | PACKAGE | INCLUDES (excl. BTW, plano); 4) linha de fecho.
 */
export function proposalText(q: QuoteResult, input: QuoteInput, opts: { title?: string; context?: string; closing?: string } = {}) {
  const eur = (n: number) => `€${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
  const plan = q.months > 0 ? `Frequency · ${q.months} months` : "On-Demand";
  const who = input.client.company || input.client.name || "the client";
  const context =
    opts.context ||
    `${who} asked for ${q.lines.map((l) => `${l.qty}× ${l.service.invoice_label.replace(/^®\s*\[MM\]\s*/, "")}`).join(", ")}. This proposal brings everything together in one package, priced from the MediaMarques rate card${q.discount > 0 ? " with the applicable volume, recurring and partnership conditions already applied" : ""}.`;
  const includes = q.lines.flatMap((l) => {
    const name = l.service.invoice_label.replace(/^®\s*\[MM\]\s*/, "");
    const first = l.service.includes[0] ? ` — ${l.service.includes.slice(0, 3).join(", ").toLowerCase()}` : "";
    return [`**${l.qty > 1 ? `${l.qty}× ` : ""}${name}**${first}`];
  });
  const rows = includes.map((x, i) => `${i + 1}. ${x}`).join("<br>");
  return [
    "**CONTEXT**",
    context,
    "",
    `**${(opts.title || `${who} — Production Package`).toUpperCase()}**`,
    "",
    "| PRICE | PACKAGE | INCLUDES |",
    "|---|---|---|",
    `| **${eur(q.subtotal)}** excl. BTW${q.months > 0 ? " / month" : ""}<br>${plan} | ${opts.title || "Production Package"} | ${rows} |`,
    "",
    opts.closing ?? `Next step: confirm the date with a ${Math.round((q.deposit / (q.total || 1)) * 100)}% deposit and we lock in the production schedule.`,
  ].join("\n");
}
