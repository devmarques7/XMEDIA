var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};

// lib/invoice.ts
function resolveBtw(btw, country) {
  if (btw !== "auto") return { rate: btw, label: `BTW ${btw}%`, reason: "manual" };
  const c = (country || "NL").trim().toUpperCase();
  if (c === "NL") return { rate: 21, label: "BTW 21%", reason: "nl" };
  if (EU.includes(c)) return { rate: 0, label: "BTW 0% [REVERSE CHARGE]", reason: "eu_reverse" };
  return { rate: 0, label: "", reason: "outside_eu" };
}
function totals(inv) {
  const lines = inv.items.map((i) => ({ ...i, subtotal: round2((Number(i.qty) || 0) * (Number(i.rate) || 0)) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const btw = resolveBtw(inv.btw, inv.client.country);
  const btwAmount = round2(subtotal * btw.rate / 100);
  return { lines, subtotal, btw, btwAmount, total: round2(subtotal + btwAmount) };
}
function money(n, c) {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}${SYM[c]}${s} ${c}`;
}
function invoiceDate(iso) {
  const d = /* @__PURE__ */ new Date(iso + "T12:00:00");
  return isNaN(+d) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
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
var COMPANY, STANDARD_TERMS, TERMS_FOOTNOTE, THEMES, EU, round2, SYM, uid, ITEMS_TEMPLATE;
var init_invoice = __esm({
  "lib/invoice.ts"() {
    "use strict";
    COMPANY = {
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
    STANDARD_TERMS = [
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
    TERMS_FOOTNOTE = "By accepting this invoice, you agree to these terms and conditions. For  full terms and conditions, please refer to the Client Agreement.";
    THEMES = {
      original: { bg: "#F6F4F0", ink: "#000000", coverInk: "#222222", accent: "#E0552F", total: "#DB4A2B", dots: "#020202" },
      white: { bg: "#FFFFFF", ink: "#000000", coverInk: "#111111", accent: "#E8491D", total: "#E8491D", dots: "#000000" },
      sand: { bg: "#EDE6DA", ink: "#1E1B16", coverInk: "#1E1B16", accent: "#9A5B2E", total: "#9A5B2E", dots: "#1E1B16" },
      ink: { bg: "#F4F4F2", ink: "#0B1B2B", coverInk: "#0B1B2B", accent: "#2F5BFF", total: "#2F5BFF", dots: "#0B1B2B" }
    };
    EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
    round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
    SYM = { EUR: "\u20AC", GBP: "\xA3" };
    uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    ITEMS_TEMPLATE = JSON.stringify(
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
  }
});

// components/InvoicePdf.tsx
import { Circle, Document, Font, Image, Page, Svg, Text, View } from "@react-pdf/renderer";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
function InvoiceDocument({ invoice: inv, qrDataUrl, iconSrc = "/invoice/mm-icon.png", heading = "INVOICE", docName = "invoice" }) {
  const th2 = inv.theme;
  const t = totals(inv);
  const cur = inv.currency;
  const ROW = 13.5;
  const itemsEnd = Math.max(320, 231 + t.lines.length * ROW + 8);
  const addrLines = inv.client.address.split("\n").filter((l) => l.trim());
  const extraHeader = Math.max(0, addrLines.length - 2) * 9.5 + (inv.client.vat ? 13 : 0);
  const d = itemsEnd - 320 + extraHeader;
  const noteLines = Math.ceil((inv.note.length || 1) / 68);
  const noteEnd = 348 + d + noteLines * 8.7;
  const summaryRows = 1 + (t.btw.label ? 1 : 0);
  const summaryEnd = 354 + d + (summaryRows - 1) * 18 + 20;
  const paymentOnNewPage = Math.max(noteEnd, summaryEnd) > 560;
  const footer = /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(View, { style: rule(19, 748, 582, th2.ink, 0.9) }),
    /* @__PURE__ */ jsx(Text, { style: at(19.5, 758.5, { fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.9, lineHeight: 1.27, letterSpacing: -0.5 }), children: `${COMPANY.brand} 
[${COMPANY.address} ]` }),
    /* @__PURE__ */ jsx(Text, { style: at(199, 758.5, { fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.9, lineHeight: 1.27, letterSpacing: -0.5 }), children: `[KVK - ${COMPANY.kvk}] 
[BTW - ${COMPANY.btw}] ` }),
    /* @__PURE__ */ jsx(Text, { style: at(383, 758.5, { width: 202, textAlign: "right", fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.9, lineHeight: 1.27, letterSpacing: -0.5 }), children: `[BSN - ${COMPANY.bsn}] 
[Tel ${COMPANY.tel}]` }),
    /* @__PURE__ */ jsx(Image, { src: iconSrc, style: at(19, 794, { width: 27, height: 27 }) })
  ] });
  const payment = /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(View, { style: rule(22, 575, 585, th2.ink, 0.9) }),
    /* @__PURE__ */ jsx(Text, { style: at(19, 583, { fontFamily: "Montserrat", fontWeight: 700, fontSize: 32.4, letterSpacing: -1 }), children: "PAYMENT" }),
    /* @__PURE__ */ jsxs(View, { style: at(22, 644, { width: 180 }), children: [
      /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontSize: 12, letterSpacing: -0.6 }, children: "[BANK TRANSFER]" }),
      /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontSize: 12, marginTop: 18.5, letterSpacing: -0.6 }, children: `[${COMPANY.name}]` }),
      /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontSize: 12, marginTop: -3.5, letterSpacing: -0.6 }, children: `[${COMPANY.iban}] ` }),
      /* @__PURE__ */ jsx(Text, { style: { fontFamily: "Open Sans", fontSize: 9.9, marginTop: 11.6, letterSpacing: -0.5 }, children: `[TERMS: ${inv.payment.termsDays} DAYS FROM ISSUE DATE] ` })
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
  return /* @__PURE__ */ jsxs(Document, { title: `${heading[0]}${heading.slice(1).toLowerCase()} ${inv.number} \u2014 ${inv.client.name}`, author: "MediaMarques", creator: "XMEDIA", children: [
    /* @__PURE__ */ jsxs(Page, { size: "A4", style: { backgroundColor: th2.bg, color: th2.coverInk, fontFamily: "Montserrat" }, children: [
      /* @__PURE__ */ jsx(Text, { style: at(44, 26.5, { fontSize: 12, lineHeight: 1.42, letterSpacing: -0.5 }), children: `${inv.cover.line1}
${inv.cover.line2}` }),
      /* @__PURE__ */ jsx(Svg, { viewBox: "0 0 100 100", style: at(440, 15, { width: 100, height: 100 }), children: DOTS.map(([x, y], i) => /* @__PURE__ */ jsx(Circle, { cx: x, cy: y, r: 6, fill: th2.dots }, i)) }),
      /* @__PURE__ */ jsx(Text, { style: at(60.5, 476.5, { fontSize: 62.9, fontWeight: 700, letterSpacing: -1.3 }), children: inv.cover.title }),
      /* @__PURE__ */ jsx(Text, { style: at(59.5, 734, { width: 418, fontSize: 12, fontStyle: "italic", lineHeight: 1.375, letterSpacing: -0.51 }), children: inv.cover.text })
    ] }),
    /* @__PURE__ */ jsxs(Page, { size: "A4", style: { backgroundColor: th2.bg, color: th2.ink, fontFamily: "Montserrat" }, children: [
      /* @__PURE__ */ jsx(Text, { style: at(14.4, 19.7, { fontSize: 58, fontWeight: 700, letterSpacing: 0.1 }), children: COMPANY.brand }),
      /* @__PURE__ */ jsx(Text, { style: at(17, 114, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "CLIENT\u2019S DETAILS " }),
      /* @__PURE__ */ jsxs(Text, { style: at(17, 137.5, { fontSize: 10, letterSpacing: -0.5 }), children: [
        /* @__PURE__ */ jsx(Text, { style: { color: th2.accent }, children: "[TO]" }),
        " ",
        inv.client.name
      ] }),
      /* @__PURE__ */ jsxs(View, { style: at(17, 155.5, { width: 300 }), children: [
        addrLines.length > 0 && /* @__PURE__ */ jsxs(Text, { style: { fontSize: 10, lineHeight: 0.92, letterSpacing: -0.5 }, children: [
          /* @__PURE__ */ jsx(Text, { style: { color: th2.accent }, children: "[ADDRESS]" }),
          `  ${addrLines.join("\n")}`
        ] }),
        inv.client.vat ? /* @__PURE__ */ jsxs(Text, { style: { fontSize: 10, marginTop: 4, letterSpacing: -0.5 }, children: [
          /* @__PURE__ */ jsx(Text, { style: { color: th2.accent }, children: "[VAT]" }),
          " ",
          inv.client.vat
        ] }) : null
      ] }),
      /* @__PURE__ */ jsxs(Text, { style: at(17, 182 + extraHeader, { fontSize: 10, letterSpacing: -0.5 }), children: [
        "[",
        /* @__PURE__ */ jsx(Text, { style: { color: th2.accent }, children: "ID " }),
        `${inv.number}]  [ ${invoiceDate(inv.issue_date)} ]`
      ] }),
      /* @__PURE__ */ jsx(Text, { style: at(300, 130, { width: 274.5 - 0, textAlign: "right", fontSize: 51.2, fontWeight: 700, letterSpacing: -2.2 }), children: heading }),
      /* @__PURE__ */ jsx(View, { style: rule(17, 199 + extraHeader, 576, th2.ink) }),
      /* @__PURE__ */ jsx(Text, { style: at(17, 204 + extraHeader, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "ITEM" }),
      /* @__PURE__ */ jsx(Text, { style: at(246, 204 + extraHeader, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "HRS/QTY" }),
      /* @__PURE__ */ jsx(Text, { style: at(392, 204 + extraHeader, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "RATE" }),
      /* @__PURE__ */ jsx(Text, { style: at(480, 204 + extraHeader, { width: 96, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "SUBTOTAL" }),
      /* @__PURE__ */ jsx(View, { style: rule(17, 223.5 + extraHeader, 576, th2.ink) }),
      t.lines.map((l, i) => {
        const y = 231.3 + extraHeader + i * ROW;
        return /* @__PURE__ */ jsxs(View, { style: at(17, y, { width: 559, height: ROW }), children: [
          /* @__PURE__ */ jsx(Text, { style: at(0, 0, { width: 225, fontSize: 8, letterSpacing: -0.38, maxLines: 1, textOverflow: "ellipsis" }), children: l.description }),
          /* @__PURE__ */ jsx(Text, { style: at(230, 0, { width: 45, textAlign: "center", fontSize: 8, letterSpacing: -0.38 }), children: String(+l.qty.toFixed(2)) }),
          /* @__PURE__ */ jsx(Text, { style: at(353, 0, { width: 90, textAlign: "center", fontSize: 8, letterSpacing: -0.38 }), children: money(l.rate, cur) }),
          /* @__PURE__ */ jsx(Text, { style: at(459, 0, { width: 100, textAlign: "right", fontSize: 8, letterSpacing: -0.38 }), children: money(l.subtotal, cur) })
        ] }, l.id);
      }),
      /* @__PURE__ */ jsx(View, { style: rule(18, 320 + d, 577, th2.ink) }),
      /* @__PURE__ */ jsx(Text, { style: at(20, 332 + d, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "NOTE:" }),
      inv.note ? /* @__PURE__ */ jsx(Text, { style: at(19.7, 347.8 + d, { width: 278, fontFamily: "Open Sans", fontSize: 8, lineHeight: 1.08 }), children: `NOTE: ${inv.note}` }) : null,
      /* @__PURE__ */ jsx(Text, { style: at(347, 335.1 + d, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: "SUBTOTAL [EXCL. BTW]:" }),
      /* @__PURE__ */ jsx(Text, { style: at(470, 335.1 + d, { width: 106.5, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: money(t.subtotal, cur) }),
      t.btw.label ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Text, { style: at(347, 353.1 + d, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: `${t.btw.label}:` }),
        /* @__PURE__ */ jsx(Text, { style: at(470, 353.1 + d, { width: 106.5, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5 }), children: money(t.btwAmount, cur) })
      ] }) : null,
      /* @__PURE__ */ jsx(View, { style: rule(347, 354 + d + (summaryRows - 1) * 18, 576, th2.ink, 0.8) }),
      /* @__PURE__ */ jsx(Text, { style: at(347, 359.1 + d + (summaryRows - 1) * 18, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5, color: th2.total }), children: "TOTAL :" }),
      /* @__PURE__ */ jsx(Text, { style: at(470, 359.1 + d + (summaryRows - 1) * 18, { width: 105, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5, color: th2.total }), children: money(t.total, cur) }),
      !paymentOnNewPage && payment,
      !paymentOnNewPage && footer
    ] }),
    paymentOnNewPage && /* @__PURE__ */ jsxs(Page, { size: "A4", style: { backgroundColor: th2.bg, color: th2.ink, fontFamily: "Montserrat" }, children: [
      payment,
      footer
    ] })
  ] });
}
var registered, DOTS, at, rule;
var init_InvoicePdf = __esm({
  "components/InvoicePdf.tsx"() {
    "use strict";
    init_invoice();
    registered = "";
    DOTS = [
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
    at = (left, top, extra = {}) => ({ position: "absolute", left, top, ...extra });
    rule = (left, top, right, color, w = 0.9) => ({
      position: "absolute",
      left,
      top,
      width: right - left,
      borderTopWidth: w,
      borderTopColor: color
    });
  }
});

// lib/services.ts
function normalizeService(x, folders = DEFAULT_FOLDERS) {
  const name = str(x.name).trim() || "Novo servi\xE7o";
  const folder = folders.some((f) => f.id === x.folder) ? String(x.folder) : str(x.folder) ? str(x.folder) : folders[0]?.id ?? "capture";
  const unit = oneOf(x.unit, UNITS, "hour");
  const pass = Boolean(x.pass_through);
  const kind = oneOf(x.kind, KINDS, pass ? "travel" : KIND_OF_FOLDER[folder] ?? "strategy");
  const m = x.market;
  return {
    id: str(x.id) || slug(name),
    name,
    folder,
    kind,
    plan: x.plan == null || x.plan === "" ? null : oneOf(x.plan, PLANS, "on_demand"),
    tier: x.tier === "simple" || x.tier === "pro" ? x.tier : null,
    unit,
    price: Math.max(0, round22(num(x.price))),
    crp: Math.max(0, round22(num(x.crp))),
    hours: Math.max(0, num(x.hours, UNIT_HOURS_DEFAULT[unit])),
    min_margin: Math.min(95, Math.max(0, num(x.min_margin, pass ? 0 : kind === "capture" ? 25 : DEFAULT_RULES.floor_margin))),
    pass_through: pass,
    potential: oneOf(x.potential, POTS, pass ? "passthrough" : "medium"),
    deliverable: str(x.deliverable),
    includes: strs(x.includes),
    use_for: strs(x.use_for),
    not_for: str(x.not_for),
    notes: str(x.notes),
    invoice_label: str(x.invoice_label) || `\xAE [MM] ${name}`,
    market: m && isFinite(+m.low) && isFinite(+m.high) && +m.high > 0 ? { low: +m.low, high: +m.high, per: oneOf(m.per, ["hour", "day", "item", "month"], "hour"), label: str(m.label), sources: strs(m.sources) } : null,
    tags: strs(x.tags),
    uses: Math.max(0, Math.round(num(x.uses))),
    archived: Boolean(x.archived),
    source: x.source && typeof x.source === "object" ? x.source : void 0,
    history: Array.isArray(x.history) ? x.history.slice(-30) : [],
    created_at: str(x.created_at) || void 0,
    updated_at: str(x.updated_at) || void 0
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
function quote(input2, catalog, rulesIn) {
  const rules = normalizeRules(rulesIn);
  const byId = new Map(catalog.map((s) => [s.id, s]));
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
  const lines = picked.map(({ l, s }) => {
    const qty = num(l.qty);
    const hours = round22(qty * s.hours);
    const base = l.price_override != null && isFinite(+l.price_override) ? +l.price_override : s.price;
    const rushAdd = input2.rush && (s.kind === "edit" || s.kind === "reel") && !s.pass_through ? round22(base * rules.rush_pct / 100) : 0;
    const unit_price = round22(base + rushAdd);
    const gross2 = round22(unit_price * qty);
    const crp2 = round22(s.crp * qty);
    const d = { hours: 0, volume: 0, recurring: 0, partner: 0, extra: 0 };
    if (!s.pass_through) {
      if (s.unit !== "item" && (s.kind !== "capture" || rules.hours_on_capture) && s.kind !== "travel") d.hours = tierPct(rules.hours_tiers, hours);
      if (isReel(s)) d.volume = volPct;
      d.recurring = recPct;
      d.partner = input2.partner ? rules.partner_pct : 0;
      d.extra = extra;
    }
    const requested = d.hours + d.volume + d.recurring + d.partner + d.extra;
    let applied = Math.min(requested, rules.cap_pct);
    const capped = requested > rules.cap_pct;
    let floor_limited = false;
    if (!s.pass_through && gross2 > 0 && applied > 0) {
      const maxD = Math.max(0, (1 - crp2 / (gross2 * (1 - s.min_margin / 100))) * 100);
      if (applied > maxD) {
        applied = Math.floor(maxD * 10) / 10;
        floor_limited = true;
      }
    }
    const net = round22(gross2 * (1 - applied / 100));
    const blocked = !s.pass_through && net <= crp2 && gross2 > 0;
    if (capped) warnings.push({ code: "capped", line: s.id });
    if (floor_limited) warnings.push({ code: "floor_limited", line: s.id });
    if (blocked) warnings.push({ code: "blocked", line: s.id });
    else if (!s.pass_through && marginOf(net, crp2) < s.min_margin) warnings.push({ code: "below_floor", line: s.id });
    return {
      service: s,
      label: l.label || s.invoice_label,
      qty,
      hours,
      unit_price,
      gross: gross2,
      discounts: d,
      requested_pct: round22(requested),
      applied_pct: round22(applied),
      capped,
      floor_limited,
      net,
      unit_net: qty ? round22(net / qty) : 0,
      crp: crp2,
      margin: marginOf(net, crp2),
      blocked,
      rush: round22(rushAdd * qty)
    };
  });
  const gross = round22(lines.reduce((s, l) => s + l.gross, 0));
  const subtotal = round22(lines.reduce((s, l) => s + l.net, 0));
  const crp = round22(lines.reduce((s, l) => s + l.crp, 0));
  const country = (input2.client.country || "NL").toUpperCase();
  const btwRate = country === "NL" ? rules.btw : resolveBtw("auto", country).rate;
  const btw = round22(subtotal * btwRate / 100);
  const total = round22(subtotal + btw);
  if (months > 0 && recPct === 0) warnings.push({ code: "recurring_short", detail: String(rules.recurring[0]?.months ?? 3) });
  return {
    lines,
    gross,
    discount: round22(gross - subtotal),
    subtotal,
    btw,
    total,
    deposit: round22(total * rules.deposit_pct / 100),
    crp,
    margin: marginOf(subtotal, crp),
    hours: round22(lines.reduce((s, l) => s + l.hours, 0)),
    reels,
    recurring_pct: recPct,
    btw_rate: btwRate,
    months,
    contract_total: months > 0 ? round22(subtotal * months) : subtotal,
    warnings
  };
}
function quoteItems(q, rulesIn) {
  const rules = normalizeRules(rulesIn);
  const items = q.lines.map((l) => ({ description: l.label + (l.rush ? " (rush)" : ""), qty: l.qty, rate: l.unit_price }));
  const sums = { hours: 0, volume: 0, recurring: 0, partner: 0, extra: 0 };
  for (const l of q.lines) {
    const off = l.gross - l.net;
    if (off <= 0 || l.requested_pct <= 0) continue;
    for (const k of Object.keys(sums)) sums[k] += off * l.discounts[k] / l.requested_pct;
  }
  const keys = Object.keys(sums).filter((k) => round22(sums[k]) > 0);
  const rounded = keys.map((k) => round22(sums[k]));
  const residual = round22(q.discount - rounded.reduce((a, b) => a + b, 0));
  if (keys.length && residual) rounded[rounded.indexOf(Math.max(...rounded))] = round22(rounded[rounded.indexOf(Math.max(...rounded))] + residual);
  keys.forEach((k, i) => items.push({ description: DISC_LABEL[k](q, rules), qty: 1, rate: -rounded[i] }));
  return items;
}
function quoteNote(q, input2, rulesIn) {
  const rules = normalizeRules(rulesIn);
  const parts = [];
  if (q.discount > 0) parts.push(`Discounts applied: ${round22(q.discount / q.gross * 100)}% on the full On-Demand price (combined discounts are capped at ${rules.cap_pct}%).`);
  if (q.lines.some((l) => l.floor_limited)) parts.push("Some discounts were limited to keep the production standard of each service.");
  if (q.months > 0) parts.push(`Monthly fee for a ${q.months}-month contract \u2014 contract value ${q.contract_total.toFixed(2)} excl. BTW.`);
  if (input2.rush) parts.push(`Same-day/rush delivery: +${rules.rush_pct}% on editing.`);
  parts.push(`${rules.deposit_pct}% deposit to confirm the date.`);
  if (input2.note) parts.push(input2.note);
  return parts.join(" ");
}
var DEFAULT_RULES, DEFAULT_FOLDERS, KIND_OF_FOLDER, UNIT_HOURS_DEFAULT, round22, num, str, strs, oneOf, uid2, slug, UNITS, PLANS, KINDS, POTS, marginOf, hourlyOf, tierPct, recurringPct, isReel, SRC_VIDEO, SRC_EDIT, SRC_REEL, SRC_PHOTO, MARKET, DISC_LABEL;
var init_services = __esm({
  "lib/services.ts"() {
    "use strict";
    init_invoice();
    DEFAULT_RULES = {
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
    DEFAULT_FOLDERS = [
      { id: "capture", label: "Capta\xE7\xE3o de v\xEDdeo", color: "#ff5a1f", order: 1, hint: "Horas e di\xE1rias de filmagem \u2014 material bruto, sem edi\xE7\xE3o." },
      { id: "edit", label: "Edi\xE7\xE3o de v\xEDdeo", color: "#7c5cff", order: 2, hint: "Edi\xE7\xE3o Basic/PRO, di\xE1rias de edi\xE7\xE3o, legendas." },
      { id: "video_pkg", label: "Reels & pacotes v\xEDdeo", color: "#ffb020", order: 3, hint: "Capta\xE7\xE3o + edi\xE7\xE3o num pre\xE7o fechado; reels extra." },
      { id: "photo", label: "Fotografia", color: "#1fb6ff", order: 4, hint: "Sess\xF5es, eventos, edi\xE7\xE3o e extras de foto." },
      { id: "photo_pkg", label: "Pacotes de foto", color: "#13c296", order: 5, hint: "Assinaturas mensais e banco de imagens da marca." },
      { id: "preprod", label: "Pr\xE9-produ\xE7\xE3o & log\xEDstica", color: "#8a8f98", order: 6, hint: "Estrat\xE9gia, roteiro e deslocamento." }
    ];
    KIND_OF_FOLDER = { capture: "capture", edit: "edit", video_pkg: "reel", photo: "photo", photo_pkg: "photo", preprod: "strategy" };
    UNIT_HOURS_DEFAULT = { hour: 1, day: 6, item: 1, session: 2, month: 2, trip: 0 };
    round22 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
    num = (v, d = 0) => typeof v === "number" && isFinite(v) ? v : typeof v === "string" && v.trim() && isFinite(+v) ? +v : d;
    str = (v, d = "") => typeof v === "string" ? v : d;
    strs = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : typeof v === "string" ? v.split(/\n|;/).map((x) => x.replace(/^[•\-\s]+/, "").trim()).filter(Boolean) : [];
    oneOf = (v, list, d) => list.includes(v) ? v : d;
    uid2 = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || uid2();
    UNITS = ["hour", "day", "item", "session", "month", "trip"];
    PLANS = ["on_demand", "frequency", "day", "extra", "package"];
    KINDS = ["capture", "edit", "reel", "photo", "strategy", "travel"];
    POTS = ["high", "medium", "review", "passthrough"];
    marginOf = (price, crp) => price > 0 ? round22((price - crp) / price * 100) : 0;
    hourlyOf = (s) => s.hours > 0 ? round22(s.price / s.hours) : null;
    tierPct = (tiers, n) => tiers.reduce((p, t) => n >= t.min ? t.pct : p, 0);
    recurringPct = (rules, months) => rules.recurring.reduce((p, r) => months >= r.months ? r.pct : p, 0);
    isReel = (s) => (s.kind === "edit" || s.kind === "reel") && (s.unit === "item" || s.unit === "hour");
    SRC_VIDEO = ["Ruah Creative House \u2014 Freelance Videographer Rates 2026", "getcameracrew.com \u2014 Amsterdam crew cost", "daily-rate.eu \u2014 Netherlands 2026", "Airframe Media \u2014 London/EU Day Rates 2026"];
    SRC_EDIT = ["solohourly.com \u2014 Germany Video Editor Rates 2026", "reel-rate.com \u2014 Video Editor Rates by Country 2026"];
    SRC_REEL = ["D-MAK Productions \u2014 Social Media Video Pricing 2026", "advids.co \u2014 Amsterdam social video agencies"];
    SRC_PHOTO = ["Benchmark interno NL/EU 2026 (Notion \xA73) \u2014 fotografia de neg\xF3cios"];
    MARKET = {
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
    DISC_LABEL = {
      hours: () => "\xAE Volume Discount \u2014 hours (same day/location)",
      volume: (q) => `\xAE Volume Discount \u2014 ${q.reels} deliverables`,
      recurring: (q) => `\xAE Recurring Contract Discount \u2014 ${q.months} months (${q.recurring_pct}%)`,
      partner: (_q, r) => `\xAE Partnership Discount (${r.partner_pct}%)`,
      extra: () => "\xAE Special Condition"
    };
  }
});

// components/ServicesPdf.tsx
import { Circle as Circle2, Document as Document2, Image as Image2, Page as Page2, Svg as Svg2, Text as Text2, View as View2 } from "@react-pdf/renderer";
import { Fragment as Fragment2, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function Footer({ iconSrc }) {
  const t = { fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.9, lineHeight: 1.27, letterSpacing: -0.5 };
  return /* @__PURE__ */ jsxs2(Fragment2, { children: [
    /* @__PURE__ */ jsx2(View2, { style: { position: "absolute", left: 19, top: 748, width: 563, borderTopWidth: 0.9, borderTopColor: th.ink }, fixed: true }),
    /* @__PURE__ */ jsx2(Text2, { style: at2(19.5, 758.5, t), fixed: true, children: `${COMPANY.brand} 
[${COMPANY.address} ]` }),
    /* @__PURE__ */ jsx2(Text2, { style: at2(199, 758.5, t), fixed: true, children: `[KVK - ${COMPANY.kvk}] 
[BTW - ${COMPANY.btw}] ` }),
    /* @__PURE__ */ jsx2(Text2, { style: at2(383, 758.5, { ...t, width: 202, textAlign: "right" }), fixed: true, children: `[BSN - ${COMPANY.bsn}] 
[Tel ${COMPANY.tel}]` }),
    /* @__PURE__ */ jsx2(Image2, { src: iconSrc, style: at2(19, 794, { width: 27, height: 27 }), fixed: true }),
    /* @__PURE__ */ jsx2(Text2, { style: at2(500, 800, { width: 76, textAlign: "right", fontSize: 8 }), render: ({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`, fixed: true })
  ] });
}
function ServicesDocument({ services, folders, rules, title = "SERVICES", intro, iconSrc = "/invoice/mm-icon.png", date }) {
  const year = date.slice(0, 4);
  const groups = folders.map((f) => ({ f, list: services.filter((s) => s.folder === f.id && !s.archived).sort((a, b) => a.price - b.price) })).filter((g) => g.list.length);
  const cell = { fontSize: 8, letterSpacing: -0.38 };
  const head = { fontSize: 9, fontWeight: 700, letterSpacing: -0.45 };
  return /* @__PURE__ */ jsxs2(Document2, { title: `MediaMarques \u2014 ${title} ${year}`, author: "MediaMarques", creator: "XMEDIA", children: [
    /* @__PURE__ */ jsxs2(Page2, { size: "A4", style: { backgroundColor: th.bg, color: th.coverInk, fontFamily: "Montserrat" }, children: [
      /* @__PURE__ */ jsx2(Text2, { style: at2(44, 26.5, { fontSize: 12, lineHeight: 1.42, letterSpacing: -0.5 }), children: `Media Marques \xA9
Services [${year}]` }),
      /* @__PURE__ */ jsx2(Svg2, { viewBox: "0 0 100 100", style: at2(440, 15, { width: 100, height: 100 }), children: DOTS.map(([x, y], i) => /* @__PURE__ */ jsx2(Circle2, { cx: x, cy: y, r: 6, fill: th.dots }, i)) }),
      /* @__PURE__ */ jsx2(Text2, { style: at2(60.5, 476.5, { fontSize: 62.9, fontWeight: 700, letterSpacing: -1.3 }), children: title }),
      /* @__PURE__ */ jsx2(Text2, { style: at2(59.5, 734, { width: 418, fontSize: 12, fontStyle: "italic", lineHeight: 1.375, letterSpacing: -0.51 }), children: intro ?? "Rates for audiovisual production, editing and photography by Media Marques. All prices exclude BTW and refer to the On-Demand rate unless stated otherwise." })
    ] }),
    /* @__PURE__ */ jsxs2(Page2, { size: "A4", style: { backgroundColor: th.bg, color: th.ink, fontFamily: "Montserrat", paddingTop: 120, paddingBottom: 110, paddingHorizontal: 17 }, wrap: true, children: [
      /* @__PURE__ */ jsx2(Text2, { style: at2(14.4, 19.7, { fontSize: 58, fontWeight: 700, letterSpacing: 0.1 }), fixed: true, children: COMPANY.brand }),
      groups.map(({ f, list }) => /* @__PURE__ */ jsxs2(View2, { style: { marginBottom: 16 }, wrap: false, children: [
        /* @__PURE__ */ jsxs2(Text2, { style: { fontSize: 14, fontWeight: 700, letterSpacing: -0.6, marginBottom: 4 }, children: [
          /* @__PURE__ */ jsxs2(Text2, { style: { color: th.accent }, children: [
            "[",
            String(f.order).padStart(2, "0"),
            "]"
          ] }),
          " ",
          f.label.toUpperCase()
        ] }),
        /* @__PURE__ */ jsxs2(View2, { style: { borderTopWidth: 0.9, borderTopColor: th.ink, borderBottomWidth: 0.9, borderBottomColor: th.ink, flexDirection: "row", paddingVertical: 4 }, children: [
          /* @__PURE__ */ jsx2(Text2, { style: { ...head, width: 290 }, children: "ITEM" }),
          /* @__PURE__ */ jsx2(Text2, { style: { ...head, width: 60, textAlign: "center" }, children: "UNIT" }),
          /* @__PURE__ */ jsx2(Text2, { style: { ...head, width: 60, textAlign: "center" }, children: "HRS" }),
          /* @__PURE__ */ jsx2(Text2, { style: { ...head, width: 70, textAlign: "right" }, children: "\u20AC/H" }),
          /* @__PURE__ */ jsx2(Text2, { style: { ...head, flex: 1, textAlign: "right" }, children: "RATE" })
        ] }),
        list.map((s) => /* @__PURE__ */ jsxs2(View2, { style: { flexDirection: "row", paddingVertical: 3.5, borderBottomWidth: 0.3, borderBottomColor: "#00000033" }, children: [
          /* @__PURE__ */ jsxs2(View2, { style: { width: 290, paddingRight: 8 }, children: [
            /* @__PURE__ */ jsx2(Text2, { style: { ...cell, fontWeight: 700 }, children: s.invoice_label.replace(/^®\s*\[MM\]\s*/, "") }),
            s.deliverable ? /* @__PURE__ */ jsx2(Text2, { style: { fontFamily: "Open Sans", fontSize: 6.6, lineHeight: 1.15, marginTop: 1.5, color: "#333" }, children: s.deliverable }) : null
          ] }),
          /* @__PURE__ */ jsx2(Text2, { style: { ...cell, width: 60, textAlign: "center" }, children: UNIT[s.unit] }),
          /* @__PURE__ */ jsx2(Text2, { style: { ...cell, width: 60, textAlign: "center" }, children: s.hours ? String(+s.hours.toFixed(2)) : "\u2014" }),
          /* @__PURE__ */ jsx2(Text2, { style: { ...cell, width: 70, textAlign: "right" }, children: hourlyOf(s) ? money(hourlyOf(s), "EUR").replace(" EUR", "") : "\u2014" }),
          /* @__PURE__ */ jsx2(Text2, { style: { ...cell, flex: 1, textAlign: "right", fontWeight: 700 }, children: money(s.price, "EUR") })
        ] }, s.id))
      ] }, f.id)),
      /* @__PURE__ */ jsxs2(View2, { style: { marginTop: 6 }, wrap: false, children: [
        /* @__PURE__ */ jsxs2(Text2, { style: { fontSize: 14, fontWeight: 700, letterSpacing: -0.6, marginBottom: 4 }, children: [
          /* @__PURE__ */ jsx2(Text2, { style: { color: th.accent }, children: "[%]" }),
          " DISCOUNTS"
        ] }),
        /* @__PURE__ */ jsx2(Text2, { style: { fontFamily: "Open Sans", fontSize: 7.5, lineHeight: 1.3 }, children: `Hours (same day/location): ${rules.hours_tiers.filter((t) => t.pct).map((t) => `${t.min}h+ ${t.pct}%`).join(" \xB7 ")}.  Deliverables per cycle: ${rules.volume_tiers.filter((t) => t.pct).map((t) => `${t.min}+ ${t.pct}%`).join(" \xB7 ")}.  Recurring contract: ${rules.recurring.map((r) => `${r.months} months ${r.pct}%`).join(" \xB7 ")}.  Combined discounts never exceed ${rules.cap_pct}%. Travel is charged at cost (\u20AC0.40/km + parking). Prices excl. BTW ${rules.btw}%; ${rules.deposit_pct}% deposit to confirm a date.` })
      ] }),
      /* @__PURE__ */ jsx2(Footer, { iconSrc })
    ] })
  ] });
}
var th, at2, UNIT;
var init_ServicesPdf = __esm({
  "components/ServicesPdf.tsx"() {
    "use strict";
    init_invoice();
    init_services();
    init_InvoicePdf();
    th = THEMES.original;
    at2 = (left, top, extra = {}) => ({ position: "absolute", left, top, ...extra });
    UNIT = { hour: "HOUR", day: "DAY", item: "ITEM", session: "SESSION", month: "MONTH", trip: "TRIP" };
  }
});

