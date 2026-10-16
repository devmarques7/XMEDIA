import { HttpError, fail, requirePerm } from "@/lib/server/admin";
import { createShare } from "@/lib/server/shares";
import { supabaseServer } from "@/lib/supabase/server";

/** Cria um link temporário (/v/<token>) com uma cópia do documento atual. */
export async function POST(req: Request) {
  try {
    const { ownerId } = await requirePerm("proposals.edit");
    const { proposalId, days = 7 } = (await req.json()) as { proposalId: string; days?: number };
    // lê com a sessão do utilizador: o RLS garante que a proposta é dele
    const sb = await supabaseServer();
    const { data: p } = await sb.from("proposals").select("id, title, data").eq("id", proposalId).maybeSingle();
    if (!p) throw new HttpError(404, "not_found");
    return Response.json(await createShare({ proposalId: p.id, ownerId, title: p.title, doc: p.data.doc, days, origin: new URL(req.url).origin }));
  } catch (e) {
    return fail(e);
  }
}
