import { INVITE_DAYS, randomToken } from "@/lib/codes";
import type { Lang } from "@/lib/i18n";
import { inviteEmail, sendEmail } from "@/lib/inviteEmail";
import { HttpError, fail, hashToken, requirePerm, serviceClient } from "@/lib/server/admin";

/** Admin gera (ou regenera) o link de convite e envia-o por email na língua do funcionário. */
export async function POST(req: Request) {
  try {
    const { user: admin, ownerId } = await requirePerm("team.manage");
    const { memberId, send = false } = (await req.json()) as { memberId: string; send?: boolean };
    const db = serviceClient();
    const { data: m } = await db.from("team_members").select("id, owner_id, name, email, lang, status").eq("id", memberId).maybeSingle();
    if (!m || m.owner_id !== ownerId) throw new HttpError(404, "not_found");
    if (m.status === "disabled") throw new HttpError(409, "disabled");

    const token = randomToken();
    const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000);
    const { error } = await db
      .from("team_members")
      .update({ invite_token_hash: await hashToken(token), invite_expires_at: expires.toISOString(), invited_at: new Date().toISOString(), status: m.status === "active" ? "active" : "invited" })
      .eq("id", m.id);
    if (error) throw error;

    const origin = new URL(req.url).origin;
    const link = `${origin}/convite/${token}`;
    let email: { sent: boolean; reason?: string } = { sent: false, reason: "no_email" };
    if (send && m.email) {
      const inviter = (admin.user_metadata?.full_name as string) || admin.email || "XMEDIA";
      email = await sendEmail(m.email, inviteEmail({ lang: (m.lang as Lang) || "pt", name: m.name, inviter, link, expiresAt: expires, logoUrl: `${origin}/pwa-icon/128` }));
    }
    return Response.json({ link, expiresAt: expires.toISOString(), email });
  } catch (e) {
    return fail(e);
  }
}
