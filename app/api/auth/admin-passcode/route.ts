import { validPasscode } from "@/lib/customer";
import { HttpError, fail, requireAdmin, serviceClient } from "@/lib/server/admin";
import { adminEmails } from "@/lib/server/auth";

/** O admin muda o seu código de acesso (4–6 dígitos). */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const email = (user.email ?? "").toLowerCase();
    const admins = adminEmails();
    if (!email || (admins.length && !admins.includes(email))) throw new HttpError(403, "not_allowed");
    const { code = "" } = (await req.json()) as { code?: string };
    if (!validPasscode(code)) throw new HttpError(400, "bad_passcode");
    const { error } = await serviceClient().rpc("set_admin_passcode", { p_email: email, p_code: code });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
