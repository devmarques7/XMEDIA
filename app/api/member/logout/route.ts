import { clearMemberCookie } from "@/lib/server/admin";

export async function POST() {
  await clearMemberCookie();
  return Response.json({ ok: true });
}
