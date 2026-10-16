import { portalInviteEmail } from "@/lib/portalInviteEmail";
import type { Lang } from "@/lib/i18n";
import { requirePerm } from "@/lib/server/admin";

/** Pré-visualização do email de convite (HTML). Com Supabase só para a equipa com customers.view. */
export async function GET(req: Request) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      await requirePerm("customers.view");
    } catch {
      return new Response("unauthorized", { status: 401 });
    }
  }
  const url = new URL(req.url);
  const q = url.searchParams;
  const lang = (["pt", "en", "nl"].includes(q.get("lang") ?? "") ? q.get("lang") : "en") as Lang;
  const mail = portalInviteEmail({
    lang,
    name: q.get("name") || "Gabriel",
    customer: q.get("customer") || "Sanctum BV",
    email: q.get("email") || "gab@wearesanctum.com",
    link: q.get("link") || `${url.origin}/portal/convite/PREVIEW`,
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
    origin: url.origin,
  });
  return new Response(mail.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
