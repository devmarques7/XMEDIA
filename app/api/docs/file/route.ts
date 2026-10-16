import { HttpError, fail, requirePerm } from "@/lib/server/admin";
import { loadDocs, signedUrl } from "@/lib/server/docs";

/** Abre um ficheiro (redireciona para um link temporário). ?customer=&id=&which=original|signed&download=1 */
export async function GET(req: Request) {
  try {
    const { ownerId } = await requirePerm("customers.view");
    const q = new URL(req.url).searchParams;
    const doc = (await loadDocs(ownerId, q.get("customer") ?? "")).find((d) => d.id === q.get("id"));
    if (!doc) throw new HttpError(404, "not_found");
    const f = q.get("which") === "signed" && doc.signed ? doc.signed : doc.file;
    return Response.redirect(await signedUrl(f.path, q.get("download") ? f.name : undefined), 302);
  } catch (e) {
    return fail(e);
  }
}
