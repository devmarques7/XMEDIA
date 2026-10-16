// scripts/invoices-2026.ts
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

// lib/customer.ts
var CSTAGES = ["not_started", "stage0", "stage1", "stage2", "stage3", "stage4", "complete"];
var uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
var str = (v, d = "") => typeof v === "string" ? v : d;
var num = (v) => typeof v === "number" && Number.isFinite(v) ? v : void 0;
function emptyCustomer(name = "") {
  return {
    id: uid(),
    name,
    contact: "",
    email: "",
    phone: "",
    lang: "pt",
    stage: "not_started",
    done: [],
    contract_signed: false,
    cover: "",
    notes: "",
    instagram: { handle: "", connected: false },
    portal: { status: "none" },
    plan: { active: true, price: null, since: "", paid_until: "" }
  };
}
function normalizeCustomer(x) {
  const e = emptyCustomer();
  const ig = x.instagram ?? {};
  return {
    ...e,
    ...x,
    id: x.id || e.id,
    name: str(x.name),
    stage: CSTAGES.includes(x.stage) ? x.stage : "not_started",
    lang: x.lang === "en" || x.lang === "nl" ? x.lang : "pt",
    done: Array.isArray(x.done) ? x.done.filter((c) => typeof c === "string") : [],
    instagram: { ...e.instagram, ...ig, handle: cleanHandle(str(ig.handle)), connected: !!ig.connected },
    portal: { ...e.portal, ...x.portal ?? {} },
    plan: { ...e.plan, ...x.plan ?? {}, price: num(x.plan?.price) ?? null }
  };
}
var cleanHandle = (h) => h.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "").toLowerCase();

