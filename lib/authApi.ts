"use client";

// Login único (email + código de 4–6 dígitos). Em produção o servidor decide se é admin, equipa ou cliente.
// Em modo local (sem Supabase) procura nos clientes e na equipa guardados neste navegador.
import type { Lang } from "./i18n";
import { ApiError, memberApi } from "./memberApi";
import { portalApi } from "./portalApi";
import { supabaseEnabled } from "./supabase/client";

export type LoginResult = { to: string; lang?: Lang; name?: string; role?: "admin" | "member" | "client" };

export async function passcodeLogin(email: string, code: string): Promise<LoginResult> {
  if (supabaseEnabled) {
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(j.error || `http_${r.status}`);
    return j as LoginResult;
  }
  try {
    const r = await portalApi.login(email, code);
    return { to: "/portal", lang: r.lang, name: r.name };
  } catch {}
  try {
    const r = await memberApi.login(email, code);
    return { to: "/eu", lang: r.lang };
  } catch {}
  throw new ApiError("bad_passcode");
}
