import { clearClientCookie } from "@/lib/server/portal";

export async function POST() {
  await clearClientCookie();
  return Response.json({ ok: true });
}
