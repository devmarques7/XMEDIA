// Tarefas (to-dos) partilhadas entre o cliente e o estúdio: ligadas a um conteúdo ou não, com menções (@pessoa),
// prazo e quem criou. Guardadas no documento do cliente; junção por id (a versão mais recente ganha). Funções puras.
export type Task = {
  id: string;
  title: string;
  notes: string;
  done: boolean;
  due: string; // AAAA-MM-DD ou ""
  post_id: string; // conteúdo relacionado ou ""
  mentions: string[]; // emails das pessoas mencionadas
  by: string; // nome de quem criou
  side: "client" | "studio";
  /** Só o estúdio vê (tarefas internas). */
  internal?: boolean;
  /** Responsável (email) e coluna no quadro da pessoa; "done" continua a ser o campo done. */
  assignee?: string;
  progress?: "todo" | "doing" | "review";
  /** Tempo estimado (minutos), definido à mão. Sem ele usa-se a estimativa do conteúdo ou do título (lib/plan). */
  estimate?: number;
  /** Ordem manual na checklist do dia (menor = mais acima). Sem ela ordena-se pela prioridade automática. */
  rank?: number;
  deleted?: boolean;
  at: string;
  updated: string;
};

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function newTask(p: Partial<Task> & { title: string; by: string; side: Task["side"] }): Task {
  const now = new Date().toISOString();
  return { id: uid(), notes: "", done: false, due: "", post_id: "", mentions: [], at: now, updated: now, ...p, title: p.title.trim().slice(0, 2000) };
}

/** Menções no texto: "@ana" ou "@ana@empresa.com" → emails das pessoas conhecidas. */
export function parseMentions(text: string, people: { name: string; email: string }[]) {
  const tags = [...text.matchAll(/@([\p{L}\p{N}._-]+(?:@[\w.-]+\.\w+)?)/gu)].map((m) => m[1].toLowerCase());
  const out = new Set<string>();
  for (const tag of tags) {
    const hit = people.find((p) => p.email.toLowerCase() === tag || p.email.toLowerCase().split("@")[0] === tag || p.name.toLowerCase().split(" ")[0] === tag);
    if (hit) out.add(hit.email.toLowerCase());
  }
  return [...out];
}

/** Junta duas listas (cliente e estúdio podem editar ao mesmo tempo): por id, fica a alteração mais recente. */
export function mergeTasks(a: Task[] = [], b: Task[] = []) {
  const m = new Map<string, Task>();
  for (const t of [...a, ...b]) {
    const cur = m.get(t.id);
    if (!cur || t.updated > cur.updated) m.set(t.id, t);
  }
  return [...m.values()].sort((x, y) => Number(x.done) - Number(y.done) || (x.due || "9").localeCompare(y.due || "9") || y.at.localeCompare(x.at));
}

/** O que o cliente vê: sem apagadas nem internas. */
export const clientTasks = (t: Task[] = []) => t.filter((x) => !x.deleted && !x.internal);

export function normalizeTask(x: Partial<Task>): Task | null {
  if (!x || typeof x.id !== "string" || !String(x.title ?? "").trim()) return null;
  const now = new Date().toISOString();
  return {
    id: x.id.slice(0, 64),
    title: String(x.title).trim().slice(0, 2000),
    notes: String(x.notes ?? "").slice(0, 2000),
    done: !!x.done,
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(x.due ?? "")) ? String(x.due) : "",
    post_id: String(x.post_id ?? "").slice(0, 64),
    mentions: (Array.isArray(x.mentions) ? x.mentions : []).map((e) => String(e).toLowerCase().slice(0, 120)).slice(0, 20),
    by: String(x.by ?? "").slice(0, 80),
    side: x.side === "studio" ? "studio" : "client",
    ...(x.internal ? { internal: true } : {}),
    ...(x.deleted ? { deleted: true } : {}),
    ...(Number(x.estimate) > 0 ? { estimate: Math.min(16 * 60, Math.round(Number(x.estimate))) } : {}),
    ...(Number.isFinite(Number(x.rank)) && x.rank !== undefined ? { rank: Number(x.rank) } : {}),
    at: String(x.at ?? now),
    updated: String(x.updated ?? now),
  };
}
