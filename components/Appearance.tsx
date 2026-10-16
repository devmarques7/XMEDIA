"use client";

// Carrega a aparência do workspace e aplica-a (uma vez por página). Em toda a app, portal e links públicos.
import { useEffect } from "react";
import { applyAppearance, loadAppearance } from "@/lib/appearanceStore";

export function AppearanceStyle() {
  useEffect(() => {
    loadAppearance()
      .then((a) => applyAppearance(a))
      .catch(() => {});
  }, []);
  return null;
}
