import type { Metadata } from "next";
import { normalizeInvoice, type Invoice } from "@/lib/invoice";
import { serviceClient } from "@/lib/server/admin";
import { readInvoiceToken } from "@/lib/server/invoiceLink";
import { InvoiceView } from "./view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoice · MediaMarques", robots: { index: false, follow: false } };

/** Link digital da invoice: sem login, com token assinado que expira no fim do dia de vencimento. */
export default async function PublicInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = readInvoiceToken(decodeURIComponent(token));
  if ("error" in r) return <InvoiceView error={r.error} />;
  const { data: row } = await serviceClient().from("invoices").select("id, data").eq("id", r.id).eq("owner_id", r.owner).maybeSingle();
  if (!row) return <InvoiceView error="invalid" />;
  const inv = normalizeInvoice({ ...(row.data as Invoice), id: row.id });
  if (inv.void) return <InvoiceView error="invalid" />;
  // só o que o cliente precisa de ver (sem custos internos, notas de origem, etc.)
  const { costs: _c, flags: _f, source: _s, sent_log: _l, ...pub } = inv;
  return <InvoiceView invoice={pub as Invoice} expires={new Date(r.exp * 1000).toISOString()} />;
}
