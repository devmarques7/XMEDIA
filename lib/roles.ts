// Papéis e permissões dos team members na plataforma.
// O admin (dono do workspace) tem tudo. Cada member tem um papel (predefinição) e uma lista de permissões
// que o admin pode afinar. A mesma lista é verificada na base de dados (RLS: has_perm) — a interface só esconde.

export const PERMS = [
  "projects.view", // ver projetos, calendário, histórico
  "projects.edit", // criar/editar projetos e tarefas
  "customers.view", // ver clientes, conteúdos, pipeline
  "customers.edit", // editar clientes e conteúdos, convidar para o portal, publicar
  "proposals.view", // ver propostas (têm valores comerciais)
  "proposals.edit", // criar/editar propostas e links de partilha
  "invoices.create", // registar invoices novas (só rascunhos próprios)
  "finance.view", // finanças completas: todas as invoices, totais, BTW, estados, pagamentos
  "team.manage", // gerir team members, horas e fecho do mês (inclui valores/hora)
  "settings.manage", // definições: mensalidade, processo, integrações
] as const;
export type Perm = (typeof PERMS)[number];

export const APP_ROLES = ["none", "viewer", "production", "manager"] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Predefinições de cada papel (o admin pode acrescentar/retirar permissões por pessoa). */
export const ROLE_PRESETS: Record<AppRole, Perm[]> = {
  none: [], // só a própria área (horas e perfil)
  viewer: ["projects.view", "customers.view"],
  production: ["projects.view", "projects.edit", "customers.view", "customers.edit", "invoices.create"],
  manager: ["projects.view", "projects.edit", "customers.view", "customers.edit", "proposals.view", "proposals.edit", "invoices.create", "team.manage"],
};

/** Permissões que só o admin deve dar conscientemente (dinheiro). */
export const SENSITIVE: Perm[] = ["finance.view", "team.manage", "settings.manage"];

export const ALL_PERMS = new Set<Perm>(PERMS);
export const cleanPerms = (list: unknown): Perm[] => (Array.isArray(list) ? PERMS.filter((p) => list.includes(p)) : []);

/** "edit" implica "view"; sem papel não há permissões. */
export function effectivePerms(role: AppRole, list: Perm[]): Perm[] {
  if (role === "none") return [];
  const s = new Set(list);
  if (s.has("projects.edit")) s.add("projects.view");
  if (s.has("customers.edit")) s.add("customers.view");
  if (s.has("proposals.edit")) s.add("proposals.view");
  return PERMS.filter((p) => s.has(p));
}

/** Acesso atual de quem está na app. Admin = tudo. */
export type Access = { admin: boolean; role: AppRole | "admin"; perms: Set<Perm> };
export const ADMIN_ACCESS: Access = { admin: true, role: "admin", perms: new Set(PERMS) };
export const can = (a: Access | null, p: Perm) => !!a && (a.admin || a.perms.has(p));

/** Que permissão cada página da área privada pede (o resto é livre para quem tem sessão). */
export const PAGE_PERMS: { prefix: string; any: Perm[] }[] = [
  { prefix: "/projetos", any: ["projects.view"] },
  { prefix: "/p/", any: ["projects.view"] },
  { prefix: "/historico", any: ["projects.view"] },
  { prefix: "/calendario", any: ["projects.view"] },
  { prefix: "/importar", any: ["projects.edit"] },
  { prefix: "/clientes", any: ["customers.view"] },
  { prefix: "/estudio", any: ["customers.view"] },
  { prefix: "/tarefas", any: ["customers.view"] },
  { prefix: "/documentos", any: ["customers.view"] },
  { prefix: "/acessos", any: ["customers.view"] },
  { prefix: "/avaliacoes", any: ["customers.view"] },
  { prefix: "/inspiracao", any: ["customers.view"] },
  { prefix: "/propostas", any: ["proposals.view"] },
  { prefix: "/servicos", any: ["proposals.view"] },
  { prefix: "/financas", any: ["finance.view", "invoices.create"] },
  { prefix: "/equipa", any: ["team.manage"] },
  { prefix: "/definicoes", any: ["settings.manage"] },
];
export function canOpen(a: Access | null, path: string) {
  const rule = PAGE_PERMS.find((r) => path === r.prefix || path.startsWith(r.prefix.endsWith("/") ? r.prefix : r.prefix + "/") || path === r.prefix);
  return !rule || rule.any.some((p) => can(a, p));
}
