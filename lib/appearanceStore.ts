"use client";

// Lê e grava a aparência (app_settings.data.appearance). A leitura é pública (/api/appearance) para o portal e os
// links públicos terem as mesmas cores e fontes; a escrita é feita por quem tem settings.manage.
import { APPEARANCE_LS, appearanceCss, normalizeAppearance, type Appearance } from "./appearance";
import { customerStore } from "./customerStore";
import { supabaseEnabled } from "./supabase/client";

export const APPEARANCE_CHANGED = "xmedia:appearance-changed";

export async function loadAppearance(): Promise<Appearance> {
  if (supabaseEnabled) {
    const r = await fetch("/api/appearance", { cache: "no-store" });
    if (r.ok) return normalizeAppearance(await r.json());
  }
  return normalizeAppearance((await customerStore.settings()).appearance);
}

export async function saveAppearance(a: Appearance) {
  const s = await customerStore.settings();
  await customerStore.saveSettings({ ...s, appearance: normalizeAppearance(a) });
  applyAppearance(a);
}

/** Injeta o CSS e guarda-o neste browser (aplicado antes de pintar na próxima visita). */
export function applyAppearance(a: Appearance, persist = true) {
  const css = appearanceCss(normalizeAppearance(a));
  let el = document.getElementById("xm-appearance") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "xm-appearance";
    document.head.appendChild(el);
  }
  el.textContent = css;
  if (persist)
    try {
      localStorage.setItem(APPEARANCE_LS, JSON.stringify({ css, theme: a.defaultTheme }));
    } catch {}
  window.dispatchEvent(new Event(APPEARANCE_CHANGED));
}
