import { maskEmail } from "@/lib/codes";
import { validPasscode } from "@/lib/customer";
import { HttpError, fail, hashToken, serviceClient, setMemberCookie } from "@/lib/server/admin";
import { hashMemberPasscode, startUserSession } from "@/lib/server/auth";

type Ctx = { params: Promise<{ token: string }> };

async function find(token: string) {
  if (!/^[\w-]{20,100}$/.test(token)) throw new HttpError(404, "invalid");
  const { data: m } = await serviceClient()
    .from("team_members")
    .select("id, owner_id, name, email, lang, status, invite_expires_at, app_role, role, photo_url")
    .eq("invite_token_hash", await hashToken(token))
    .maybeSingle();
  if (!m) throw new HttpError(404, "invalid");
  if (m.status === "disabled") throw new HttpError(410, "disabled");
  if (!m.invite_expires_at || new Date(m.invite_expires_at) < new Date()) throw new HttpError(410, "expired");
  return m;
}

/** Valida o convite (sem o consumir). */
export async function GET(_: Request, { params }: Ctx) {
  try {
    const m = await find((await params).token);
    return Response.json({ name: m.name, email: maskEmail(m.email), lang: m.lang, expiresAt: m.invite_expires_at, role: m.role, photo_url: m.photo_url });
  } catch (e) {
    return fail(e);
  }
}

/** Aceita: o funcionário escolhe o código de 4–6 dígitos (como no iPhone), o link fica inválido e inicia sessão. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const m = await find((await params).token);
    const body = (await req.json().catch(() => ({}))) as { code?: string; name?: string; role?: string; photo?: string };
    const code = body.code ?? "";
    if (!validPasscode(code)) throw new HttpError(400, "bad_passcode");
    // o convidado completa o perfil: nome, função e foto (o valor/hora fica para o admin)
    const name = String(body.name ?? "").trim().slice(0, 80);
    const role = String(body.role ?? "").trim().slice(0, 60);
    const photo_url = body.photo ? await savePhoto(m.id, body.photo) : "";
    const { error } = await serviceClient()
      .from("team_members")
      .update({
        ...(name ? { name } : {}),
        ...(role ? { role } : {}),
        ...(photo_url ? { photo_url } : {}),
        passcode_hash: await hashMemberPasscode(m.id, code),
        login_code_hash: null,
        code_hint: "",
        status: "active",
        active: true,
        registered_at: new Date().toISOString(),
        invite_token_hash: null,
        invite_expires_at: null,
      })
      .eq("id", m.id);
    if (error) throw error;
    await setMemberCookie(m.id);
    // com papel na plataforma entra já na app (sessão Supabase ligada ao workspace do admin)
    if (m.app_role && m.app_role !== "none" && m.email) {
      const uid = await startUserSession(m.email.toLowerCase());
      if (uid !== m.owner_id) await serviceClient().from("workspace_members").upsert({ user_id: uid, owner_id: m.owner_id, member_id: m.id });
      return Response.json({ name: m.name, lang: m.lang, to: "/home" });
    }
    return Response.json({ name: m.name, lang: m.lang, to: "/eu" });
  } catch (e) {
    return fail(e);
  }
}

/** Foto do convidado (data URL já reduzida no browser) → bucket público de media. */
async function savePhoto(memberId: string, dataUrl: string): Promise<string> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new HttpError(400, "bad_photo");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 600_000) throw new HttpError(413, "photo_too_big");
  const path = `team/${memberId}/${crypto.randomUUID()}.${m[1].split("/")[1].replace("jpeg", "jpg")}`;
  const db = serviceClient();
  const { error } = await db.storage.from("proposal-media").upload(path, buf, { contentType: m[1], upsert: false });
  if (error) throw error;
  return db.storage.from("proposal-media").getPublicUrl(path).data.publicUrl;
}
