import { HttpError, fail, serviceClient } from "@/lib/server/admin";
import { requireCustomer } from "@/lib/server/portal";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/**
 * Imagem carregada pelo cliente (moodboards / marca / capas).
 * JSON { type, size } → URL assinado: o browser envia diretamente para o Storage (sem passar pela Vercel, que corta a 4,5 MB).
 * multipart (versões antigas da página) → o servidor envia. Máx. 25 MB.
 */
export async function POST(req: Request) {
  try {
    const { customer, user } = await requireCustomer();
    if (user.role === "viewer") throw new HttpError(403, "read_only");
    if (req.headers.get("content-type")?.includes("application/json")) {
      const b = (await req.json().catch(() => ({}))) as { type?: string; size?: number };
      const ext = TYPES[String(b.type)];
      if (!ext) throw new HttpError(415, "bad_type");
      if (!b.size || b.size > 25 * 1024 * 1024) throw new HttpError(413, "too_big");
      const path = `portal/${customer.id}/${crypto.randomUUID()}.${ext}`;
      const db = serviceClient();
      const { data, error } = await db.storage.from("proposal-media").createSignedUploadUrl(path);
      if (error) throw error;
      return Response.json({ path, token: data.token, url: db.storage.from("proposal-media").getPublicUrl(path).data.publicUrl });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "no_file");
    const ext = TYPES[file.type];
    if (!ext) throw new HttpError(415, "bad_type");
    if (file.size > 8 * 1024 * 1024) throw new HttpError(413, "too_big");
    const path = `portal/${customer.id}/${crypto.randomUUID()}.${ext}`;
    const db = serviceClient();
    const { error } = await db.storage.from("proposal-media").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) throw error;
    return Response.json({ url: db.storage.from("proposal-media").getPublicUrl(path).data.publicUrl });
  } catch (e) {
    return fail(e);
  }
}
