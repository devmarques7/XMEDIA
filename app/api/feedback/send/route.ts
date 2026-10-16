import { randomToken, sha256 } from "@/lib/codes";
import type { Customer } from "@/lib/customer";
import { roundOf, type FbRequest } from "@/lib/feedback";
import { feedbackEmail } from "@/lib/feedbackEmail";
import type { Lang } from "@/lib/i18n";
import { sendEmail } from "@/lib/inviteEmail";
import { HttpError, fail, requirePerm, serviceClient } from "@/lib/server/admin";

type Body = { customerId: string; email: string; name?: string; lang?: Lang; days?: number; send?: boolean; sender?: string };

/**
 * Cria um pedido de avaliação (link de uso único /f/<token>) para um cliente e, se `send`, envia-o por email.
 * Só o hash do token fica guardado (customers.data.feedback). Sem RESEND_API_KEY devolve o link para enviar à mão.
 */
export async function POST(req: Request) {
  try {
    const { ownerId } = await requirePerm("customers.edit");
    const b = (await req.json()) as Body;
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "bad_email");
    const lang: Lang = b.lang === "en" || b.lang === "nl" ? b.lang : "pt";
    const db = serviceClient();
    const { data: row } = await db.from("customers").select("id, data").eq("id", b.customerId).eq("owner_id", ownerId).maybeSingle();
    if (!row) throw new HttpError(404, "not_found");
    const c = row.data as Customer;
    const round = roundOf();
    if ((c.feedback?.requests ?? []).some((r) => r.round === round && r.used_at)) throw new HttpError(409, "already_answered");
    const token = randomToken(24);
    const days = Math.min(60, Math.max(3, Number(b.days) || 21));
    const now = new Date();
    const r: FbRequest = {
      id: crypto.randomUUID(),
      token_hash: await sha256(`feedback:${token}`),
      round,
      email,
      name: String(b.name || c.contact || c.name).slice(0, 120),
      lang,
      sent_at: now.toISOString(),
      expires_at: new Date(now.getTime() + days * 86_400_000).toISOString(),
    };
    const origin = new URL(req.url).origin;
    const link = `${origin}/f/${token}`;
    let sent = false;
    let reason: string | null = null;
    if (b.send) {
      const res = await sendEmail(email, feedbackEmail({ lang, name: r.name, link, expires: new Date(r.expires_at), origin, sender: b.sender, company: c.name }), { replyTo: "contact@mediamarques.com" });
      sent = res.sent;
      reason = res.sent ? null : (res.reason ?? "error");
      r.emailed = sent;
    }
    const data = { ...c, feedback: { requests: [...(c.feedback?.requests ?? []), r] } };
    const { error } = await db.from("customers").update({ data }).eq("id", row.id);
    if (error) throw error;
    return Response.json({ link, sent, reason, request: r });
  } catch (e) {
    return fail(e);
  }
}
