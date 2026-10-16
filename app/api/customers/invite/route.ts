import { fail } from "@/lib/server/admin";
import { requireOwnCustomer } from "@/lib/server/customerAdmin";
import { createInvite } from "@/lib/server/portalTeam";

/**
 * Gera (ou regenera) o convite de UMA pessoa do cliente. send=false só devolve o link e a pré-visualização
 * do email (nada é enviado); send=true envia pela Resend (RESEND_API_KEY).
 */
export async function POST(req: Request) {
  try {
    const { customerId, userId, send = false, lang } = (await req.json()) as { customerId: string; userId: string; send?: boolean; lang?: "pt" | "en" | "nl" };
    const { customer: c } = await requireOwnCustomer(customerId);
    return Response.json(await createInvite(c, userId, send, new URL(req.url).origin, lang === "pt" || lang === "nl" || lang === "en" ? lang : undefined));
  } catch (e) {
    return fail(e);
  }
}
