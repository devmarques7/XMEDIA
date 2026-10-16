// PDFs do catálogo no template MediaMarques: proposta/orçamento (template do invoice, "PROPOSAL") e tabela de serviços.
import { emptyInvoice, type Invoice } from "./invoice";
import { quoteItems, quoteNote, type PricingRules, type QuoteInput, type QuoteResult, type Service, type ServiceFolder } from "./services";

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

/** Converte o orçamento num documento com a estrutura do invoice (capa + detalhes + pagamento + termos). */
export function quoteDocument(q: QuoteResult, input: QuoteInput, rules: PricingRules, number: string, today = new Date().toISOString().slice(0, 10)): Invoice {
  const base = emptyInvoice(number, today);
  const who = [input.client.company, input.client.name].filter(Boolean).join(" — Attn. ");
  return {
    ...base,
    client: { ...base.client, name: who || "Client", email: input.client.email ?? "", country: (input.client.country || "NL").toUpperCase() },
    items: quoteItems(q, rules).map((i) => ({ ...i, id: uid() })),
    note: quoteNote(q, input, rules),
    payment: { ...base.payment, qr: "none" },
    cover: {
      line1: "Media Marques ©",
      line2: `Proposals [${today.slice(0, 4)}]`,
      title: "PROPOSAL",
      text: "This proposal summarises the audiovisual production services, rates and conditions offered by Media Marques. Prices exclude BTW and are valid for 30 days.",
    },
  };
}

export const quoteNumber = (today = new Date()) => `P-${today.toISOString().slice(2, 10).replace(/-/g, "")}-${String(today.getHours()).padStart(2, "0")}${String(today.getMinutes()).padStart(2, "0")}`;

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function downloadQuotePdf(q: QuoteResult, input: QuoteInput, rules: PricingRules, number: string) {
  const [{ pdf }, { InvoiceDocument, registerInvoiceFonts }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/InvoicePdf")]);
  registerInvoiceFonts(`${location.origin}/fonts`);
  const doc = quoteDocument(q, input, rules, number);
  const blob = await pdf(<InvoiceDocument invoice={doc} qrDataUrl={null} iconSrc={`${location.origin}/invoice/mm-icon.png`} heading="PROPOSAL" docName="proposal" />).toBlob();
  const who = (input.client.company || input.client.name || "CLIENT").split(/\s+/)[0].toUpperCase().replace(/[^\w-]/g, "");
  save(blob, `[${who}]©MM.Proposal[${new Date().getFullYear()}]-${number}.pdf`);
}

export async function downloadCatalogPdf(services: Service[], folders: ServiceFolder[], rules: PricingRules, title?: string) {
  const [{ pdf }, { registerInvoiceFonts }, { ServicesDocument }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/InvoicePdf"), import("@/components/ServicesPdf")]);
  registerInvoiceFonts(`${location.origin}/fonts`);
  const date = new Date().toISOString().slice(0, 10);
  const blob = await pdf(<ServicesDocument services={services} folders={folders} rules={rules} title={title} date={date} iconSrc={`${location.origin}/invoice/mm-icon.png`} />).toBlob();
  save(blob, `©MM.Services[${date.slice(0, 4)}].pdf`);
}
