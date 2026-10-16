import { normalizeInvoice, type Invoice } from "@/lib/invoice";
import { HttpError, fail, requirePerm, serviceClient } from "@/lib/server/admin";
import { invoiceLinkUrl, invoiceToken, linkExpiry } from "@/lib/server/invoiceLink";

/** Link digital de uma invoice (para copiar): /i/<token>, válido até ao fim do dia de vencimento. */
export async function POST(req: Request) {
  try {
    const { ownerId } = await requirePerm("finance.view");
    const { id = "" } = (await req.json().catch(() => ({}))) as { id?: string };
    const { data: row } = await serviceClient().from("invoices").select("id, data").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    if (!row) throw new HttpError(404, "not_found");
    const inv = normalizeInvoice({ ...(row.data as Invoice), id: row.id });
    if (inv.void) throw new HttpError(400, "void");
    return Response.json({ url: invoiceLinkUrl(new URL(req.url).origin, invoiceToken(inv, ownerId)), expires: new Date(linkExpiry(inv) * 1000).toISOString() });
  } catch (e) {
    return fail(e);
  }
}