// scripts/render-services.tsx
init_InvoicePdf();
init_ServicesPdf();
import { renderToFile } from "@react-pdf/renderer";
import path from "node:path";

// lib/services-seed.ts
init_services();
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

// scripts/render-services.tsx
init_services();

// lib/servicePdf.tsx
init_invoice();
init_services();
import { jsx as jsx3 } from "react/jsx-runtime";
var uid3 = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
function quoteDocument(q, input2, rules, number, today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) {
  const base = emptyInvoice(number, today);
  const who = [input2.client.company, input2.client.name].filter(Boolean).join(" \u2014 Attn. ");
  return {
    ...base,
    client: { ...base.client, name: who || "Client", email: input2.client.email ?? "", country: (input2.client.country || "NL").toUpperCase() },
    items: quoteItems(q, rules).map((i) => ({ ...i, id: uid3() })),
    note: quoteNote(q, input2, rules),
    payment: { ...base.payment, qr: "none" },
    cover: {
      line1: "Media Marques \xA9",
      line2: `Proposals [${today.slice(0, 4)}]`,
      title: "PROPOSAL",
      text: "This proposal summarises the audiovisual production services, rates and conditions offered by Media Marques. Prices exclude BTW and are valid for 30 days."
    }
  };
}

// scripts/render-services.tsx
import { jsx as jsx4 } from "react/jsx-runtime";
var root = process.cwd();
var out = process.argv[2] ?? ".";
registerInvoiceFonts(path.join(root, "public/fonts"));
var icon = path.join(root, "public/invoice/mm-icon.png");
var input = {
  client: { name: "Carolina Oconitrillo", company: "Sanctum BV", country: "NL" },
  lines: [
    { service_id: "cap-pro-on-demand", qty: 3 },
    { service_id: "edit-pro", qty: 4 },
    { service_id: "strategy-on-demand", qty: 1 },
    { service_id: "travel-on-demand", qty: 1 }
  ],
  partner: true,
  recurring_months: 6,
  rush: false
};
(async () => {
  await renderToFile(/* @__PURE__ */ jsx4(ServicesDocument, { services: SEED_SERVICES, folders: DEFAULT_FOLDERS, rules: DEFAULT_RULES, date: "2026-10-13", iconSrc: icon }), path.join(out, "services.pdf"));
  const q = quote(input, SEED_SERVICES);
  const doc = quoteDocument(q, input, DEFAULT_RULES, "P-261013-1200", "2026-10-13");
  await renderToFile(/* @__PURE__ */ jsx4(InvoiceDocument, { invoice: doc, qrDataUrl: null, iconSrc: icon, heading: "PROPOSAL", docName: "proposal" }), path.join(out, "quote.pdf"));
  console.log("ok", q.subtotal, q.total);
})();
