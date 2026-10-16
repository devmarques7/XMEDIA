// scripts/render-invoice.tsx
import { renderToFile } from "@react-pdf/renderer";
import QRCode from "qrcode";
import path from "node:path";

// components/InvoicePdf.tsx
import { Circle, Document, Font, Image, Page, Svg, Text, View } from "@react-pdf/renderer";

// lib/invoice.ts
var COMPANY = {
  brand: "[MEDIAMARQUES]",
  name: "MEDIAMARQUES",
  address: "RIJNLAND 205, 8245BH",
  kvk: "88238830",
  btw: "NL003057836B98",
  bsn: "674439867",
  tel: "+31 06 4875-7414",
  iban: "NL49 INGB 0110 7149 38",
  bic: "INGBNL2A"
};
var STANDARD_TERMS = [
  "This invoice covers only the services provided by MediaMarques and does not include any external production, licensing, or distribution costs.",
  "The Client agrees to pay a 50% deposit upfront before any work commences. Work will not begin until the deposit has been received via bank transfer.",
  "The remaining balance of the agreed quote must be paid within 5 days after the final delivery of the project.",
  "Project management costs are not included in this invoice unless explicitly stated.",
  "If project management services are required, they will be charged separately at a rate of \u20AC150 per hour.",
  "Late payments may be subject to an interest charge of 0.8% per week on the total outstanding amount.",
  "Any disputes regarding this invoice must be submitted in writing to MediaMarques within 3 business days from the invoice issue date.",
  "MediaMarques reserves the right to suspend or terminate services if payment is not received within the specified timeframe.",
  "This invoice and the services provided by MediaMarques shall be governed by and interpreted in accordance with the laws of the Netherlands."
];
var TERMS_FOOTNOTE = "By accepting this invoice, you agree to these terms and conditions. For  full terms and conditions, please refer to the Client Agreement.";
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
var SYM = { EUR: "\u20AC", GBP: "\xA3" };
function money(n, c) {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}${SYM[c]}${s} ${c}`;
}
function invoiceDate(iso) {
  const d = /* @__PURE__ */ new Date(iso + "T12:00:00");
  return isNaN(+d) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function epcPayload(o) {
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
    o.reference.slice(0, 140)
  ].join("\n");
}
function qrContent(inv2, total) {
  if (inv2.payment.qr === "link") return inv2.payment.link.trim() || null;
  if (inv2.payment.qr === "epc" && inv2.currency === "EUR" && total > 0)
    return epcPayload({ name: COMPANY.name, iban: COMPANY.iban, bic: COMPANY.bic, amount: total, reference: `Invoice ${inv2.number}` });
  return null;
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
  arr.forEach((r, i) => {
    const description = String(r.description ?? r.item ?? r.name ?? r.title ?? "").trim();
    const qty = Number(String(r.qty ?? r.quantity ?? r.hours ?? r.hrs ?? 1).replace(",", "."));
    const rate = Number(String(r.rate ?? r.price ?? r.unit_price ?? r.unitPrice ?? 0).replace(",", "."));
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

// components/InvoicePdf.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var registered = "";
function registerInvoiceFonts(base = "/fonts") {
  if (registered === base) return;
  registered = base;
  Font.register({
    family: "Montserrat",
    fonts: [
      { src: `${base}/Montserrat-Regular.ttf` },
      { src: `${base}/Montserrat-Italic.ttf`, fontStyle: "italic" },
      { src: `${base}/Montserrat-Bold.ttf`, fontWeight: 700 }
    ]
  });
  Font.register({
    family: "Open Sans",
    fonts: [{ src: `${base}/OpenSans-Regular.ttf` }, { src: `${base}/OpenSans-Bold.ttf`, fontWeight: 700 }]
  });
  Font.registerHyphenationCallback((w) => [w]);
}
var DOTS = [
  [49.9, 10.4],
  [30.2, 15.6],
  [69.8, 15.6],
  [15.4, 30.3],
  [84.5, 30.3],
  [40.1, 32.9],
  [60, 33],
  [10.1, 50.3],
  [30.1, 50.3],
  [50, 50.2],
  [69.8, 50.4],
  [89.7, 50.3],
  [39.9, 67.6],
  [60, 67.6],
  [15.6, 70.1],
  [84.5, 70],
  [30, 85],
  [69.8, 84.9],
  [49.9, 90]
];
var at = (left, top, extra = {}) => ({ position: "absolute", left, top, ...extra });
var rule = (left, top, right, color, w = 0.9) => ({
  position: "absolute",
  left,
  top,
  width: right - left,
  borderTopWidth: w,
  borderTopColor: color
});
function InvoiceDocument({ invoice: inv2, qrDataUrl, iconSrc = "/invoice/mm-icon.png", heading = "INVOICE", docName = "invoice" }) {
  const th = inv2.theme;
  const t = totals(inv2);
  const cur = inv2.currency;
  const ROW = 13.5;
  const itemsEnd = Math.max(320, 231 + t.lines.length * ROW + 8);
  const addrLines = inv2.client.address.split("\n").filter((l) => l.trim());
  const extraHeader = Math.max(0, addrLines.length - 2) * 9.5 + (inv2.client.vat ? 13 : 0);
  const d = itemsEnd - 320 + extraHeader;
  const noteLines = Math.ceil((inv2.note.length || 1) / 68);
  const noteEnd = 348 + d + noteLines * 8.7;
  const summaryRows = 1 + (t.btw.label ? 1 : 0);
  const summaryEnd = 354 + d + (summaryRows - 1) * 18 + 20;
  const paymentOnNewPage = Math.max(noteEnd, summaryEnd) > 560;
  const footer = /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(View, { style: rule(19, 748, 582, th.ink, 0.9) }),
    /* @__PURE__ */ jsx(Text, { style: at(19.5, 758.5, { fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.9, lineHeight: 1.27, letterSpacing: -0.5 }), children: `${COMPANY.brand} 
