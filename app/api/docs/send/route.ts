import { randomToken } from "@/lib/codes";
import { activeSigners, audit, sendProblems, statusOf, type Doc } from "@/lib/documents";
import { docEmail } from "@/lib/docEmail";
import { sendEmail } from "@/lib/inviteEmail";
import { HttpError, fail, requirePerm } from "@/lib/server/admin";
import { docTokenHash, loadDocs, saveDocs } from "@/lib/server/docs";

/**
 * Envia para assinatura: cria um link pessoal por destinatário (só o hash fica guardado) e envia por email a quem
 * pode assinar já (com ordem de assinatura: só o primeiro). Devolve os links para copiar (se o email não sair).
 */
export async function POST(req: Request) {
  try {
    const { ownerId, user } = await requirePerm("customers.edit");
    const { customer = "", id, resend } = (await req.json()) as { customer?: string; id: string; resend?: string };
    const doc = (await loadDocs(ownerId, customer)).find((d) => d.id === id);
    if (!doc) throw new HttpError(404, "not_found");
    const problems = sendProblems(doc);
    if (problems.length) throw new HttpError(400, problems[0]);
    const origin = new URL(req.url).origin;
    const from = (user.user_metadata?.full_name as string) || "MediaMarques";
    let next: Doc = { ...doc, status: doc.status === "draft" ? "sent" : doc.status };
    const now = new Date().toISOString();
    const targets = resend ? next.recipients.filter((r) => r.id === resend) : activeSigners(next).concat(next.recipients.filter((r) => r.role === "viewer"));
    const links: { id: string; email: string; link: string; sent: boolean }[] = [];
    for (const r of targets) {
      const token = randomToken();
      const link = `${origin}/assinar/${token}`;
      next = { ...next, recipients: next.recipients.map((x) => (x.id === r.id ? { ...x, token_hash: undefined, status: x.status === "pending" ? "sent" : x.status, sent_at: now } : x)) };
      next.recipients = await Promise.all(next.recipients.map(async (x) => (x.id === r.id ? { ...x, token_hash: await docTokenHash(token) } : x)));
      const mail = docEmail("request", { lang: r.lang, origin, name: r.name, title: doc.title, from, link, message: doc.message, expires: doc.expires_at?.slice(0, 10) });
      const res = await sendEmail(r.email, mail, { cc: doc.cc.length && !resend ? doc.cc : undefined, replyTo: user.email ?? undefined });
      links.push({ id: r.id, email: r.email, link, sent: res.sent });
      next = audit(next, { action: resend ? "reminded" : "sent", by: user.email ?? "studio", detail: r.email });
    }
    next = { ...next, status: statusOf(next) };
    await saveDocs(ownerId, customer, [next]);
    return Response.json({ links });
  } catch (e) {
    return fail(e);
  }
}
