// Que trabalho combina com cada função (regra de reserva quando a IA não está disponível) e a escolha do que
// atribuir dentro do tempo livre. A IA usa a mesma lógica com mais contexto (descrição e responsabilidades).
import type { Action } from "./plan";
import type { PostType } from "./customer";

export type RoleKind = "editor" | "designer" | "manager" | "writer" | "general";

const has = (s: string, words: string[]) => words.some((w) => s.includes(w));
/** Tipo de função a partir do texto (função + descrição + responsabilidades), em PT/EN/NL. */
export function roleKind(text: string): RoleKind {
  const s = text.toLowerCase();
  if (has(s, ["edit", "vídeo", "video", "videomaker", "filmmaker", "motion", "montag", "pós-produ", "pos-produ", "post-produ", "colorist"])) return "editor";
  if (has(s, ["design", "gráfic", "grafic", "illustr", "ilustr", "art direct", "diretor de arte", "vormgev"])) return "designer";
  if (has(s, ["gest", "manag", "project", "projet", "account", "produtor", "producer", "coordena", "coördin", "planner", "ops", "operaç"])) return "manager";
  if (has(s, ["copy", "social", "conteúdo", "content", "redator", "redactor", "strateg", "estrateg", "community", "tekst"])) return "writer";
  return "general";
}

/** A ação de um pendente combina com a função? */
export function fitsRole(kind: RoleKind, item: { type: PostType; action: Action }): boolean {
  const a = item.action;
  switch (kind) {
    case "editor":
      return (a === "edit" || a === "changes") && (item.type === "reel" || item.type === "story");
    case "designer":
      return (a === "edit" || a === "changes") && (item.type === "carousel" || item.type === "post");
    case "manager":
      return a === "followup" || a === "schedule" || a === "unblock";
    case "writer":
      return a === "script";
    default:
      return false;
  }
}

/** Escolhe por prioridade os pendentes da função que cabem em `free` minutos. */
export function pickForRole<T extends { type: PostType; action: Action; min: number; score: number }>(pool: T[], kind: RoleKind, free: number): T[] {
  const out: T[] = [];
  let left = free;
  for (const x of [...pool].sort((a, b) => b.score - a.score)) {
    if (!fitsRole(kind, x) || x.min > left) continue;
    out.push(x);
    left -= x.min;
  }
  return out;
}
