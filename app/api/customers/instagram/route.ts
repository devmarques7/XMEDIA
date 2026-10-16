import { HttpError, fail } from "@/lib/server/admin";
import { requireOwnCustomer } from "@/lib/server/customerAdmin";
import { igConfigured, syncInstagram } from "@/lib/server/instagram";

export const maxDuration = 60;

/** Admin: atualiza perfil, media e métricas do Instagram do cliente. */
export async function POST(req: Request) {
  try {
    const { customerId } = (await req.json()) as { customerId: string };
    await requireOwnCustomer(customerId);
    if (!igConfigured()) throw new HttpError(409, "ig_not_configured");
    return Response.json({ instagram: await syncInstagram(customerId) });
  } catch (e) {
    return fail(e);
  }
}
