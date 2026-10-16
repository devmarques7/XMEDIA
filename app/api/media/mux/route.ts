import { HttpError, fail, requirePerm } from "@/lib/server/admin";
import { createUpload, muxEnabled, uploadStatus } from "@/lib/server/mux";

/** Quem carrega vídeos: equipa com edição de clientes ou de propostas. */
async function uploader() {
  try {
    return await requirePerm("customers.edit");
  } catch (e) {
    if (e instanceof HttpError && e.status === 403) return requirePerm("proposals.edit");
    throw e;
  }
}

/** ?upload=<id> → estado do envio/vídeo · sem parâmetros → { enabled } */
export async function GET(req: Request) {
  try {
    await uploader();
    const id = new URL(req.url).searchParams.get("upload");
    if (!id) return Response.json({ enabled: muxEnabled() });
    return Response.json(await uploadStatus(id));
  } catch (e) {
    return fail(e);
  }
}

/** Cria um upload direto (o ficheiro vai do browser para o Mux; nada passa pela Vercel). */
export async function POST(req: Request) {
  try {
    const { ownerId } = await uploader();
    const b = (await req.json().catch(() => ({}))) as { folder?: string };
    const origin = new URL(req.url).origin;
    return Response.json(await createUpload(origin, `${ownerId}:${String(b.folder ?? "").slice(0, 120)}`));
  } catch (e) {
    return fail(e);
  }
}
