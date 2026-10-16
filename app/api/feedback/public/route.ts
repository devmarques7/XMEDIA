import { sha256 } from "@/lib/codes";
import type { Customer } from "@/lib/customer";
import { parseAnswers, requestState } from "@/lib/feedback";
import { HttpError, fail, serviceClient } from "@/lib/server/admin";

/** Formulário público de avaliação (/f/<token>): sem sessão, o token de uso único é a chave. */
async function find(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const token_hash = await sha256(`feedback:${token}`);
  const db = serviceClient();
  const { data } = await db.from("customers").select("id, data").contains("data", { feedback: { requests: [{ token_hash }] } }).limit(1).maybeSingle();
  if (!data) return null;
  const c = data.data as Customer;
  const all = c.feedback?.requests ?? [];
  return { db, id: data.id as string, c, all, r: all.find((x) => x.token_hash === token_hash)! };
}

export async function GET(req: Request) {
  try {
    const f = await find(new URL(req.url).searchParams.get("t") ?? "");
    if (!f) return Response.json({ state: "invalid" });
    return Response.json({ state: requestState(f.r, f.all), name: f.r.name, company: f.c.name, lang: f.r.lang });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { t?: string; answers?: unknown };
    const f = await find(String(b.t ?? ""));
    if (!f) throw new HttpError(404, "invalid");
    const state = requestState(f.r, f.all);
    if (state !== "open") throw new HttpError(409, state);
    const answers = parseAnswers(b.answers);
    if (!answers) throw new HttpError(400, "bad_answers");
    const used_at = new Date().toISOString();
    const requests = f.all.map((x) => (x.id === f.r.id ? { ...x, used_at, answers } : x));
    const { error } = await f.db.from("customers").update({ data: { ...f.c, feedback: { requests } } }).eq("id", f.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
