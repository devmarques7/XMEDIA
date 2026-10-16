import { canManageInstagram, cleanHandle, validHandle } from "@/lib/customer";
import { HttpError, fail } from "@/lib/server/admin";
import { patchCustomer, requireCustomer } from "@/lib/server/portal";

/** Registo rápido: só o @ da conta (as métricas chegam quando ligar pela API). */
export async function POST(req: Request) {
  try {
    const { customer, user } = await requireCustomer();
    if (!canManageInstagram(user.role)) throw new HttpError(403, "owner_only");
    const { handle = "" } = (await req.json()) as { handle?: string };
    const h = cleanHandle(handle);
    if (!validHandle(h)) throw new HttpError(400, "bad_handle");
    await patchCustomer(customer.id, (x) => ({ ...x, instagram: { ...x.instagram, handle: h } }));
    return Response.json({ ok: true, handle: h });
  } catch (e) {
    return fail(e);
  }
}
