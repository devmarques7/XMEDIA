import { validPasscode } from "@/lib/customer";
import { HttpError, fail, serviceClient } from "@/lib/server/admin";
import { hashPasscode, refreshPortalSummary, requireCustomer } from "@/lib/server/portal";

/** O utilizador do portal define (ou muda) o seu código de 4–6 dígitos. */
export async function POST(req: Request) {
  try {
    const { customer, user } = await requireCustomer();
    const { code } = (await req.json()) as { code?: string };
    if (!validPasscode(code ?? "")) throw new HttpError(400, "bad_passcode");
    const { error } = await serviceClient().from("customer_users").update({ passcode_hash: await hashPasscode(user.id, code!) }).eq("id", user.id);
    if (error) throw error;
    await refreshPortalSummary(customer.id);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
