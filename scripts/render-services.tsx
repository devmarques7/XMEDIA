// Renderiza a tabela de serviços e um orçamento de exemplo. Uso: node scripts/.svc.mjs <pasta-saida>
import { renderToFile } from "@react-pdf/renderer";
import path from "node:path";
import { InvoiceDocument, registerInvoiceFonts } from "../components/InvoicePdf";
import { ServicesDocument } from "../components/ServicesPdf";
import { SEED_SERVICES } from "../lib/services-seed";
import { DEFAULT_FOLDERS, DEFAULT_RULES, quote, type QuoteInput } from "../lib/services";
import { quoteDocument } from "../lib/servicePdf";

const root = process.cwd();
const out = process.argv[2] ?? ".";
registerInvoiceFonts(path.join(root, "public/fonts"));
const icon = path.join(root, "public/invoice/mm-icon.png");
const input: QuoteInput = {
  client: { name: "Carolina Oconitrillo", company: "Sanctum BV", country: "NL" },
  lines: [
    { service_id: "cap-pro-on-demand", qty: 3 },
    { service_id: "edit-pro", qty: 4 },
    { service_id: "strategy-on-demand", qty: 1 },
    { service_id: "travel-on-demand", qty: 1 },
  ],
  partner: true,
  recurring_months: 6,
  rush: false,
};
(async () => {
  await renderToFile(<ServicesDocument services={SEED_SERVICES} folders={DEFAULT_FOLDERS} rules={DEFAULT_RULES} date="2026-10-13" iconSrc={icon} />, path.join(out, "services.pdf"));
  const q = quote(input, SEED_SERVICES);
  const doc = quoteDocument(q, input, DEFAULT_RULES, "P-261013-1200", "2026-10-13");
  await renderToFile(<InvoiceDocument invoice={doc} qrDataUrl={null} iconSrc={icon} heading="PROPOSAL" docName="proposal" />, path.join(out, "quote.pdf"));
  console.log("ok", q.subtotal, q.total);
})();
