import { HttpError, fail, requireMember, serviceClient } from "@/lib/server/admin";
import { monthRange } from "@/lib/team";

const PUBLIC_COLS = "id, name, email, role, description, responsibilities, rate, rate_currency, active, lang, status, code_hint, registered_at, photo_url, city";

/** Ficha, horas e fecho do próprio funcionário (só leitura, exceto horas em meses abertos). */
export async function GET(req: Request) {
  try {
    const id = await requireMember();
    const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "bad_month");
    const db = serviceClient();
    const { data: member } = await db.from("team_members").select(PUBLIC_COLS).eq("id", id).maybeSingle();
    if (!member || member.status !== "active" || !member.active) throw new HttpError(401, "unauthorized");
    const { from, to } = monthRange(month);
    const [{ data: entries }, { data: close }] = await Promise.all([
      db.from("time_entries").select("id, member_id, date, start, end, break_min, project, note").eq("member_id", id).gte("date", from).lte("date", to).order("date").order("start"),
      db.from("month_closes").select("*").eq("member_id", id).eq("month", month).maybeSingle(),
    ]);
    return Response.json({ member, entries: entries ?? [], close: close ?? null });
  } catch (e) {
    return fail(e);
  }
}
