// Validação de um conteúdo pelo cliente, por tipo (Reel, Post, Carrossel, Story): cada critério fica "ok" ou
// "ajustar" (e um "ajustar" pede um comentário, que entra na checklist do editor). Também transforma um comentário
// longo em vários itens de checklist. Funções puras.
import type { ContentPost, PostType } from "./customer";

export const CRITERIA: Record<PostType, string[]> = {
  reel: ["hook", "pace", "subtitles", "audio", "color", "cover", "cta"],
  post: ["image", "copy", "brand", "cta"],
  carousel: ["first", "sequence", "legibility", "brand", "cta"],
  story: ["legibility", "sticker", "duration", "brand"],
};

export function validationState(p: Pick<ContentPost, "type" | "validation">) {
  const list = CRITERIA[p.type];
  const v = p.validation ?? {};
  const ok = list.filter((k) => v[k] === "ok").length;
  const fix = list.filter((k) => v[k] === "fix").length;
  return { list, ok, fix, done: ok + fix === list.length, pct: Math.round(((ok + fix) / list.length) * 100) };
}

/**
 * Sugestão de checklist a partir de um comentário: separa por linhas, pontos, ";" e " e também "/" " and also ".
 * Só sugere quando há 2+ pedidos com conteúdo (≥ 3 letras).
 */
export function splitChecklist(text: string): string[] {
  const parts = text
    .split(/\n+|(?<=[.!?;])\s+|\s+(?:e também|e ainda|and also|en ook)\s+|\s*•\s*|^\s*[-*]\s+/gim)
    .map((s) => s.replace(/^[\s\-*•\d.)]+/, "").replace(/[.;]+$/, "").trim())
    .filter((s) => /\p{L}{3,}/u.test(s));
  return parts.length >= 2 ? parts.slice(0, 12) : [];
}
