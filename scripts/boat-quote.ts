import { SEED_SERVICES } from "../lib/services-seed";
import { quote, type QuoteInput } from "../lib/services";
const base = { client: { company: "To be confirmed", name: "", country: "NL" }, partner: false, recurring_months: 0, rush: false };
const A = [
  { service_id: "strategy-on-demand", qty: 1 }, // plano de filmagem / call sheet
  { service_id: "cap-pro-on-demand", qty: 4 }, // ~1h set-up antes das 12:00 + 3h a bordo
  { service_id: "edit-pro", qty: 2 }, // filme 60–90s ≈ 2 unidades de edição PRO (1 vídeo 30–60s/h)
  { service_id: "travel-on-demand", qty: 1 }, // Lelystad → Amsterdam centro, ao custo
];
const B = [...A, { service_id: "pkg-extra-pro", qty: 3 }]; // 3 cortes verticais 9:16
const C = [...B, { service_id: "photo-event-on-demand", qty: 4 }]; // fotógrafo a bordo 4h (~100 fotos)
for (const [k, lines] of Object.entries({ A, B, C })) {
  const q = quote({ ...base, lines } as QuoteInput, SEED_SERVICES);
  console.log(k, JSON.stringify({ gross: q.gross, disc: q.discount, sub: q.subtotal, btw: q.btw, total: q.total, dep: q.deposit, margin: q.margin, lines: q.lines.map((l) => [l.service.id, l.qty, l.unit_price, l.applied_pct, l.net]), w: q.warnings }));
}
