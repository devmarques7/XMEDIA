import { fail } from "@/lib/server/admin";
import { musicInfo } from "@/lib/server/music";
import { requireCustomer } from "@/lib/server/portal";

/** Portal: título, duração e pré-escuta de uma música de referência (?url=). */
export async function GET(req: Request) {
  try {
    await requireCustomer();
    return Response.json(await musicInfo(new URL(req.url).searchParams.get("url") ?? ""));
  } catch (e) {
    return fail(e);
  }
}
