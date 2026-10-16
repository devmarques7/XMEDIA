import { fail } from "@/lib/server/admin";
import { loginWithPasscode } from "@/lib/server/auth";

/** Login único (email + código de 4–6 dígitos) para admin, equipa e clientes. */
export async function POST(req: Request) {
  try {
    const { email = "", code = "" } = (await req.json()) as { email?: string; code?: string };
    return Response.json(await loginWithPasscode(req, email, code));
  } catch (e) {
    return fail(e);
  }
}
