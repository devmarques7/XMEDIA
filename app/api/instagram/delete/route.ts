import { randomToken } from "@/lib/codes";
import { forgetInstagramUser, readSigned } from "@/lib/server/metaSigned";

/** Meta → "Data deletion request URL": apaga os dados do Instagram e devolve o código de confirmação. */
export async function POST(req: Request) {
  const p = await readSigned(req);
  if (!p?.user_id) return Response.json({ error: "bad_signature" }, { status: 400 });
  await forgetInstagramUser(String(p.user_id)).catch(() => 0);
  const code = randomToken(9);
  return Response.json({ url: `${new URL(req.url).origin}/setup?deleted=${code}`, confirmation_code: code });
}
