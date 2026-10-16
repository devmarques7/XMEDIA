// scripts/invoice-bundle.ts
import { readFileSync, writeFileSync } from "node:fs";

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
function totals(inv2) {
  const lines = inv2.items.map((i) => ({ ...i, subtotal: round2((Number(i.qty) || 0) * (Number(i.rate) || 0)) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const btw = resolveBtw(inv2.btw, inv2.client.country);
  const btwAmount = round2(subtotal * btw.rate / 100);
  return { lines, subtotal, btw, btwAmount, total: round2(subtotal + btwAmount) };
}
var uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
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
  arr.forEach((r2, i) => {
    const description = String(r2.description ?? r2.item ?? r2.name ?? r2.title ?? "").trim();
    const qty = Number(String(r2.qty ?? r2.quantity ?? r2.hours ?? r2.hrs ?? 1).replace(",", "."));
    const rate = Number(String(r2.rate ?? r2.price ?? r2.unit_price ?? r2.unitPrice ?? 0).replace(",", "."));
    if (!description) errors.push(`Item ${i + 1}: falta "description"`);
    else if (!isFinite(qty) || !isFinite(rate)) errors.push(`Item ${i + 1}: "qty"/"rate" n\xE3o s\xE3o n\xFAmeros`);
    else items.push({ id: uid(), description, qty, rate });
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
      line1: "Media Marques \xA9",
      line2: `Invoices [${year}]`,
      title: "INVOICE",
      text: "This invoice refers to professional services provided by Media Marques, including audiovisual production and/or software development services, as agreed with the client."
    },
    theme: { ...THEMES.original }
  };
}
function normalizeInvoice(x) {
  const base2 = emptyInvoice(x.number ?? "", x.issue_date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  return {
    ...base2,
    ...x,
    client: { ...base2.client, ...x.client ?? {} },
    payment: { ...base2.payment, ...x.payment ?? {} },
    cover: { ...base2.cover, ...x.cover ?? {} },
    theme: { ...base2.theme, ...x.theme ?? {} },
    items: (x.items ?? base2.items).map((i) => ({ id: i.id || uid(), description: i.description ?? "", qty: Number(i.qty) || 0, rate: Number(i.rate) || 0 }))
  };
}

// scripts/invoice-bundle.ts
var [src, out, id, version, status = "sent"] = process.argv.slice(2);
var r = importJson(readFileSync(src, "utf8"));
if (r.errors.length) throw new Error(r.errors.join("\n"));
var base = emptyInvoice(r.patch.number ?? "", r.patch.issue_date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
var inv = normalizeInvoice({ ...base, ...r.patch, id, items: r.items.map((x, i) => ({ ...x, id: `${id.slice(0, 8)}-${i + 1}` })), status, bundle_version: Number(version) });
writeFileSync(out, JSON.stringify(inv));
var t = totals(inv);
console.log(inv.number, t.subtotal, t.btwAmount, t.total);
