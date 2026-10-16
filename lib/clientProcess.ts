// Processo de produção ajustável por cliente: grupos e etapas com nome, prazo (dias) e as fases internas que
// cada etapa cobre. O quadro (Produção), os resumos e o MCP usam sempre estas etapas. Funções puras (testadas).
import { phaseOf, type ContentPost, type Phase } from "./customer";

export type ProcessStage = {
  id: string;
  label: string;
  group: string;
  days: number;
  /** Fases internas que caem nesta etapa (um conteúdo pode também ser fixado numa etapa com `post.stage`). */
  phases: Phase[];
  /** Etapa em que se espera ação do cliente (aprovar / comentar). */
  client?: boolean;
  /** Etapa de publicação automática. */
  auto?: boolean;
};
export type ClientProcess = { version: 1; groups: string[]; stages: ProcessStage[] };

export const ALL_PHASES: Phase[] = ["idea", "editing", "client_review", "changes", "blocked", "approved", "scheduled", "published"];

/** Processo Marques por omissão: rascunhos → preview → pedidos (alterações) → aprovados → automático → publicado. */
export const DEFAULT_CLIENT_PROCESS: ClientProcess = {
  version: 1,
  groups: ["Produção", "Aprovação", "Entrega"],
  stages: [
    { id: "drafts", label: "Rascunhos", group: "Produção", days: 5, phases: ["idea", "editing"] },
    { id: "preview", label: "Preview", group: "Aprovação", days: 2, phases: ["client_review"], client: true },
    { id: "inquiry", label: "Pedidos de alteração", group: "Aprovação", days: 2, phases: ["changes", "blocked"] },
    { id: "approved", label: "Aprovados", group: "Entrega", days: 1, phases: ["approved"] },
    { id: "auto", label: "Automático", group: "Entrega", days: 0, phases: ["scheduled"], auto: true },
    { id: "published", label: "Publicado", group: "Entrega", days: 0, phases: ["published"] },
  ],
};

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "etapa";

