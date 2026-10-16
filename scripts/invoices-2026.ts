// Gera as invoices de 2026 (Notion › Finance › Invoices) e os clientes incluídos na app.
// Uso: node scripts/.inv26.mjs  → lib/bundled/invoices-2026.json + lib/bundled/customers-2026.json
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { emptyCustomer, normalizeCustomer, type Billing, type Customer } from "../lib/customer";
import { importJson, normalizeInvoice, totals, type Invoice, type InvoiceCategory } from "../lib/invoice";

const VERSION = 1;
const uuid = (key: string) => {
  const h = createHash("sha256").update(`xmedia:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
type Src = {
  clients: Record<string, { name: string; address: string; country: string; vat: string; email: string; kvk?: string; bsn?: string }>;
  invoices: { key: string; number: string; issue_date: string; status: "draft" | "sent" | "paid"; category: InvoiceCategory; client: string; btw: 0 | 21; items: { description: string; qty: number; rate: number }[]; note: string; notion: string; file: string | null; costs: number | null; void: boolean; flags: string[] }[];
};
const src: Src = JSON.parse(readFileSync("data/invoices-2026.json", "utf8"));

// clientes: [chave, nome no sistema, nomes já existentes (alias), língua]
const CUST: [string, string, string[], "pt" | "en" | "nl"][] = [
  ["gc", "GC Clinic", [], "nl"],
  ["wj", "E-bikes ecosystem", ["WJ-EBIKES", "WJ Ebikes"], "pt"],
  ["viva", "Viva Fashion — Vanessa Nantes", [], "pt"],
  ["carine", "Carine Hair Salon", ["Carine Lopes Hairstudio"], "pt"],
  ["369", "369 Premium Hair", [], "pt"],
  ["leticia", "WHY NOT FLY", ["Letícia Lana"], "pt"],
  ["marcio", "Marcio Velter", [], "pt"],
  ["izabel", "Izabel Fernandes — With Meaning", [], "pt"],
  ["jeffrey", "Jeffrey Chirino", [], "en"],
  ["donna", "Donna Agency", [], "pt"],
  ["wagner", "Wagner Moço de Souza", [], "pt"],
  ["manuela", "Manuela Hugo Photography", [], "pt"],
  ["mavi", "Carioca Restaurant", ["Mavi", "Maria Vitoria Mattoso"], "pt"],
  ["frame", "Frame Your Story — Caroline & Felipe", [], "pt"],
  ["brenda", "Brenda Machado — M/Mentor", [], "pt"],
  ["advent", "Adventisten — adventistgroei.nl", ["Kerkgenootschap der Zevende-dags Adventisten"], "nl"],
  ["bueno", "Schilders Bedrijf Bueno", ["Schilderbedrijf Bueno"], "pt"],
  ["alexia", "Alexia Waagmeester Mentoring", [], "en"],
  ["sanctum", "Luuk Melisse | Personal Brand", ["Sanctum", "Sanctum BV"], "en"],
  ["intuity", "Intuity Coaching", [], "en"],
  ["gustavo", "Eichholtz — Gustavo Henrique", ["Gustavo Henrique Lda"], "pt"],
  ["apollo", "Apollo GraphQL", [], "en"],
];
const custId = (k: string) => uuid(`customer:${k}`);
const billingOf = (k: string): Billing => {
  const c = src.clients[k];
  const [company, contact = ""] = c.name.split(" — Attn. ");
  return { company, contact, address: c.address, country: c.country, vat: c.vat, kvk: c.kvk ?? "", email: c.email };
};
const customers: (Customer & { match: string[] })[] = CUST.map(([k, name, alias, lang]) => {
  const b = billingOf(k);
  const nInv = src.invoices.filter((i) => i.client === k && !i.void);
  const last = nInv.map((i) => i.issue_date).sort().at(-1) ?? "";
  return {
    ...normalizeCustomer({ ...emptyCustomer(name), id: custId(k), lang, stage: "complete", contact: b.contact, email: b.email, contract_signed: true, notes: `Cliente importado do Notion (Finance › Invoices 2026): ${nInv.length} invoice(s), última em ${last}.`, plan: { active: false, price: null, since: "", paid_until: "" } }),
    billing: b,
    bundle_version: VERSION,
    match: [name, b.company, ...alias, ...(b.email ? [b.email] : [])],
  };
});

const COVER_TEXT = "This invoice refers to professional services provided by Media Marques, including audiovisual production and/or software development services, as agreed with the client.";
const invoices: Invoice[] = src.invoices.map((s) => {
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
    cover: { line1: "Media Marques ©", line2: "Invoices [2026]", title: "INVOICE", text: COVER_TEXT },
    bundle_version: VERSION,
    category: s.category,
    void: s.void || undefined,
    attachment: s.file,
    source: s.notion,
    costs: s.costs,
    flags: s.flags.length ? s.flags : undefined,
    customer_id: custId(s.client),
  });
  if (s.file && !existsSync(`data/invoices-2026/${s.file}`)) throw new Error(`falta ${s.file}`);
  return inv;
});

// Q4 - #0051 (Sanctum · Het Sieraad) corrigida: morada "Singel 174" (sem "a"), como a #0047
{
  const r = importJson(readFileSync("invoices/sanctum-q4-0051.json", "utf8"));
  if (r.errors.length) throw new Error(r.errors.join("\n"));
  const id = "4f8d0051-5a1c-4c2e-9b6e-0a51c0de2026";
  invoices.push(normalizeInvoice({ ...r.patch, id, status: "sent", items: r.items.map((x, i) => ({ ...x, id: `4f8d0051-${i + 1}` })), bundle_version: VERSION, category: "production", attachment: "q4-0051-sanctum.pdf", customer_id: custId("sanctum") }));
}

writeFileSync("lib/bundled/invoices-2026.json", JSON.stringify(invoices));
writeFileSync("lib/bundled/customers-2026.json", JSON.stringify(customers));
let sum = 0;
for (const i of invoices) {
  const t = totals(i);
  if (!i.void) sum += t.total;
  console.log(i.number.padEnd(24), (i.category ?? "").padEnd(10), i.status.padEnd(5), i.void ? "VOID" : "    ", String(t.subtotal).padStart(9), String(t.btwAmount).padStart(8), String(t.total).padStart(9), i.client.name.slice(0, 40));
}
console.log(invoices.length, "invoices ·", customers.length, "clientes · total (sem anuladas)", Math.round(sum * 100) / 100);