// lib/invoice.ts
var THEMES = {
  original: { bg: "#F6F4F0", ink: "#000000", coverInk: "#222222", accent: "#E0552F", total: "#DB4A2B", dots: "#020202" },
  white: { bg: "#FFFFFF", ink: "#000000", coverInk: "#111111", accent: "#E8491D", total: "#E8491D", dots: "#000000" },
  sand: { bg: "#EDE6DA", ink: "#1E1B16", coverInk: "#1E1B16", accent: "#9A5B2E", total: "#9A5B2E", dots: "#1E1B16" },
  ink: { bg: "#F4F4F2", ink: "#0B1B2B", coverInk: "#0B1B2B", accent: "#2F5BFF", total: "#2F5BFF", dots: "#0B1B2B" }
};
var EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
function resolveBtw(btw, country) {
  if (btw !== "auto") return { rate: btw, label: `BTW ${btw}%`, reason: "manual" };
  const c = (country || "NL").trim().toUpperCase();
  if (c === "NL") return { rate: 21, label: "BTW 21%", reason: "nl" };
  if (EU.includes(c)) return { rate: 0, label: "BTW 0% [REVERSE CHARGE]", reason: "eu_reverse" };
  return { rate: 0, label: "", reason: "outside_eu" };
}
var round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function totals(inv) {
  const lines = inv.items.map((i) => ({ ...i, subtotal: round2((Number(i.qty) || 0) * (Number(i.rate) || 0)) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const btw = resolveBtw(inv.btw, inv.client.country);
  const btwAmount = round2(subtotal * btw.rate / 100);
  return { lines, subtotal, btw, btwAmount, total: round2(subtotal + btwAmount) };
}
var uid2 = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
function importJson(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { items: [], patch: {}, errors: [`JSON inv\xE1lido: ${e.message}`] };
  }
  const obj = Array.isArray(raw) ? { items: raw } : raw;
  const arr = Array.isArray(obj.items) ? obj.items : [];
  const errors = [];
  const items = [];
  arr.forEach((r, i) => {
    const description = String(r.description ?? r.item ?? r.name ?? r.title ?? "").trim();
    const qty = Number(String(r.qty ?? r.quantity ?? r.hours ?? r.hrs ?? 1).replace(",", "."));
    const rate = Number(String(r.rate ?? r.price ?? r.unit_price ?? r.unitPrice ?? 0).replace(",", "."));
    if (!description) errors.push(`Item ${i + 1}: falta "description"`);
    else if (!isFinite(qty) || !isFinite(rate)) errors.push(`Item ${i + 1}: "qty"/"rate" n\xE3o s\xE3o n\xFAmeros`);
    else items.push({ id: uid2(), description, qty, rate });
  });
  if (!arr.length) errors.push('Nenhum item encontrado (use uma lista ou { "items": [...] }).');
  const patch = {};
  const c = obj.client;
  if (c && typeof c === "object")
    patch.client = { name: String(c.name ?? ""), address: String(c.address ?? ""), country: String(c.country ?? "").toUpperCase(), vat: String(c.vat ?? ""), email: String(c.email ?? "") };
  if (typeof obj.note === "string") patch.note = obj.note;
  if (typeof obj.number === "string") patch.number = obj.number;
  if (typeof obj.issue_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.issue_date)) patch.issue_date = obj.issue_date;
  if (obj.btw === "auto" || [0, 9, 21].includes(obj.btw)) patch.btw = obj.btw;
  if (obj.currency === "EUR" || obj.currency === "GBP") patch.currency = obj.currency;
  return { items, patch, errors };
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
function emptyInvoice(number, today) {
  const year = today.slice(0, 4);
  return {
    id: uid2(),
    number,
    issue_date: today,
    status: "draft",
    currency: "EUR",
    client: { name: "", address: "", country: "NL", vat: "", email: "" },
    items: [{ id: uid2(), description: "", qty: 1, rate: 0 }],
    btw: "auto",
    note: "",
    payment: { qr: "epc", link: "", termsDays: 5 },
    cover: {
      line1: "Media Marques \xA9",
      line2: `Invoices [${year}]`,
      title: "INVOICE",
      text: "This invoice refers to professional services provided by Media Marques, including audiovisual production and/or software development services, as agreed with the client."
    },
    theme: { ...THEMES.original }
  };
}
function normalizeInvoice(x) {
  const base = emptyInvoice(x.number ?? "", x.issue_date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  return {
    ...base,
    ...x,
    client: { ...base.client, ...x.client ?? {} },
    payment: { ...base.payment, ...x.payment ?? {} },
    cover: { ...base.cover, ...x.cover ?? {} },
    theme: { ...base.theme, ...x.theme ?? {} },
    items: (x.items ?? base.items).map((i) => ({ id: i.id || uid2(), description: i.description ?? "", qty: Number(i.qty) || 0, rate: Number(i.rate) || 0 }))
  };
}

// scripts/invoices-2026.ts
var VERSION = 1;
var uuid = (key) => {
  const h = createHash("sha256").update(`xmedia:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
var src = JSON.parse(readFileSync("data/invoices-2026.json", "utf8"));
var CUST = [
  ["gc", "GC Clinic", [], "nl"],
  ["wj", "E-bikes ecosystem", ["WJ-EBIKES", "WJ Ebikes"], "pt"],
  ["viva", "Viva Fashion \u2014 Vanessa Nantes", [], "pt"],
  ["carine", "Carine Hair Salon", ["Carine Lopes Hairstudio"], "pt"],
  ["369", "369 Premium Hair", [], "pt"],
  ["leticia", "WHY NOT FLY", ["Let\xEDcia Lana"], "pt"],
  ["marcio", "Marcio Velter", [], "pt"],
  ["izabel", "Izabel Fernandes \u2014 With Meaning", [], "pt"],
  ["jeffrey", "Jeffrey Chirino", [], "en"],
  ["donna", "Donna Agency", [], "pt"],
  ["wagner", "Wagner Mo\xE7o de Souza", [], "pt"],
  ["manuela", "Manuela Hugo Photography", [], "pt"],
  ["mavi", "Carioca Restaurant", ["Mavi", "Maria Vitoria Mattoso"], "pt"],
  ["frame", "Frame Your Story \u2014 Caroline & Felipe", [], "pt"],
  ["brenda", "Brenda Machado \u2014 M/Mentor", [], "pt"],
  ["advent", "Adventisten \u2014 adventistgroei.nl", ["Kerkgenootschap der Zevende-dags Adventisten"], "nl"],
  ["bueno", "Schilders Bedrijf Bueno", ["Schilderbedrijf Bueno"], "pt"],
  ["alexia", "Alexia Waagmeester Mentoring", [], "en"],
  ["sanctum", "Luuk Melisse | Personal Brand", ["Sanctum", "Sanctum BV"], "en"],
  ["intuity", "Intuity Coaching", [], "en"],
  ["gustavo", "Eichholtz \u2014 Gustavo Henrique", ["Gustavo Henrique Lda"], "pt"],
  ["apollo", "Apollo GraphQL", [], "en"]
];
var custId = (k) => uuid(`customer:${k}`);
var billingOf = (k) => {
  const c = src.clients[k];
  const [company, contact = ""] = c.name.split(" \u2014 Attn. ");
  return { company, contact, address: c.address, country: c.country, vat: c.vat, kvk: c.kvk ?? "", email: c.email };
};
var customers = CUST.map(([k, name, alias, lang]) => {
  const b = billingOf(k);
  const nInv = src.invoices.filter((i) => i.client === k && !i.void);
  const last = nInv.map((i) => i.issue_date).sort().at(-1) ?? "";
  return {
    ...normalizeCustomer({ ...emptyCustomer(name), id: custId(k), lang, stage: "complete", contact: b.contact, email: b.email, contract_signed: true, notes: `Cliente importado do Notion (Finance \u203A Invoices 2026): ${nInv.length} invoice(s), \xFAltima em ${last}.`, plan: { active: false, price: null, since: "", paid_until: "" } }),
    billing: b,
    bundle_version: VERSION,
    match: [name, b.company, ...alias, ...b.email ? [b.email] : []]
  };
});
var COVER_TEXT = "This invoice refers to professional services provided by Media Marques, including audiovisual production and/or software development services, as agreed with the client.";
var invoices = src.invoices.map((s) => {
  const id = uuid(`invoice:${s.key}`);
  const c = src.clients[s.client];
  const inv = normalizeInvoice({
    id,
    number: s.number,
    issue_date: s.issue_date,
    status: s.status,
    client: { name: c.name, address: c.address, country: c.country, vat: c.vat, email: c.email },
    items: s.items.map((x, i) => ({ id: `${id.slice(0, 8)}-${i + 1}`, ...x })),
    btw: s.btw,
    note: s.note,
    cover: { line1: "Media Marques \xA9", line2: "Invoices [2026]", title: "INVOICE", text: COVER_TEXT },
    bundle_version: VERSION,
    category: s.category,
    void: s.void || void 0,
    attachment: s.file,
    source: s.notion,
    costs: s.costs,
    flags: s.flags.length ? s.flags : void 0,
    customer_id: custId(s.client)
  });
  if (s.file && !existsSync(`data/invoices-2026/${s.file}`)) throw new Error(`falta ${s.file}`);
  return inv;
});
{
  const r = importJson(readFileSync("invoices/sanctum-q4-0051.json", "utf8"));
  if (r.errors.length) throw new Error(r.errors.join("\n"));
  const id = "4f8d0051-5a1c-4c2e-9b6e-0a51c0de2026";
  invoices.push(normalizeInvoice({ ...r.patch, id, status: "sent", items: r.items.map((x, i) => ({ ...x, id: `4f8d0051-${i + 1}` })), bundle_version: VERSION, category: "production", attachment: "q4-0051-sanctum.pdf", customer_id: custId("sanctum") }));
}
writeFileSync("lib/bundled/invoices-2026.json", JSON.stringify(invoices));
writeFileSync("lib/bundled/customers-2026.json", JSON.stringify(customers));
var sum = 0;
for (const i of invoices) {
  const t = totals(i);
  if (!i.void) sum += t.total;
  console.log(i.number.padEnd(24), (i.category ?? "").padEnd(10), i.status.padEnd(5), i.void ? "VOID" : "    ", String(t.subtotal).padStart(9), String(t.btwAmount).padStart(8), String(t.total).padStart(9), i.client.name.slice(0, 40));
}
console.log(invoices.length, "invoices \xB7", customers.length, "clientes \xB7 total (sem anuladas)", Math.round(sum * 100) / 100);
