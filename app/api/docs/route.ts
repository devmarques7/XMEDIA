import { HttpError, fail, requirePerm } from "@/lib/server/admin";
import { allDocs, loadDocs, saveDocs } from "@/lib/server/docs";
import { audit, normalizeDocs, publicRecipient, type Doc } from "@/lib/documents";

/** Lista: ?customer=<id> (de um cliente), ?customer= (internos) ou ?all=1 (tudo, para a visão geral). */
export async function GET(req: Request) {
  try {
    const { ownerId } = await requirePerm("customers.view");
    const q = new URL(req.url).searchParams;
    const strip = (d: Doc) => ({ ...d, recipients: d.recipients.map(publicRecipient) });
    if (q.get("all") === "1") return Response.json((await allDocs(ownerId)).map((x) => ({ ...x, doc: strip(x.doc) })));
    return Response.json((await loadDocs(ownerId, q.get("customer") ?? "")).map((doc) => ({ doc: strip(doc), customer: "" })));
  } catch (e) {
    return fail(e);
  }
}

/** Guardar/apagar/anular: { action: "save" | "delete" | "void", doc }. O cliente do documento vem do próprio doc. */
export async function POST(req: Request) {
  try {
    const { ownerId, user } = await requirePerm("customers.edit");
    const b = (await req.json()) as { action: "save" | "delete" | "void"; doc: Doc };
    const [doc] = normalizeDocs([b.doc]);
    if (!doc) throw new HttpError(400, "bad_doc");
    const by = user.email ?? "studio";
    const next =
      b.action === "delete" ? { ...doc, deleted: true, updated_at: new Date().toISOString() } : b.action === "void" ? audit({ ...doc, status: "voided" }, { action: "voided", by }) : { ...doc, updated_at: new Date().toISOString() };
    // tokens nunca vêm do browser: conserva os do servidor
    const cur = (await loadDocs(ownerId, doc.customer_id)).find((d) => d.id === doc.id);
    if (cur) next.recipients = next.recipients.map((r) => {
      const c = cur.recipients.find((x) => x.id === r.id);
      return { ...r, token_hash: c?.token_hash, otp_hash: c?.otp_hash, otp_exp: c?.otp_exp, otp_tries: c?.otp_tries };
    });
    const list = await saveDocs(ownerId, doc.customer_id, [next]);
    return Response.json({ doc: list.find((d) => d.id === doc.id) });
  } catch (e) {
    return fail(e);
  }
}
