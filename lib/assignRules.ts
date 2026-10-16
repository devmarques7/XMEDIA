// Automação de responsáveis: "quando um conteúdo é criado / passa para a etapa X (do tipo T, do cliente C),
// atribuir à pessoa P". Aplicada sempre que um conteúdo é gravado (browser e servidor). Função pura.
import { phaseOf, type ContentPost, type Phase, type PostType } from "./customer";

export type AssignRule = {
  id: string;
  on: "create" | "phase";
  /** Etapa de destino (só para on = "phase"). */
  phase?: Phase;
  type?: PostType | "any";
  customer_id?: string | "any";
  assignee: string; // email
  active?: boolean;
};

const matches = (r: AssignRule, p: ContentPost) => (!r.type || r.type === "any" || r.type === p.type) && (!r.customer_id || r.customer_id === "any" || r.customer_id === p.customer_id);

/**
 * Responsável depois de gravar: conteúdo novo → regras "create"; mudou de etapa → regras dessa etapa.
 * A regra mais específica ganha (cliente > tipo > geral); sem regra, fica como estava.
 */
export function applyAssignRules(prev: ContentPost | null, next: ContentPost, rules: AssignRule[] = []): ContentPost {
  const live = rules.filter((r) => r.active !== false && r.assignee);
  if (!live.length) return next;
  const phase = phaseOf(next);
  const event: AssignRule["on"] | null = !prev ? "create" : phaseOf(prev) !== phase ? "phase" : null;
  if (!event) return next;
  const cands = live.filter((r) => r.on === event && (event === "create" || r.phase === phase) && matches(r, next));
  // novo conteúdo que já nasce numa etapa: também valem as regras dessa etapa
  if (event === "create") cands.push(...live.filter((r) => r.on === "phase" && r.phase === phase && matches(r, next)));
  if (!cands.length) return next;
  const score = (r: AssignRule) => (r.customer_id && r.customer_id !== "any" ? 2 : 0) + (r.type && r.type !== "any" ? 1 : 0) + (r.on === event ? 0.5 : 0);
  const best = cands.sort((a, b) => score(b) - score(a))[0];
  return { ...next, assignee: best.assignee.toLowerCase() };
}

export const normalizeRules = (v: unknown): AssignRule[] =>
  Array.isArray(v) ? (v as AssignRule[]).filter((r) => r && typeof r.id === "string" && typeof r.assignee === "string" && (r.on === "create" || r.on === "phase")) : [];