/** Garante um processo válido: ids únicos, grupos existentes, e TODAS as fases cobertas (as que faltam vão para a etapa mais próxima). */
export function normalizeProcessDef(x: unknown): ClientProcess {
  const o = (x ?? {}) as Partial<ClientProcess>;
  const src = Array.isArray(o.stages) && o.stages.length ? o.stages : DEFAULT_CLIENT_PROCESS.stages;
  const seen = new Set<string>();
  const stages: ProcessStage[] = src.slice(0, 16).map((s, i) => {
    const label = String(s?.label ?? "").trim().slice(0, 40) || `Etapa ${i + 1}`;
    let id = slug(String(s?.id || label));
    while (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    return {
      id,
      label,
      group: String(s?.group ?? "").trim().slice(0, 30),
      days: Math.max(0, Math.min(60, Math.round(Number(s?.days) || 0))),
      phases: (Array.isArray(s?.phases) ? s.phases : []).filter((p): p is Phase => ALL_PHASES.includes(p as Phase)),
      ...(s?.client ? { client: true } : {}),
      ...(s?.auto ? { auto: true } : {}),
    };
  });
  // cada fase numa só etapa (a primeira que a reclama)
  const owner = new Map<Phase, string>();
  for (const s of stages) s.phases = s.phases.filter((p) => !owner.has(p) && (owner.set(p, s.id), true));
  // fases sem etapa → etapa do vizinho mais próximo na ordem natural
  for (const p of ALL_PHASES) {
    if (owner.has(p)) continue;
    const i = ALL_PHASES.indexOf(p);
    const near = [...ALL_PHASES.slice(0, i).reverse(), ...ALL_PHASES.slice(i + 1)].find((q) => owner.has(q));
    const target = stages.find((s) => s.id === (near ? owner.get(near) : stages[0].id)) ?? stages[0];
    target.phases.push(p);
    owner.set(p, target.id);
  }
  const groups = [...new Set([...(Array.isArray(o.groups) ? o.groups.map((g) => String(g).trim().slice(0, 30)).filter(Boolean) : []), ...stages.map((s) => s.group).filter(Boolean)])];
  for (const s of stages) if (!s.group) s.group = groups[0] ?? "";
  return { version: 1, groups, stages };
}

/** Etapa de um conteúdo: a fixada (post.stage) se existir, senão a que cobre a fase dele. */
export function stageOf(p: Pick<ContentPost, "status" | "blocked" | "notes" | "feedback"> & { stage?: string }, proc: ClientProcess): ProcessStage {
  const ph = phaseOf(p);
  const fixed = p.stage ? proc.stages.find((s) => s.id === p.stage) : undefined;
  // a etapa fixada só vale enquanto o conteúdo estiver numa das fases dela (ou se for uma etapa só de organização)
  if (fixed && (!fixed.phases.length || fixed.phases.includes(ph))) return fixed;
  return proc.stages.find((s) => s.phases.includes(ph)) ?? proc.stages[0];
}

/** Contagem por etapa (e % do total) para os resumos. */
export function stageCounts(posts: ContentPost[], proc: ClientProcess) {
  const total = posts.length;
  return proc.stages.map((s) => {
    const n = posts.filter((p) => stageOf(p, proc).id === s.id).length;
    return { stage: s, n, pct: total ? Math.round((n / total) * 100) : 0 };
  });
}

/** Mover para uma etapa: fixa a etapa e, se ela tiver fases, passa o conteúdo para a primeira delas. */
export function stageMove(p: ContentPost, stage: ProcessStage, move: (p: ContentPost, ph: Phase) => ContentPost): ContentPost {
  const next = stage.phases.length && phaseOf(p) !== stage.phases[0] && !stage.phases.includes(phaseOf(p)) ? move(p, stage.phases[0]) : p;
  return { ...next, stage: stage.id };
}

/** O que acontece quando o CLIENTE arrasta um conteúdo para uma etapa: só pode aprovar ou pedir alterações a algo em Preview. */
export function clientDropAction(p: Pick<ContentPost, "status">, to: ProcessStage): "approve" | "changes" | null {
  if (p.status !== "review") return null;
  if (to.phases.some((ph) => ph === "approved" || ph === "scheduled")) return "approve";
  if (to.phases.includes("changes")) return "changes";
  return null;
}

// ---------- nomes traduzidos ----------
// As etapas e os grupos padrão foram gravados em português; se o nome continua o padrão, mostra-se traduzido
// (chaves proc.stage.<id> / proc.group.<n>). Nomes personalizados pelo estúdio ficam como foram escritos.
const DEFAULT_STAGE_LABEL = Object.fromEntries(DEFAULT_CLIENT_PROCESS.stages.map((s) => [s.id, s.label]));
const DEFAULT_GROUPS: Record<string, string> = { Produção: "production", Production: "production", Productie: "production", Aprovação: "approval", Approval: "approval", Goedkeuring: "approval", Entrega: "delivery", Delivery: "delivery", Oplevering: "delivery" };
type T = (k: never) => string;
/** Nomes que contam como "padrão" (qualquer língua): esses mostram-se traduzidos. */
const STAGE_ALIASES: Record<string, string[]> = {
  drafts: ["Rascunhos", "Drafts", "Concepten", "Ideias"],
  preview: ["Preview", "Para aprovar", "To approve", "Ter goedkeuring", "Por aprovar"],
  inquiry: ["Pedidos de alteração", "Change requests", "Wijzigingsverzoeken", "Alterações"],
  approved: ["Aprovados", "Approved", "Goedgekeurd"],
  auto: ["Automático", "Scheduled (auto)", "Automatisch", "Agendado"],
  published: ["Publicado", "Published", "Gepubliceerd", "Publicados"],
};
export function stageName(s: Pick<ProcessStage, "id" | "label">, t: T): string {
  const known = DEFAULT_STAGE_LABEL[s.id] === s.label || (STAGE_ALIASES[s.id] ?? []).some((a) => a.toLowerCase() === s.label.trim().toLowerCase());
  return known ? t(`proc.stage.${s.id}` as never) : s.label;
}
export function groupName(g: string, t: T): string {
  return DEFAULT_GROUPS[g] ? t(`proc.group.${DEFAULT_GROUPS[g]}` as never) : g;
}
