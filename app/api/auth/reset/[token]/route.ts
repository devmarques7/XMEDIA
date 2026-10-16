import { maskEmail } from "@/lib/codes";
import { fail } from "@/lib/server/admin";
import { loginWithPasscode } from "@/lib/server/auth";
import { applyReset, readToken } from "@/lib/server/reset";

type Ctx = { params: Promise<{ token: string }> };

/** Valida o link (sem o gastar): devolve o email mascarado. */
export async function GET(_: Request, { params }: Ctx) {
  try {
    const p = await readToken((await params).token);
    return Response.json({ email: maskEmail(p.e), kind: p.k });
  } catch (e) {
    return fail(e);
  }
}

/** Grava o código novo e entra logo (mesmo caminho do login). */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { code = "" } = (await req.json()) as { code?: string };
    const p = await applyReset((await params).token, code);
    return Response.json(await loginWithPasscode(req, p.e, code));
  } catch (e) {
    return fail(e);
  }
}
