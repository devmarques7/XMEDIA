// Cofre de acessos (keeper): logins de plataformas (link, conceito, email/utilizador, senha) do cliente e internos.
// A senha NUNCA fica em texto claro: é cifrada no servidor (AES-256-GCM, chave VAULT_KEY só no Vercel) e só sai
// no momento de revelar/copiar, com registo. O CLIENTE decide quem vê as entradas dele (o estúdio só com permissão).
// Funções puras (vault.test.ts).

export type Cipher = { iv: string; ct: string }; // base64
export type Grant = { kind: "studio" | "member" | "client"; email?: string }; // studio = toda a equipa XMEDIA
export type VaultEvent = { at: string; by: string; action: "created" | "updated" | "revealed" | "copied" | "granted" | "revoked" | "deleted"; detail?: string };

export type VaultEntry = {
  id: string;
  customer_id: string; // "" = interno (equipa XMEDIA)
  platform: string; // nome (ex.: "Instagram", "Meta Business")
  url: string; // link de login
  concept: string; // para que serve / notas
  login: string; // email ou utilizador
  secret?: Cipher; // senha cifrada (só no servidor)
  has_secret: boolean;
  created_by: { email: string; side: "client" | "studio" };
  grants: Grant[];
  audit: VaultEvent[];
  created_at: string;
  updated_at: string;
  deleted?: boolean;
};

/** Quem está a pedir: alguém do estúdio (admin ou membro) ou uma pessoa do cliente. */
export type Viewer = { side: "studio"; email: string; admin: boolean } | { side: "client"; email: string; customer_id: string; owner: boolean };

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();

export function newEntry(p: Partial<VaultEntry> & { customer_id: string; created_by: VaultEntry["created_by"] }): VaultEntry {
  const t = now();
  // por omissão: entradas do cliente visíveis só a ele; criadas pelo estúdio também ao estúdio; internas a toda a equipa
  const grants: Grant[] = p.customer_id ? (p.created_by.side === "studio" ? [{ kind: "studio" }] : []) : [{ kind: "studio" }];
  return { id: uid(), platform: "", url: "", concept: "", login: "", has_secret: false, grants, audit: [{ at: t, by: p.created_by.email, action: "created" }], created_at: t, updated_at: t, ...p };
}

/** Pode ver (revelar/copiar) a senha? */
export function canReveal(e: VaultEntry, v: Viewer): boolean {
  const email = v.email.toLowerCase();
  if (!e.customer_id) return v.side === "studio" && (v.admin || e.grants.some((g) => g.kind === "studio" || (g.kind === "member" && g.email?.toLowerCase() === email)));
  if (v.side === "client") return v.customer_id === e.customer_id && (v.owner || e.created_by.email.toLowerCase() === email || e.grants.some((g) => g.kind === "client" && g.email?.toLowerCase() === email));
  // estúdio numa entrada do cliente: só com permissão dada pelo cliente
  return e.grants.some((g) => g.kind === "studio" || (g.kind === "member" && g.email?.toLowerCase() === email));
}

/** Pode alterar quem tem acesso? Cliente: só o responsável (owner). Internas: admin do estúdio. */
export function canManage(e: VaultEntry, v: Viewer): boolean {
  if (!e.customer_id) return v.side === "studio" && v.admin;
  return v.side === "client" && v.customer_id === e.customer_id && v.owner;
}

/** Pode editar os dados (link, conceito, login, senha)? Quem criou, o responsável do cliente, ou admin nas internas. */
export function canEdit(e: VaultEntry, v: Viewer): boolean {
  if (canManage(e, v)) return true;
  if (e.created_by.email.toLowerCase() === v.email.toLowerCase()) return true;
  return false;
}

/** Versão para enviar ao browser: sem a cifra e com o que esta pessoa pode fazer. */
export function publicEntry(e: VaultEntry, v: Viewer) {
  const { secret: _s, ...rest } = e;
  return { ...rest, can: { reveal: canReveal(e, v), manage: canManage(e, v), edit: canEdit(e, v) } };
}
export type PublicEntry = ReturnType<typeof publicEntry>;

export function audit(e: VaultEntry, ev: Omit<VaultEvent, "at">): VaultEntry {
  return { ...e, audit: [...e.audit, { at: now(), ...ev }].slice(-200), updated_at: now() };
}

export function normalizeVault(x: unknown): VaultEntry[] {
  return (Array.isArray(x) ? x : []).filter((e) => e && typeof e.id === "string").map((e) => ({ grants: [], audit: [], concept: "", login: "", url: "", platform: "", has_secret: !!e.secret, ...e }));
}

/** Nome da plataforma a partir do link (instagram.com → Instagram). */
export function platformOf(url: string): string {
  try {
    const h = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
    const known: Record<string, string> = { "instagram.com": "Instagram", "facebook.com": "Facebook", "business.facebook.com": "Meta Business", "tiktok.com": "TikTok", "youtube.com": "YouTube", "linkedin.com": "LinkedIn", "google.com": "Google", "accounts.google.com": "Google", "canva.com": "Canva", "x.com": "X", "twitter.com": "X", "pinterest.com": "Pinterest", "shopify.com": "Shopify", "wordpress.com": "WordPress", "mailchimp.com": "Mailchimp", "notion.so": "Notion", "dropbox.com": "Dropbox", "vimeo.com": "Vimeo" };
    if (known[h]) return known[h];
    const base = h.split(".").slice(-2, -1)[0] ?? h;
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return "";
  }
}

/** Gerador de senhas fortes (sem caracteres ambíguos). */
export function strongPassword(len = 18): string {
  const set = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?-_";
  const r = crypto.getRandomValues(new Uint32Array(len));
  return Array.from(r, (n) => set[n % set.length]).join("");
}

/** Força aproximada (0–4) para o indicador. */
export function strength(p: string): number {
  let s = 0;
  if (p.length >= 10) s++;
  if (p.length >= 14) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
