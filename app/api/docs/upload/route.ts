import { HttpError, fail, requirePerm } from "@/lib/server/admin";
import { putFile } from "@/lib/server/docs";
import { sha256Hex, type DocFile } from "@/lib/documents";

const OK = /^(application\/pdf|image\/(png|jpeg|webp)|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|text\/plain)$/;

/** Carrega um ficheiro para o bucket privado e devolve os metadados (com SHA-256 do original). */
export async function POST(req: Request) {
  try {
    const { ownerId } = await requirePerm("customers.edit");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "no_file");
    if (file.size > 50 * 1024 * 1024) throw new HttpError(413, "too_big");
    if (!OK.test(file.type)) throw new HttpError(415, "type");
    const buf = await file.arrayBuffer();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${ownerId}/${String(form.get("customer") || "internal")}/${crypto.randomUUID()}.${ext}`;
    await putFile(path, buf, file.type);
    const out: DocFile = { path, name: file.name.slice(0, 160), mime: file.type, size: file.size, sha256: await sha256Hex(buf) };
    return Response.json(out);
  } catch (e) {
    return fail(e);
  }
}
