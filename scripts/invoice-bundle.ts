// Gera a invoice incluída na app a partir do JSON de importação. Uso: node scripts/.invb.mjs <entrada.json> <saida.json> <id> <versao> [status]
import { readFileSync, writeFileSync } from "node:fs";
import { emptyInvoice, importJson, normalizeInvoice, totals } from "../lib/invoice";
const [src, out, id, version, status = "sent"] = process.argv.slice(2);
const r = importJson(readFileSync(src, "utf8"));
if (r.errors.length) throw new Error(r.errors.join("\n"));
const base = emptyInvoice(r.patch.number ?? "", r.patch.issue_date ?? new Date().toISOString().slice(0, 10));
const inv = normalizeInvoice({ ...base, ...r.patch, id, items: r.items.map((x, i) => ({ ...x, id: `${id.slice(0, 8)}-${i + 1}` })), status: status as "sent", bundle_version: Number(version) });
writeFileSync(out, JSON.stringify(inv));
const t = totals(inv);
console.log(inv.number, t.subtotal, t.btwAmount, t.total);
