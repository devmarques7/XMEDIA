import type { Lang } from "@/lib/i18n";
import { sendEmail } from "@/lib/inviteEmail";
import { normalizeCustomer, normalizePost, type Customer } from "@/lib/customer";
import { reviewEmail, type ReviewMode } from "@/lib/reviewEmail";
import { HttpError, fail, requirePerm, serviceClient } from "@/lib/server/admin";
import { adminEmails } from "@/lib/server/auth";
import { createInvite, saveUser } from "@/lib/server/portalTeam";

const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

/**
 * "Pedir revisão": envia o conteúdo por email com os dados do material e o link certo para quem recebe:
 * - equipa/admin → abre na app (ficha do cliente → conteúdo);
 * - pessoa do cliente com acesso ao portal → abre no portal (/portal?post=…);
 * - pessoa nova (ou que ainda não entrou) → é adicionada ao portal do cliente e recebe o mesmo onboarding do convite
 *   (cria o código de acesso), e o conteúdo abre logo a seguir.
 * Devolve o link para copiar se o email não puder sair.
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
    const lang: Lang = b.lang === "pt" || b.lang === "nl" ? b.lang : "en"; // inglês por omissão
    const from = (user.user_metadata?.full_name as string) || user.email || "MediaMarques";

    const target = await reviewTarget(ownerId, customer, to, b.name, origin, lang, post.id);
    if (target.mode !== "app" && post.internal) {
      // quem revê no portal tem de ver o conteúdo
      await db.from("customer_posts").update({ data: { ...row.data, internal: false } }).eq("id", row.id);
    }
    const mail = reviewEmail({ lang, origin, link: target.link, customer: customer.name, title: post.title, type: post.type, scheduled_at: post.scheduled_at || undefined, files: post.media.length, from, name: b.name || target.name, message: String(b.message ?? "").slice(0, 2000), mode: target.mode });
    const res = await sendEmail(to, mail, { cc: cc.length ? cc : undefined, replyTo: user.email ?? undefined });
    return Response.json({ sent: res.sent, reason: res.sent ? undefined : res.reason, link: target.link, to, mode: target.mode });
  } catch (e) {
    return fail(e);
  }
}

/** Para onde aponta o link: app (equipa), portal (cliente com acesso) ou convite do portal (onboarding). */
async function reviewTarget(ownerId: string, customer: Customer, email: string, name: string | undefined, origin: string, lang: Lang, postId: string): Promise<{ mode: ReviewMode; link: string; name?: string }> {
  const db = serviceClient();
  const appLink = `${origin}/clientes/${customer.id}?tab=content&post=${postId}`;
  if (adminEmails().includes(email)) return { mode: "app", link: appLink };
  const { data: member } = await db.from("team_members").select("id, name").eq("owner_id", ownerId).eq("email", email).limit(1).maybeSingle();
  if (member) return { mode: "app", link: appLink, name: member.name };

  const portalPath = `/portal?post=${postId}`;
  if (customer.portal.status === "disabled") throw new HttpError(409, "portal_disabled");
  const find = () => db.from("customer_users").select("id, name, status").eq("customer_id", customer.id).eq("email", email).limit(1).maybeSingle();
  let { data: cu } = await find();
  if (!cu) {
    await saveUser(customer.id, { email, name: name ?? "", role: "member" });
    ({ data: cu } = await find());
    if (!cu) throw new HttpError(500, "user_not_created");
  }
  if (cu.status === "disabled") throw new HttpError(409, "user_disabled");
  if (cu.status === "active") return { mode: "portal", link: `${origin}${portalPath}`, name: cu.name || undefined };
  const inv = await createInvite(customer, cu.id, false, origin, lang, portalPath);
  return { mode: "onboarding", link: inv.link, name: cu.name || undefined };
}
