import { forgetInstagramUser, readSigned } from "@/lib/server/metaSigned";

/** Meta → "Deauthorize callback URL": o utilizador removeu a app no Instagram. */
export async function POST(req: Request) {
  const p = await readSigned(req);
  if (!p?.user_id) return Response.json({ error: "bad_signature" }, { status: 400 });
  await forgetInstagramUser(String(p.user_id)).catch(() => 0);
  return Response.json({ ok: true });
}
