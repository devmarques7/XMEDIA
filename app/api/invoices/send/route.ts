import type { Lang } from "@/lib/i18n";
import { normalizeInvoice, type Invoice } from "@/lib/invoice";
import { invoiceEmail } from "@/lib/invoiceEmail";
import { invoiceFrom, sendEmail } from "@/lib/inviteEmail";
import { HttpError, fail, requirePerm, serviceClient } from "@/lib/server/admin";

export const maxDuration = 60;
const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;
const MAX_PDF = 4 * 1024 * 1024;

/** De onde saem as invoices (para mostrar no ecrã) e se o email está configurado. */
export async function GET() {
  try {
    await requirePerm("finance.view");
    return Response.json({ from: invoiceFrom(), configured: Boolean(process.env.RESEND_API_KEY?.trim()) });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Envia a invoice por email a partir de invoices@mediamarques.com (INVOICE_FROM), com o PDF em anexo (gerado no
 * browser, o mesmo do botão PDF). Depois: rascunho → enviada e o envio fica registado na invoice (sent_log).
 */
export async function POST(req: Request) {
  try {
    const { ownerId, user } = await requirePerm("finance.view");
    const b = (await req.json().catch(() => ({}))) as { id?: string; to?: string; cc?: string[]; message?: string; lang?: Lang; name?: string; pdf?: string; filename?: string };
    const to = String(b.to ?? "").trim().toLowerCase();
    const cc = (Array.isArray(b.cc) ? b.cc : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    if (!EMAIL.test(to) || cc.some((x) => !EMAIL.test(x))) throw new HttpError(400, "bad_email");
    if (cc.length > 5) throw new HttpError(400, "too_many");
    const pdf = Buffer.from(String(b.pdf ?? ""), "base64");
    if (!pdf.length || pdf.length > MAX_PDF || pdf.subarray(0, 4).toString() !== "%PDF") throw new HttpError(400, "bad_pdf");

    const db = serviceClient();
    const { data: row } = await db.from("invoices").select("id, data").eq("id", String(b.id ?? "")).eq("owner_id", ownerId).maybeSingle();
    if (!row) throw new HttpError(404, "not_found");
    const inv = normalizeInvoice({ ...(row.data as Invoice), id: row.id });
    if (inv.void) throw new HttpError(400, "void");

    const lang: Lang = b.lang === "pt" || b.lang === "nl" ? b.lang : "en";
    const origin = new URL(req.url).origin;
    const mail = invoiceEmail(inv, { lang, origin, name: b.name, message: String(b.message ?? "").slice(0, 2000) });
    const filename = (String(b.filename ?? "").replace(/[\\/\r\n]/g, "").slice(0, 120) || `${inv.number}.pdf`).replace(/(?<!\.pdf)$/i, ".pdf");
    const res = await sendEmail(to, mail, { from: invoiceFrom(), cc: cc.length ? cc : undefined, attachments: [{ filename, content: pdf.toString("base64") }] });
    if (!res.sent) return Response.json({ sent: false, reason: res.reason, from: invoiceFrom() });

    const at = new Date().toISOString();
    const next: Invoice = { ...inv, status: inv.status === "draft" ? "sent" : inv.status, sent_log: [...(inv.sent_log ?? []), { at, to, ...(cc.length ? { cc } : {}), by: user.email ?? undefined, email_id: res.id }] };
    const { created_at: _c, updated_at: _u, ...data } = next;
    const { error } = await db.from("invoices").update({ status: next.status, data }).eq("id", inv.id).eq("owner_id", ownerId);
    if (error) throw error;
    return Response.json({ sent: true, from: invoiceFrom(), to, status: next.status, at });
  } catch (e) {
    return fail(e);
  }
}
