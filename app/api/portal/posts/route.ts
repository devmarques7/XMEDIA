import { canReview, clientDraft, clientReview, normalizePost, type ClientDraftInput } from "@/lib/customer";
import { CRITERIA } from "@/lib/validation";
import { HttpError, fail, serviceClient } from "@/lib/server/admin";
import { requireCustomer, savePostServer } from "@/lib/server/portal";

/** Cliente aprova um conteúdo, pede alterações (com comentário) ou valida um critério (ok / ajustar). */
export async function POST(req: Request) {
  try {
    const { customer, user } = await requireCustomer();
    if (!canReview(user.role)) throw new HttpError(403, "read_only");
    const body = (await req.json()) as { postId: string; action: "approve" | "changes" | "validate" | "draft" | "draft_delete"; text?: string; key?: string; value?: "ok" | "fix" | null; draft?: ClientDraftInput };
    const { postId, action, text = "", key, value } = body;
    // rascunhos planeados pelo cliente (título, conceito, capa, data) — ficam em Ideias para a equipa produzir
    if (action === "draft" || action === "draft_delete") {
      const id = action === "draft" ? body.draft?.id : postId;
      let cur = null;
      if (id) {
        const { data } = await serviceClient().from("customer_posts").select("id, customer_id, data").eq("id", id).eq("customer_id", customer.id).maybeSingle();
        if (!data || data.data?.deleted_at) throw new HttpError(404, "not_found");
        cur = normalizePost({ ...data.data, id: data.id, customer_id: data.customer_id });
      }
      if (action === "draft_delete") {
        if (!cur?.client_draft || cur.status !== "idea") throw new HttpError(409, "not_a_draft");
        await serviceClient().from("customer_posts").delete().eq("id", cur.id).eq("customer_id", customer.id);
        return Response.json({ ok: true });
      }
      let next;
      try {
        next = clientDraft(cur, customer.id, body.draft!, user.email);
      } catch {
        throw new HttpError(409, "not_a_draft");
      }
      const { created_at: _c, updated_at: _u, ...doc } = next;
      const { error } = await serviceClient().from("customer_posts").upsert({ id: next.id, customer_id: customer.id, status: next.status, scheduled_at: next.scheduled_at || null, data: doc });
      if (error) throw error;
      return Response.json({ post: next });
    }
    if (action === "validate") {
      const { data } = await serviceClient().from("customer_posts").select("id, customer_id, data").eq("id", postId).eq("customer_id", customer.id).maybeSingle();
      if (!data) throw new HttpError(404, "not_found");
      const p = normalizePost({ ...data.data, id: data.id, customer_id: data.customer_id });
      if (p.status !== "review") throw new HttpError(409, "not_in_review");
      if (!key || !CRITERIA[p.type].includes(key)) throw new HttpError(400, "bad_key");
      const validation = { ...(p.validation ?? {}) };
      if (value === "ok" || value === "fix") validation[key] = value;
      else delete validation[key];
      await savePostServer({ ...p, validation });
      return Response.json({ ok: true, validation });
    }
    if (action !== "approve" && action !== "changes") throw new HttpError(400, "bad_action");
    if (action === "changes" && !text.trim()) throw new HttpError(400, "text_required");
    const { data } = await serviceClient().from("customer_posts").select("id, customer_id, data").eq("id", postId).eq("customer_id", customer.id).maybeSingle();
    if (!data || data.data?.deleted_at) throw new HttpError(404, "not_found");
    let next;
    try {
      next = clientReview(normalizePost({ ...data.data, id: data.id, customer_id: data.customer_id }), action, text.slice(0, 2000), undefined, user.name || user.email);
    } catch {
      throw new HttpError(409, "not_in_review");
    }
    await savePostServer(next);
    return Response.json({ ok: true, status: next.status });
  } catch (e) {
    return fail(e);
  }
}
