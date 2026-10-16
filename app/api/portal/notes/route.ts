import { addNote, canReview, cleanMove, normalizePost, patchNote, type Note, type NoteMove } from "@/lib/customer";
import { HttpError, fail, serviceClient } from "@/lib/server/admin";
import { clientPost, requireCustomer, savePostServer } from "@/lib/server/portal";

type Body = { postId: string; action: "add" | "remove" | "move"; note?: Pick<Note, "text" | "media" | "t" | "x" | "y">; noteId?: string; to?: NoteMove };

/** Cliente comenta no material (frame do vídeo ou ponto da imagem) enquanto o conteúdo está para aprovação. */
export async function POST(req: Request) {
  try {
    const { customer, user } = await requireCustomer();
    if (!canReview(user.role)) throw new HttpError(403, "read_only");
    const b = (await req.json()) as Body;
    const { data } = await serviceClient().from("customer_posts").select("id, customer_id, data").eq("id", b.postId).eq("customer_id", customer.id).maybeSingle();
    if (!data || data.data?.deleted_at) throw new HttpError(404, "not_found");
    let p = normalizePost({ ...data.data, id: data.id, customer_id: data.customer_id });
    if (p.status !== "review") throw new HttpError(409, "not_in_review");
    if (b.action === "add" && b.note) {
      try {
        p = addNote(p, { ...b.note, by: "client", author: user.name || user.email });
      } catch {
        throw new HttpError(400, "text_required");
      }
    } else if (b.action === "remove" && b.noteId) {
      const n = p.notes.find((x) => x.id === b.noteId);
      if (!n || n.by !== "client") throw new HttpError(404, "not_found");
      p = patchNote(p, n.id, { deleted: true });
    } else if (b.action === "move" && b.noteId && b.to) {
      // o cliente só reposiciona os próprios comentários (outro slide ou outro ponto)
      const n = p.notes.find((x) => x.id === b.noteId);
      if (!n || n.by !== "client") throw new HttpError(404, "not_found");
      const to = cleanMove(p, b.to);
      if (!to) throw new HttpError(400, "bad_position");
      p = patchNote(p, n.id, to);
    } else throw new HttpError(400, "bad_action");
    await savePostServer(p);
    return Response.json({ post: clientPost(p) });
  } catch (e) {
    return fail(e);
  }
}
