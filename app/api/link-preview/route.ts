import { fail, requirePerm } from "@/lib/server/admin";
import { linkPreview } from "@/lib/server/linkPreview";

/** Imagem + título de um link (moodboards e referências, equipa). */
export async function GET(req: Request) {
  try {
    await requirePerm("customers.view");
    return Response.json(await linkPreview(new URL(req.url).searchParams.get("url") ?? ""), { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    return fail(e);
  }
}
