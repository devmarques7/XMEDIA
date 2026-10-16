import { HttpError, fail, serviceClient } from "@/lib/server/admin";
import { requireOwnCustomer } from "@/lib/server/customerAdmin";
import { patchCustomer, refreshPortalSummary } from "@/lib/server/portal";

/**
 * Com userId: reset (apaga o código, a pessoa recebe novo convite), disable/enable dessa pessoa.
 * Sem userId: disable/enable do portal inteiro do cliente.
 */
export async function POST(req: Request) {
  try {
    const { customerId, userId, action } = (await req.json()) as { customerId: string; userId?: string; action: "reset" | "disable" | "enable" };
    const { customer: c } = await requireOwnCustomer(customerId);
    const db = serviceClient();
    if (userId) {
      const patch =
        action === "reset" ? { passcode_hash: null } : action === "disable" ? { status: "disabled" } : action === "enable" ? { status: "active" } : null;
      if (!patch) throw new HttpError(400, "bad_action");
      const { error } = await db.from("customer_users").update(patch).eq("id", userId).eq("customer_id", c.id);
      if (error) throw error;
    } else if (action === "disable" || action === "enable") {
      await patchCustomer(c.id, (x) => ({ ...x, portal: { ...x.portal, status: action === "disable" ? "disabled" : "none" } }));
    } else throw new HttpError(400, "bad_action");
    await refreshPortalSummary(c.id);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
