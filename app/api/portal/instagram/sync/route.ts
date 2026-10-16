import { HttpError, fail } from "@/lib/server/admin";
import { igConfigured, syncInstagram } from "@/lib/server/instagram";
import { requireCustomer } from "@/lib/server/portal";

export const maxDuration = 60;

export async function POST() {
  try {
    const { customer } = await requireCustomer();
    if (!igConfigured()) throw new HttpError(409, "ig_not_configured");
    return Response.json({ instagram: await syncInstagram(customer.id) });
  } catch (e) {
    return fail(e);
  }
}