[${COMPANY.address} ]` }),
    /* @__PURE__ */ jsx(Text, { style: at(199, 758.5, { fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.9, lineHeight: 1.27, letterSpacing: -0.5 }), children: `[KVK - ${COMPANY.kvk}] 
[BTW - ${COMPANY.btw}] ` }),
    /* @__PURE__ */ jsx(Text, { style: at(383, 758.5, { width: 202, textAlign: "right", fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.9, lineHeight: 1.27, letterSpacing: -0.5 }), children: `[BSN - ${COMPANY.bsn}] 
[Tel ${COMPANY.tel}]` }),
    /* @__PURE__ */ jsx(Image, { src: iconSrc, style: at(19, 794, { width: 27, height: 27 }) })
  ] });
  const payment = /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(View, { style: rule(22, 575, 585, th.ink, 0.9) }),
    /* @__PURE__ */ jsx(Text, { style: at(19, 583, { fontFamily: "Montserrat", fontWeight: 700, fontSize: 32.4, letterSpacing: -1 }), children: "PAYMENT" }),
    /* @__PURE__ */ jsxs(View, { style: at(22, 644, { width: 180 }), children: [
      /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontSize: 12, letterSpacing: -0.6 }, children: "[BANK TRANSFER]" }),
      /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontSize: 12, marginTop: 18.5, letterSpacing: -0.6 }, children: `[${COMPANY.name}]` }),
      /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontSize: 12, marginTop: -3.5, letterSpacing: -0.6 }, children: `[${COMPANY.iban}] ` }),
      /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontSize: 9.9, marginTop: 11.6, letterSpacing: -0.5 }, children: `[TERMS: ${inv2.payment.termsDays} DAYS FROM ISSUE DATE] ` })
    ] }),
    qrDataUrl && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Image, { src: qrDataUrl, style: at(207, 643, { width: 75, height: 75 }) }),
      /* @__PURE__ */ jsx(Text, { style: at(207.3, 721, { width: 82, fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.2, letterSpacing: -0.45 }), children: "SCAN QR TO PAY" })
    ] }),
    /* @__PURE__ */ jsxs(View, { style: at(302, 589, { width: 266 }), children: [
      /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontWeight: 700, fontSize: 8, marginBottom: 4 }, children: "TERMS & CONDITIONS" }),
      STANDARD_TERMS.map((t0) => t0.replace(/\binvoice\b/g, docName)).map((term, i) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", marginLeft: 3 }, children: [
        /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontSize: 6.4, lineHeight: 1.08, width: 6 }, children: `${i + 1}.` }),
        /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontSize: 6.4, lineHeight: 1.08, flex: 1 }, children: term })
      ] }, i)),
      /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontSize: 6.4, lineHeight: 1.08, marginTop: 5, marginLeft: -2 }, children: ` ${TERMS_FOOTNOTE.replace(/\binvoice\b/g, docName)}` })
    ] })
  ] });
  return /* @__PURE__ */ jsxs(Document, { title: `${heading[0]}${heading.slice(1).toLowerCase()} ${inv2.number} \u2014 ${inv2.client.name}`, author: "MediaMarques", creator: "XMEDIA", children: [
    /* @__PURE__ */ jsxs(Page, { size: "A4", style: { backgroundColor: th.bg, color: th.coverInk, fontFamily: "Montserrat" }, children: [
      /* @__PURE__ */ jsx(Text, { style: at(44, 26.5, { fontSize: 12, lineHeight: 1.42, letterSpacing: -0.5 }), children: `${inv2.cover.line1}
