// Invoices MediaMarques: modelo, cálculos (BTW automático), numeração, importação JSON e QR SEPA.

export const INVOICE_CURRENCIES = ["EUR", "GBP"] as const;
export type InvoiceCurrency = (typeof INVOICE_CURRENCIES)[number];
export type InvoiceStatus = "draft" | "sent" | "paid";
/** "auto" decide pelo país do cliente; números forçam a taxa. */
export type BtwSetting = "auto" | 0 | 9 | 21;
export type QrMode = "epc" | "link" | "none";

/** Categorias para organizar as invoices (Finanças). */
export const INVOICE_CATEGORIES = ["production", "content", "software", "mentoring", "expenses"] as const;
export type InvoiceCategory = (typeof INVOICE_CATEGORIES)[number];

export type InvoiceItem = { id: string; description: string; qty: number; rate: number };

export type InvoiceTheme = {
  bg: string; // fundo das duas páginas
  ink: string; // texto principal
  coverInk: string; // texto da capa
  accent: string; // [TO] [ADDRESS] [ID]
  total: string; // linha TOTAL
  dots: string; // círculo de pontos da capa
};

export type Invoice = {
  id: string;
  number: string; // ex.: "Q4 - #0049"
  issue_date: string; // AAAA-MM-DD
  status: InvoiceStatus;
  currency: InvoiceCurrency;
  client: { name: string; address: string; country: string; vat: string; email: string };
  items: InvoiceItem[];
  btw: BtwSetting;
  note: string;
  payment: { qr: QrMode; link: string; termsDays: number };
  cover: { line1: string; line2: string; title: string; text: string };
  theme: InvoiceTheme;
  project_id?: string | null;
  /** Invoices incluídas na app (criadas sem SQL): versão do conteúdo de origem. */
  bundle_version?: number;
  category?: InvoiceCategory;
  /** Cancelada / substituída: fica no registo mas não conta nos totais (a tabela só aceita draft/sent/paid). */
  void?: boolean;
  /** Documento original (PDF) guardado na app: nome do ficheiro servido por /api/invoices/file/[name]. */
  attachment?: string | null;
  /** Origem (ex.: página da invoice no Notion). */
  source?: string;
  /** Custos diretos do trabalho (Notion: Costs), para a margem. */
  costs?: number | null;
  /** Avisos de qualidade dos dados encontrados na importação. */
  flags?: string[];
  customer_id?: string | null;
  /** Envios por email (de invoices@…): quando, para quem, por quem. */
  sent_log?: { at: string; to: string; cc?: string[]; by?: string; email_id?: string }[];
  created_at?: string;
  updated_at?: string;
};

// dados fixos da empresa (do PDF oficial)
export const COMPANY = {
  brand: "[MEDIAMARQUES]",
  name: "MEDIAMARQUES",
  address: "RIJNLAND 205, 8245BH",
  kvk: "88238830",
  btw: "NL003057836B98",
  bsn: "674439867",
  tel: "+31 06 4875-7414",
  iban: "NL49 INGB 0110 7149 38",
  bic: "INGBNL2A",
};

export const STANDARD_TERMS = [
  "This invoice covers only the services provided by MediaMarques and does not include any external production, licensing, or distribution costs.",
  "The Client agrees to pay a 50% deposit upfront before any work commences. Work will not begin until the deposit has been received via bank transfer.",
  "The remaining balance of the agreed quote must be paid within 5 days after the final delivery of the project.",
  "Project management costs are not included in this invoice unless explicitly stated.",
  "If project management services are required, they will be charged separately at a rate of €150 per hour.",
  "Late payments may be subject to an interest charge of 0.8% per week on the total outstanding amount.",
  "Any disputes regarding this invoice must be submitted in writing to MediaMarques within 3 business days from the invoice issue date.",
  "MediaMarques reserves the right to suspend or terminate services if payment is not received within the specified timeframe.",
  "This invoice and the services provided by MediaMarques shall be governed by and interpreted in accordance with the laws of the Netherlands.",
];
export const TERMS_FOOTNOTE =
  "By accepting this invoice, you agree to these terms and conditions. For  full terms and conditions, please refer to the Client Agreement.";

