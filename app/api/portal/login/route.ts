import { HttpError, fail } from "@/lib/server/admin";
import { loginWithPasscode } from "@/lib/server/auth";

/** /portal/login usa o mesmo login único (email + código); aqui só se aceitam utilizadores de clientes. */
export async function POST(req: Request) {
  try {
    const { email = "", code = "" } = (await req.json()) as { email?: string; code?: string };
    const r = await loginWithPasscode(req, email, code);
    if (r.role !== "client") throw new HttpError(409, "use_main_login");
    return Response.json(r);
  } catch (e) {
    return fail(e);
  }
}
