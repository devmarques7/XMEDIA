import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCode, igRedirect, storeToken, syncInstagram } from "@/lib/server/instagram";
import { patchCustomer, requireCustomer } from "@/lib/server/portal";

export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(`${url.origin}/portal?tab=metrics&ig=${q}`);
  const jar = await cookies();
  const state = jar.get("xm_ig_state")?.value;
  jar.delete("xm_ig_state");
  let customerId: string;
  try {
    customerId = (await requireCustomer()).customer.id;
  } catch {
    return NextResponse.redirect(`${url.origin}/portal/login`);
  }
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code")?.replace(/#_$/, "");
  if (!code || !state || state !== url.searchParams.get("state")) return back("state");
  try {
    const t = await exchangeCode(code, igRedirect(url.origin));
    await storeToken(customerId, t.token, t.expiresIn, t.userId);
    await syncInstagram(customerId);
    return back("connected");
  } catch (e) {
    await patchCustomer(customerId, (x) => ({ ...x, instagram: { ...x.instagram, error: e instanceof Error ? e.message.slice(0, 300) : "error" } })).catch(() => {});
    return back("error");
  }
}