${inv2.cover.line2}` }),
      /* @__PURE__ */ jsx(Svg, { viewBox: "0 0 100 100", style: at(440, 15, { width: 100, height: 100 }), children: DOTS.map(([x, y], i) => /* @__PURE__ */ jsx(Circle, { cx: x, cy: y, r: 6, fill: th.dots }, i)) }),
      /* @__PURE__ */ jsx(Text, { style: at(60.5, 476.5, { fontSize: 62.9, fontWeight: 700, letterSpacing: -1.3 }), children: inv2.cover.title }),
      /* @__PURE__ */ jsx(Text, { style: at(59.5, 734, { width: 418, fontSize: 12, fontStyle: "italic", lineHeight: 1.375, letterSpacing: -0.51 }), children: inv2.cover.text })
    ] }),
    /* @__PURE__ */ jsxs(Page, { size: "A4", style: { backgroundColor: th.bg, color: th.ink, fontFamily: "Montserrat" }, children: [
      /* @__PURE__ */ jsx(Text, { style: at(14.4, 19.7, { fontSize: 58, fontWeight: 700, letterSpacing: 0.1 }), children: COMPANY.brand }),
      /* @__PURE__ */ jsx(Text, { style: at(17, 114, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "CLIENT\u2019S DETAILS " }),
      /* @__PURE__ */ jsxs(Text, { style: at(17, 137.5, { fontSize: 10, letterSpacing: -0.5 }), children: [
        /* @__PURE__ */ jsx(Text, { style: { color: th.accent }, children: "[TO]" }),
        " ",
        inv2.client.name
      ] }),
      /* @__PURE__ */ jsxs(View, { style: at(17, 155.5, { width: 300 }), children: [
        addrLines.length > 0 && /* @__PURE__ */ jsxs(Text, { style: { fontSize: 10, lineHeight: 0.92, letterSpacing: -0.5 }, children: [
          /* @__PURE__ */ jsx(Text, { style: { color: th.accent }, children: "[ADDRESS]" }),
          `  ${addrLines.join("\n")}`
        ] }),
        inv2.client.vat ? /* @__PURE__ */ jsxs(Text, { style: { fontSize: 10, marginTop: 4, letterSpacing: -0.5 }, children: [
          /* @__PURE__ */ jsx(Text, { style: { color: th.accent }, children: "[VAT]" }),
          " ",
          inv2.client.vat
        ] }) : null
      ] }),
      /* @__PURE__ */ jsxs(Text, { style: at(17, 182 + extraHeader, { fontSize: 10, letterSpacing: -0.5 }), children: [
        "[",
        /* @__PURE__ */ jsx(Text, { style: { color: th.accent }, children: "ID " }),
        `${inv2.number}]  [ ${invoiceDate(inv2.issue_date)} ]`
      ] }),
      /* @__PURE__ */ jsx(Text, { style: at(300, 130, { width: 274.5 - 0, textAlign: "right", fontSize: 51.2, fontWeight: 700, letterSpacing: -2.2 }), children: heading }),
      /* @__PURE__ */ jsx(View, { style: rule(17, 199 + extraHeader, 576, th.ink) }),
      /* @__PURE__ */ jsx(Text, { style: at(17, 204 + extraHeader, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "ITEM" }),
      /* @__PURE__ */ jsx(Text, { style: at(246, 204 + extraHeader, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "HRS/QTY" }),
      /* @__PURE__ */ jsx(Text, { style: at(392, 204 + extraHeader, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "RATE" }),
      /* @__PURE__ */ jsx(Text, { style: at(480, 204 + extraHeader, { width: 96, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "SUBTOTAL" }),
      /* @__PURE__ */ jsx(View, { style: rule(17, 223.5 + extraHeader, 576, th.ink) }),
      t.lines.map((l, i) => {
        const y = 231.3 + extraHeader + i * ROW;
        return /* @__PURE__ */ jsxs(View, { style: at(17, y, { width: 559, height: ROW }), children: [
          /* @__PURE__ */ jsx(Text, { style: at(0, 0, { width: 225, fontSize: 8, letterSpacing: -0.38, maxLines: 1, textOverflow: "ellipsis" }), children: l.description }),
          /* @__PURE__ */ jsx(Text, { style: at(230, 0, { width: 45, textAlign: "center", fontSize: 8, letterSpacing: -0.38 }), children: String(+l.qty.toFixed(2)) }),
          /* @__PURE__ */ jsx(Text, { style: at(353, 0, { width: 90, textAlign: "center", fontSize: 8, letterSpacing: -0.38 }), children: money(l.rate, cur) }),
          /* @__PURE__ */ jsx(Text, { style: at(459, 0, { width: 100, textAlign: "right", fontSize: 8, letterSpacing: -0.38 }), children: money(l.subtotal, cur) })
        ] }, l.id);
      }),
      /* @__PURE__ */ jsx(View, { style: rule(18, 320 + d, 577, th.ink) }),
      /* @__PURE__ */ jsx(Text, { style: at(20, 332 + d, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "NOTE:" }),
      inv2.note ? /* @__PURE__ */ jsx(Text, { style: at(19.7, 347.8 + d, { width: 278, fontFamily: "Open Sans", fontSize: 8, lineHeight: 1.08 }), children: `NOTE: ${inv2.note}` }) : null,
      /* @__PURE__ */ jsx(Text, { style: at(347, 335.1 + d, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "SUBTOTAL [EXCL. BTW]:" }),
      /* @__PURE__ */ jsx(Text, { style: at(470, 335.1 + d, { width: 106.5, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: money(t.subtotal, cur) }),
      t.btw.label ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Text, { style: at(347, 353.1 + d, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: `${t.btw.label}:` }),
        /* @__PURE__ */ jsx(Text, { style: at(470, 353.1 + d, { width: 106.5, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: money(t.btwAmount, cur) })
      ] }) : null,
      /* @__PURE__ */ jsx(View, { style: rule(347, 354 + d + (summaryRows - 1) * 18, 576, th.ink, 0.8) }),
      /* @__PURE__ */ jsx(Text, { style: at(347, 359.1 + d + (summaryRows - 1) * 18, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5, color: th.total }), children: "TOTAL :" }),
      /* @__PURE__ */ jsx(Text, { style: at(470, 359.1 + d + (summaryRows - 1) * 18, { width: 105, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5, color: th.total }), children: money(t.total, cur) }),
      !paymentOnNewPage && payment,
      !paymentOnNewPage && footer
    ] }),
    paymentOnNewPage && /* @__PURE__ */ jsxs(Page, { size: "A4", style: { backgroundColor: th.bg, color: th.ink, fontFamily: "Montserrat" }, children: [
      payment,
      footer
    ] })
  ] });
}

// scripts/render-invoice.tsx
import { readFileSync } from "node:fs";
import { jsx as jsx2 } from "react/jsx-runtime";
var root = process.cwd();
registerInvoiceFonts(path.join(root, "public/fonts"));
var inv = emptyInvoice("Q4 - #0049", "2026-10-04");
inv.client = { name: "WE ARE SANCTUM LTD.", address: "1st Floor One Suffolk Way\nSevenoaks TN13 1YL GB", country: "GB", vat: "", email: "" };
inv.items = [{ id: "1", description: "\xAE [MM] Post-Production / Reel PRO: - Complete Edit", qty: 3, rate: 245 }];
inv.note = 'Covers the complete edit of 3 final Reels from the Sanctum x GoogleHealth event footage, keeping the Sanctum identity clearly distinct from the GoogleHealth partnership throughout. Each Reel is billed at the agreed all-in "Reel PRO: Complete Edit" rate, which includes the narrative edit, color grading and brand-consistency pass. No additional scope or revisions beyond the agreed three Reels are included.';
inv.payment = { qr: "link", link: "https://www.ing.nl/payreq/m/?trxid=aGIiZzAyaoGETXP07wXSrCt33ntQvQg8", termsDays: 5 };
if (process.env.VARIANT === "nl") {
  inv.number = "Q4 - #0050";
  inv.client = { name: "Studio Noord B.V.", address: "Keizersgracht 100\n1015 AA Amsterdam NL", country: "NL", vat: "", email: "" };
  inv.items = [
    { id: "a", description: "\xAE [MM] Capture Day / Full Day", qty: 1, rate: 900 },
    { id: "b", description: "\xAE [MM] Post-Production / Reel PRO: - Complete Edit", qty: 3, rate: 245 }
  ];
  inv.note = "Teste: BTW autom\xE1tico 21% e QR SEPA.";
  inv.payment = { qr: "epc", link: "", termsDays: 5 };
  inv.theme = { ...inv.theme, accent: "#2F5BFF", total: "#2F5BFF" };
}
if (process.argv[3]) {
  const r = importJson(readFileSync(process.argv[3], "utf8"));
  if (r.errors.length) throw new Error(r.errors.join("\n"));
  Object.assign(inv, r.patch, { items: r.items, payment: { qr: "epc", link: "", termsDays: 5 } });
}
(async () => {
  const content = qrContent(inv, totals(inv).total);
  const qr = content ? await QRCode.toDataURL(content, { margin: 0, width: 420, errorCorrectionLevel: "M" }) : null;
  await renderToFile(/* @__PURE__ */ jsx2(InvoiceDocument, { invoice: inv, qrDataUrl: qr, iconSrc: path.join(root, "public/invoice/mm-icon.png") }), process.argv[2]);
  console.log("ok", process.argv[2]);
})();
