import { HttpError, fail, requirePerm } from "@/lib/server/admin";
import { muxEnabled } from "@/lib/server/mux";
import { abortMultipart, completeMultipart, createMultipart, ensureCors, r2Enabled, signPart } from "@/lib/server/r2";

/** Quem carrega ficheiros grandes: equipa com edição de clientes ou de propostas. */
async function uploader() {
  try {
    return await requirePerm("customers.edit");
  } catch (e) {
    if (e instanceof HttpError && e.status === 403) return requirePerm("proposals.edit");
    throw e;
  }
}

/** Para onde vão os vídeos/ficheiros grandes: { r2, mux } */
export async function GET() {
  try {
    await uploader();
    return Response.json({ r2: r2Enabled(), mux: muxEnabled() });
  } catch (e) {
    return fail(e);
  }
}

/**
 * { action: "create", name, type, size, folder } → { key, uploadId, partSize, urls[] }
 * { action: "sign", key, uploadId, n } → { url } (renova uma parte cujo URL expirou)
 * { action: "complete", key, uploadId, parts: [{ n, etag }] } → { url }
 * { action: "abort", key, uploadId }
 */
export async function POST(req: Request) {
  try {
    const { ownerId } = await uploader();
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const key = String(b.key ?? "");
    // a chave tem de ser deste workspace (não deixa mexer em ficheiros de outros)
    const mine = (k: string) => {
      if (!k.startsWith(`${ownerId}/`) || k.includes("..")) throw new HttpError(403, "forbidden");
    };
    switch (b.action) {
      case "create": {
        await ensureCors(new URL(req.url).origin);
        const ext = (String(b.name ?? "").split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
        const folder = String(b.folder ?? "media").replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "").slice(0, 120) || "media";
        const k = `${ownerId}/${folder}/${crypto.randomUUID()}.${ext}`;
        const type = String(b.type || "application/octet-stream").slice(0, 100);
        return Response.json({ key: k, ...(await createMultipart(k, type, Number(b.size))) });
      }
      case "sign":
        mine(key);
        return Response.json({ url: await signPart(key, String(b.uploadId), Number(b.n)) });
      case "complete":
        mine(key);
        return Response.json({ url: await completeMultipart(key, String(b.uploadId), (b.parts as { n: number; etag: string }[]) ?? []) });
      case "abort":
        mine(key);
        await abortMultipart(key, String(b.uploadId));
        return Response.json({ ok: true });
      default:
        throw new HttpError(400, "bad_action");
    }
  } catch (e) {
    return fail(e);
  }
}