export const THEMES: Record<string, InvoiceTheme> = {
  original: { bg: "#F6F4F0", ink: "#000000", coverInk: "#222222", accent: "#E0552F", total: "#DB4A2B", dots: "#020202" },
  white: { bg: "#FFFFFF", ink: "#000000", coverInk: "#111111", accent: "#E8491D", total: "#E8491D", dots: "#000000" },
  sand: { bg: "#EDE6DA", ink: "#1E1B16", coverInk: "#1E1B16", accent: "#9A5B2E", total: "#9A5B2E", dots: "#1E1B16" },
  ink: { bg: "#F4F4F2", ink: "#0B1B2B", coverInk: "#0B1B2B", accent: "#2F5BFF", total: "#2F5BFF", dots: "#0B1B2B" },
};

const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];

export type BtwInfo = { rate: number; label: string; reason: "nl" | "eu_reverse" | "outside_eu" | "manual" };

/** BTW automático: NL → 21%; outro país da UE (B2B) → 0% verlegd; fora da UE (ex.: GB) → 0%, fora do âmbito. */
export function resolveBtw(btw: BtwSetting, country: string): BtwInfo {
  if (btw !== "auto") return { rate: btw, label: `BTW ${btw}%`, reason: "manual" };
  const c = (country || "NL").trim().toUpperCase();
  if (c === "NL") return { rate: 21, label: "BTW 21%", reason: "nl" };
  if (EU.includes(c)) return { rate: 0, label: "BTW 0% [REVERSE CHARGE]", reason: "eu_reverse" };
  return { rate: 0, label: "", reason: "outside_eu" };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function totals(inv: Pick<Invoice, "items" | "btw" | "client">) {
  const lines = inv.items.map((i) => ({ ...i, subtotal: round2((Number(i.qty) || 0) * (Number(i.rate) || 0)) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const btw = resolveBtw(inv.btw, inv.client.country);
  const btwAmount = round2((subtotal * btw.rate) / 100);
  return { lines, subtotal, btw, btwAmount, total: round2(subtotal + btwAmount) };
}

const SYM: Record<InvoiceCurrency, string> = { EUR: "€", GBP: "£" };
/** Formato do PDF: €1,234.00 EUR */
export function money(n: number, c: InvoiceCurrency) {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}${SYM[c]}${s} ${c}`;
}

/** "4 Oct 2026" */
export function invoiceDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return isNaN(+d) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Próximo número: "Q{trimestre} - #{seq}", seq = maior existente + 1. */
export function nextNumber(existing: string[], issueDate: string, start = 1) {
  const max = existing.reduce((m, n) => Math.max(m, parseInt(/#(\d+)/.exec(n)?.[1] ?? "0", 10)), start - 1);
  const q = Math.floor(new Date(issueDate + "T12:00:00").getMonth() / 3) + 1;
  return `Q${q} - #${String(max + 1).padStart(4, "0")}`;
}

/** Payload EPC (QR SEPA "GiroCode"): lido pela maioria das apps bancárias europeias. Só EUR. */
export function epcPayload(o: { name: string; iban: string; bic?: string; amount: number; reference: string }) {
  return [
    "BCD",
    "002",
    "1",
    "SCT",
    o.bic ?? "",
    o.name.slice(0, 70),
    o.iban.replace(/\s+/g, "").toUpperCase(),
    `EUR${o.amount.toFixed(2)}`,
    "",
    "",
    o.reference.slice(0, 140),
  ].join("\n");
}

/** Conteúdo do QR (ou null para não mostrar). */
export function qrContent(inv: Invoice, total: number) {
  if (inv.payment.qr === "link") return inv.payment.link.trim() || null;
  if (inv.payment.qr === "epc" && inv.currency === "EUR" && total > 0)
    return epcPayload({ name: COMPANY.name, iban: COMPANY.iban, bic: COMPANY.bic, amount: total, reference: `Invoice ${inv.number}` });
  return null;
}

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

/**
 * Importa itens de JSON. Aceita:
 *  - [{ "description": "...", "qty": 3, "rate": 245 }]
 *  - { "items": [...] }  (e opcionalmente client, note, number, issue_date, btw, currency)
 * Chaves alternativas: item/name/title, hours/quantity, price/unit_price.
 */
export function importJson(text: string): { items: InvoiceItem[]; patch: Partial<Invoice>; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { items: [], patch: {}, errors: [`JSON inválido: ${(e as Error).message}`] };
  }
  const obj = (Array.isArray(raw) ? { items: raw } : raw) as Record<string, unknown>;
  const arr = Array.isArray(obj.items) ? (obj.items as Record<string, unknown>[]) : [];
  const errors: string[] = [];
  const items: InvoiceItem[] = [];
  arr.forEach((r, i) => {
    const description = String(r.description ?? r.item ?? r.name ?? r.title ?? "").trim();
    const qty = Number(String(r.qty ?? r.quantity ?? r.hours ?? r.hrs ?? 1).replace(",", "."));
    const rate = Number(String(r.rate ?? r.price ?? r.unit_price ?? r.unitPrice ?? 0).replace(",", "."));
    if (!description) errors.push(`Item ${i + 1}: falta "description"`);
    else if (!isFinite(qty) || !isFinite(rate)) errors.push(`Item ${i + 1}: "qty"/"rate" não são números`);
    else items.push({ id: uid(), description, qty, rate });
  });
  if (!arr.length) errors.push('Nenhum item encontrado (use uma lista ou { "items": [...] }).');
  const patch: Partial<Invoice> = {};
  const c = obj.client as Record<string, unknown> | undefined;
  if (c && typeof c === "object")
    patch.client = { name: String(c.name ?? ""), address: String(c.address ?? ""), country: String(c.country ?? "").toUpperCase(), vat: String(c.vat ?? ""), email: String(c.email ?? "") };
  if (typeof obj.note === "string") patch.note = obj.note;
  if (typeof obj.number === "string") patch.number = obj.number;
  if (typeof obj.issue_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.issue_date)) patch.issue_date = obj.issue_date;
  if (obj.btw === "auto" || [0, 9, 21].includes(obj.btw as number)) patch.btw = obj.btw as BtwSetting;
  if (obj.currency === "EUR" || obj.currency === "GBP") patch.currency = obj.currency;
  return { items, patch, errors };
}

export const ITEMS_TEMPLATE = JSON.stringify(
  {
    client: { name: "WE ARE SANCTUM LTD.", address: "1st Floor One Suffolk Way\nSevenoaks TN13 1YL GB", country: "GB", vat: "", email: "" },
    items: [
      { description: "® [MM] Post-Production / Reel PRO: - Complete Edit", qty: 3, rate: 245 },
      { description: "® [MM] Capture Day / Half Day", qty: 1, rate: 450 },
    ],
    note: "Covers the complete edit of 3 final Reels…",
    btw: "auto",
  },
  null,
  2
);

export function emptyInvoice(number: string, today: string): Invoice {
  const year = today.slice(0, 4);
  return {
    id: uid(),
    number,
    issue_date: today,
    status: "draft",
    currency: "EUR",
    client: { name: "", address: "", country: "NL", vat: "", email: "" },
    items: [{ id: uid(), description: "", qty: 1, rate: 0 }],
    btw: "auto",
    note: "",
    payment: { qr: "epc", link: "", termsDays: 5 },
    cover: {
      line1: "Media Marques ©",
      line2: `Invoices [${year}]`,
      title: "INVOICE",
      text: "This invoice refers to professional services provided by Media Marques, including audiovisual production and/or software development services, as agreed with the client.",
    },
    theme: { ...THEMES.original },
  };
}

/** Garante campos em dados antigos/importados. */
export function normalizeInvoice(x: Partial<Invoice> & { id: string }): Invoice {
  const base = emptyInvoice(x.number ?? "", x.issue_date ?? new Date().toISOString().slice(0, 10));
  return {
    ...base,
    ...x,
    client: { ...base.client, ...(x.client ?? {}) },
    payment: { ...base.payment, ...(x.payment ?? {}) },
    cover: { ...base.cover, ...(x.cover ?? {}) },
    theme: { ...base.theme, ...(x.theme ?? {}) },
    items: (x.items ?? base.items).map((i) => ({ id: i.id || uid(), description: i.description ?? "", qty: Number(i.qty) || 0, rate: Number(i.rate) || 0 })),
  };
}
