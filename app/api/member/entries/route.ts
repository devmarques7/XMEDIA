import { HttpError, fail, requireMember, serviceClient } from "@/lib/server/admin";
import { entryMinutes } from "@/lib/team";

async function closed(memberId: string, date: string) {
  const { data } = await serviceClient().from("month_closes").select("id").eq("member_id", memberId).eq("month", date.slice(0, 7)).maybeSingle();
  return !!data;
}

/** O funcionário regista as próprias horas (mês aberto). */
export async function POST(req: Request) {
  try {
    const id = await requireMember();
    const b = (await req.json()) as { date: string; start: string; end: string; break_min?: number; project?: string; note?: string };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !/^\d{2}:\d{2}$/.test(b.start) || !/^\d{2}:\d{2}$/.test(b.end)) throw new HttpError(400, "bad_input");
    const row = { member_id: id, date: b.date, start: b.start, end: b.end, break_min: Math.max(0, Math.floor(b.break_min ?? 0)), project: (b.project ?? "").slice(0, 200), note: (b.note ?? "").slice(0, 500) };
    if (!entryMinutes(row)) throw new HttpError(400, "bad_time");
    if (await closed(id, b.date)) throw new HttpError(409, "month_closed");
    const { data, error } = await serviceClient().from("time_entries").insert(row).select("id, member_id, date, start, end, break_min, project, note").single();
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return fail(e);
  }
}

/** Apaga um registo próprio enquanto o mês está aberto (corrigir enganos). */
export async function DELETE(req: Request) {
  try {
    const id = await requireMember();
    const entryId = new URL(req.url).searchParams.get("id") ?? "";
    const db = serviceClient();
    const { data: e } = await db.from("time_entries").select("id, member_id, date").eq("id", entryId).maybeSingle();
    if (!e || e.member_id !== id) throw new HttpError(404, "not_found");
    if (await closed(id, e.date)) throw new HttpError(409, "month_closed");
    const { error } = await db.from("time_entries").delete().eq("id", entryId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
