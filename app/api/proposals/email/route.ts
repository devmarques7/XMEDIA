import type { Lang } from "@/lib/i18n";
import { sendEmail } from "@/lib/inviteEmail";
import { proposalEmail } from "@/lib/proposalEmail";
import { HttpError, fail, requirePerm, serviceClient } from "@/lib/server/admin";
import { createShare } from "@/lib/server/shares";
import { supabaseServer } from "@/lib/supabase/server";

type Body = { proposalId: string; to: string; cc?: string; name: string; lang?: Lang; days?: number; message?: string; sender?: string };

/**
 * Envia a proposta por email (convite para a ver online): cria um link /v/<token> novo e envia via Resend.
 * Só corre quando a equipa carrega em "Enviar" depois de ver a pré-visualização. Sem RESEND_API_KEY devolve o link para enviar à mão.
 */
export async function POST(req: Request) {
  try {
    const { ownerId } = await requirePerm("proposals.edit");
    const b = (await req.json()) as Body;
    const to = String(b.to ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new HttpError(400, "bad_email");
    const lang: Lang = b.lang === "pt" || b.lang === "nl" ? b.lang : "en";
    const sb = await supabaseServer();
    const { data: p } = await sb.from("proposals").select("id, title, value, stage, data").eq("id", b.proposalId).maybeSingle();
    if (!p) throw new HttpError(404, "not_found");
    const origin = new URL(req.url).origin;
    const share = await createShare({ proposalId: p.id, ownerId, title: p.title, doc: p.data.doc, days: b.days ?? 30, origin });
    const mail = proposalEmail({
      lang,
      name: String(b.name || to),
      title: p.title,
      link: share.url,
      linkExpires: new Date(share.expiresAt),
      origin,
      value: Number(p.value) || undefined,
      extras: (p.data.pricing?.lines ?? []).filter((l: { group: string }) => l.group === "extra").length || undefined,
      validUntil: p.data.valid_until || undefined,
      message: b.message,
      sender: b.sender,
    });
    const cc = String(b.cc ?? "")
      .split(/[,;\s]+/)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x) && x !== to);
    const r = await sendEmail(to, mail, { cc, replyTo: "contact@mediamarques.com" });
    if (r.sent) {
      const today = new Date().toISOString().slice(0, 10);
      const stage = ["lead", "diagnosis"].includes(p.stage) ? "sent" : p.stage;
      const data = { ...p.data, stage, sent_at: p.data.sent_at || today, client: { ...p.data.client, name: p.data.client?.name || b.name, email: to } };
      await serviceClient().from("proposals").update({ stage, data }).eq("id", p.id);
    }
    return Response.json({ sent: r.sent, reason: r.sent ? null : r.reason, link: share.url, expiresAt: share.expiresAt, subject: mail.subject });
  } catch (e) {
    return fail(e);
  }
}
