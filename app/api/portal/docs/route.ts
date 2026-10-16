import { randomToken } from "@/lib/codes";
import { activeSigners, clientDocs } from "@/lib/documents";
import { HttpError, fail } from "@/lib/server/admin";
import { docTokenHash, loadDocs, saveDocs } from "@/lib/server/docs";
import { requireCustomer } from "@/lib/server/portal";

/** Documentos que o cliente vê: partilhados, carregados por ele e os enviados a ele para assinar. */
export async function GET() {
  try {
    const { owner_id, customer, user } = await requireCustomer();
    return Response.json(clientDocs(await loadDocs(owner_id, customer.id), user.email));
  } catch (e) {
    return fail(e);
  }
}

/** { action: "sign_link", id } → link de assinatura novo para a pessoa com sessão (se for destinatário com vez). */
export async function POST(req: Request) {
  try {
    const { owner_id, customer, user } = await requireCustomer();
    const { action, id } = (await req.json()) as { action: string; id: string };
    if (action !== "sign_link") throw new HttpError(400, "bad_action");
    const docs = await loadDocs(owner_id, customer.id);
    const doc = docs.find((d) => d.id === id && !d.deleted);
    const r = doc?.recipients.find((x) => x.email.toLowerCase() === user.email.toLowerCase());
    if (!doc || !r) throw new HttpError(404, "not_found");
    if (!activeSigners(doc).some((x) => x.id === r.id)) throw new HttpError(409, "not_your_turn");
    const token = randomToken();
    const h = await docTokenHash(token);
    await saveDocs(owner_id, customer.id, [{ ...doc, recipients: doc.recipients.map((x) => (x.id === r.id ? { ...x, token_hash: h } : x)), updated_at: new Date().toISOString() }]);
    return Response.json({ link: `/assinar/${token}` });
  } catch (e) {
    return fail(e);
  }
}
