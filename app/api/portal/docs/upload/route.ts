import { HttpError, fail } from "@/lib/server/admin";
import { putFile, saveDocs } from "@/lib/server/docs";
import { requireCustomer } from "@/lib/server/portal";
import { audit, newDoc, sha256Hex, publicRecipient } from "@/lib/documents";

const OK = /^(application\/pdf|image\/(png|jpeg|webp)|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|text\/plain)$/;

/** O cliente carrega um documento (fica partilhado com o estúdio, na pasta escolhida). */
export async function POST(req: Request) {
  try {
    const { owner_id, customer, user } = await requireCustomer();
    if (user.role === "viewer") throw new HttpError(403, "read_only");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "no_file");
    if (file.size > 50 * 1024 * 1024) throw new HttpError(413, "too_big");
    if (!OK.test(file.type)) throw new HttpError(415, "type");
    const buf = await file.arrayBuffer();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${owner_id}/${customer.id}/${crypto.randomUUID()}.${ext}`;
    await putFile(path, buf, file.type);
    const doc = audit(newDoc({ title: file.name.replace(/\.[^.]+$/, "").slice(0, 120), file: { path, name: file.name.slice(0, 160), mime: file.type, size: file.size, sha256: await sha256Hex(buf) }, customer_id: customer.id, folder: String(form.get("folder") || ""), uploaded_by: "client", shared: true }), { action: "uploaded", by: user.email });
    await saveDocs(owner_id, customer.id, [doc]);
    return Response.json({ ...doc, recipients: doc.recipients.map(publicRecipient) });
  } catch (e) {
    return fail(e);
  }
}
