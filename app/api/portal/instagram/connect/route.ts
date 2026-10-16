import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomToken } from "@/lib/codes";
import { igAuthorizeUrl } from "@/lib/customer";
import { igConfigured, igRedirect } from "@/lib/server/instagram";
import { requireCustomer } from "@/lib/server/portal";

/** Abre o login do Instagram (contas Business/Creator) com proteção CSRF por state. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  try {
    const { user } = await requireCustomer();
    if (user.role !== "owner") return NextResponse.redirect(`${origin}/portal?tab=metrics&ig=owner_only`);
  } catch {
    return NextResponse.redirect(`${origin}/portal/login`);
  }
  if (!igConfigured()) return NextResponse.redirect(`${origin}/portal?tab=metrics&ig=not_configured`);
  const state = randomToken(16);
  (await cookies()).set("xm_ig_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 15 * 60 });
  return NextResponse.redirect(igAuthorizeUrl({ appId: process.env.INSTAGRAM_APP_ID!, redirectUri: igRedirect(origin), state }));
}
