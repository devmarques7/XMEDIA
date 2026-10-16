import { clientDocs } from "@/lib/documents";
import { HttpError, fail } from "@/lib/server/admin";
import { loadDocs, signedUrl } from "@/lib/server/docs";
import { requireCustomer } from "@/lib/server/portal";

/** Abre um documento visível para o cliente (link temporário). ?id=&which=signed&download=1 */
export async function GET(req: Request) {
  try {
    const { owner_id, customer, user } = await requireCustomer();
    const q = new URL(req.url).searchParams;
    const doc = clientDocs(await loadDocs(owner_id, customer.id), user.email).find((d) => d.id === q.get("id"));
    if (!doc) throw new HttpError(404, "not_found");
    const f = q.get("which") === "signed" && doc.signed ? doc.signed : doc.file;
    return Response.redirect(await signedUrl(f.path, q.get("download") ? f.name : undefined), 302);
  } catch (e) {
    return fail(e);
  }
}
