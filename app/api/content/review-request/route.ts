import type { Lang } from "@/lib/i18n";
import { sendEmail } from "@/lib/inviteEmail";
import { normalizeCustomer, normalizePost } from "@/lib/customer";
import { reviewEmail } from "@/lib/reviewEmail";
import { HttpError, fail, requirePerm, serviceClient } from "@/lib/server/admin";

const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

/**
 * "Pedir revisão": envia o conteúdo por email ao responsável (ou a outro endereço) com "Solicito que revise este
 * conteúdo", os dados do material e o link direto. Devolve o link para copiar se o email não puder sair.
 */
export async function POST(req: Request) {
  try {
    const { ownerId, user } = await requirePerm("customers.edit");
    const b = (await req.json().catch(() => ({}))) as { post_id?: string; to?: string; cc?: string[]; message?: string; lang?: Lang; name?: string };
    const to = String(b.to ?? "").trim().toLowerCase();
    const cc = (Array.isArray(b.cc) ? b.cc : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    if (!EMAIL.test(to) || cc.some((x) => !EMAIL.test(x))) throw new HttpError(400, "bad_email");
    if (cc.length > 5) throw new HttpError(400, "too_many");
    const db = serviceClient();
    const { data: row } = await db.from("customer_posts").select("id, customer_id, data").eq("id", String(b.post_id ?? "")).maybeSingle();
    if (!row) throw new HttpError(404, "not_found");
    const { data: c } = await db.from("customers").select("id, data").eq("id", row.customer_id).eq("owner_id", ownerId).maybeSingle();
    if (!c) throw new HttpError(404, "not_found");
    const post = normalizePost({ ...row.data, id: row.id, customer_id: row.customer_id });
    const customer = normalizeCustomer({ ...c.data, id: c.id });
    const origin = new URL(req.url).origin;
    const link = `${origin}/clientes/${customer.id}?tab=content&post=${post.id}`;
    const lang: Lang = b.lang === "en" || b.lang === "nl" ? b.lang : "pt";
    const from = (user.user_metadata?.full_name as string) || user.email || "MediaMarques";
    const mail = reviewEmail({ lang, origin, link, customer: customer.name, title: post.title, type: post.type, scheduled_at: post.scheduled_at || undefined, files: post.media.length, from, name: b.name, message: String(b.message ?? "").slice(0, 2000) });
    const res = await sendEmail(to, mail, { cc: cc.length ? cc : undefined, replyTo: user.email ?? undefined });
    return Response.json({ sent: res.sent, reason: res.sent ? undefined : res.reason, link, to });
  } catch (e) {
    return fail(e);
  }
}
