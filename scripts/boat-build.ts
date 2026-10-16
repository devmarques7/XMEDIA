// Gera a proposta Boat Event com o investimento calculado (catálogo + regras por defeito). Uso: node scripts/.boatb.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeProposal } from "../lib/proposal";
import { applyPricing, pricingSummary } from "../lib/proposalPricing";
import { SEED_SERVICES } from "../lib/services-seed";
const src = JSON.parse(readFileSync("proposals/boat-event-2026-11-14.json", "utf8"));
const p = applyPricing(normalizeProposal(src), SEED_SERVICES);
const s = pricingSummary(p.pricing!, SEED_SERVICES);
p.notes = `Estimated proposal for Mónica. Packages: ${s.packages.map((k) => `${k.name} €${k.quote.subtotal.toFixed(2)}`).join(" · ")} excl. BTW (recommended: Essential + Social). Production €${s.production.subtotal.toFixed(2)} + highlight film = base €${s.base.subtotal.toFixed(2)}. Loose extras: ${s.extras.map((e) => `${e.line.label} +€${e.price.toFixed(2)}`).join(" · ")}. Prices from the XMEDIA services catalogue; travel estimated at cost. 3h on location chosen for best value: ~30 min set-up + 2h30 event; extra hour offered as an option.`;
const { created_at: _c, updated_at: _u, ...out } = p;
writeFileSync("proposals/boat-event-2026-11-14.json", JSON.stringify(out, null, 2));
writeFileSync("lib/bundled/boat-event.json", JSON.stringify(out));
console.log(JSON.stringify({ base: [s.production.subtotal, s.base.subtotal, s.base.total], extras: s.extras.map((e) => [e.line.label, e.price]), full: s.full.subtotal, warn: s.full.warnings, slides: p.doc.slides.map((x) => x.id) }));
