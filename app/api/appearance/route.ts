import { normalizeAppearance } from "@/lib/appearance";
import { fail, serviceClient } from "@/lib/server/admin";
import { ownerId } from "@/lib/server/owner";

/** Aparência do workspace (público: o portal do cliente e os links públicos usam as mesmas cores e fontes). */
export async function GET() {
  try {
    const { data } = await serviceClient().from("app_settings").select("data").eq("owner_id", await ownerId()).maybeSingle();
    return Response.json(normalizeAppearance((data?.data as { appearance?: unknown } | null)?.appearance), { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
  } catch (e) {
    return fail(e);
  }
}
