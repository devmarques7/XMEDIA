import { HttpError, fail, serviceClient } from "@/lib/server/admin";
import { requireOwnCustomer } from "@/lib/server/customerAdmin";
import { normalizePost } from "@/lib/customer";
import { igConfigured } from "@/lib/server/instagram";
import { runPublish } from "@/lib/server/publisher";

export const maxDuration = 60;

/** Admin: publicar já no Instagram. */
export async function POST(req: Request) {
  try {
    const { postId } = (await req.json()) as { postId: string };
    const { data } = await serviceClient().from("customer_posts").select("id, customer_id, data").eq("id", postId).maybeSingle();
    if (!data || data.data?.deleted_at) throw new HttpError(404, "not_found");
    await requireOwnCustomer(data.customer_id);
    if (!igConfigured()) throw new HttpError(409, "ig_not_configured");
    return Response.json(await runPublish(normalizePost({ ...data.data, id: data.id, customer_id: data.customer_id }), 45_000));
  } catch (e) {
    return fail(e);
  }
}
