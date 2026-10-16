import { fail } from "@/lib/server/admin";
import { linkPreview } from "@/lib/server/linkPreview";
import { requireCustomer } from "@/lib/server/portal";

/** Imagem + título de um link (moodboards e referências no portal do cliente). */
export async function GET(req: Request) {
  try {
    await requireCustomer();
    return Response.json(await linkPreview(new URL(req.url).searchParams.get("url") ?? ""), { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    return fail(e);
  }
}
