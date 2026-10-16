// Alterações pedidas fora da app (email, WhatsApp, chamada): o utilizador diz "a Carioca pediu estas alterações no
// reel da feijoada" e a IA encontra o conteúdo pelo nome e regista cada pedido como comentário do cliente — o
// conteúdo passa para "Alterações pedidas" (sem marcar frame a frame). Puro: usado pelo assistente e pelo MCP.
import { addNote, moveToPhase, openNotes, type ContentPost, type Customer } from "./customer";
import { DraftError, matchCustomers } from "./contentDrafts";

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

export type PostHit = { post: ContentPost; customer: Pick<Customer, "id" | "name">; score: number };

/** Conteúdos cujo título (ou início da legenda) corresponde ao texto, opcionalmente só de um cliente. */
export function matchPosts(posts: ContentPost[], customers: Pick<Customer, "id" | "name" | "contact" | "email">[], query: unknown, customerQuery?: unknown): PostHit[] {
  const q = fold(String(query ?? ""));
  const scope = customerQuery ? new Set(matchCustomers(customers, customerQuery).map((c) => c.id)) : null;
  const byId = new Map(customers.map((c) => [c.id, c]));
  const words = q.split(" ").filter((w) => w.length >= 2);
  const score = (p: ContentPost) => {
    if (p.id === String(query ?? "").trim()) return 100;
    const title = fold(p.title);
    if (!q) return 1;
    if (title === q) return 90;
    if (title.includes(q)) return 70;
    const hay = `${title} ${fold(p.caption.slice(0, 200))}`;
    const hits = words.filter((w) => hay.includes(w)).length;
    return words.length && hits === words.length ? 50 : hits >= Math.max(2, Math.ceil(words.length * 0.6)) ? 20 : 0;
  };
  return posts
    .filter((p) => !p.deleted_at && byId.has(p.customer_id) && (!scope || scope.has(p.customer_id)))
    .map((p) => [score(p), p] as const)
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0] || (b[1].phase_since ?? "").localeCompare(a[1].phase_since ?? ""))
    .map(([score, p]) => ({ post: p, customer: byId.get(p.customer_id)!, score }));
}

/** Um só conteúdo: o melhor se for claro; senão erro com os candidatos (a IA pergunta qual). */
export function pickPost(posts: ContentPost[], customers: Pick<Customer, "id" | "name" | "contact" | "email">[], query: unknown, customerQuery?: unknown): PostHit {
  if (!String(query ?? "").trim()) throw new DraftError("indique o conteúdo (nome ou id) — use find_content");
  const hits = matchPosts(posts, customers, query, customerQuery);
  if (!hits.length) throw new DraftError(`conteúdo "${query}" não encontrado${customerQuery ? ` no cliente "${customerQuery}"` : ""} — use find_content`);
  // claro quando só um tem a pontuação máxima e se destaca do seguinte (ex.: título contém tudo vs. palavras soltas)
  const [first, second] = hits;
  if (!second || (first.score > second.score && first.score - second.score >= 20)) return first;
  {
    const top = hits.slice(0, 6).map((h) => `"${h.post.title}" · ${h.customer.name} (${h.post.id})`);
    throw new DraftError(`"${query}" corresponde a vários conteúdos: ${top.join("; ")} — pergunte qual ou use o id`);
  }
}

/** Separa um texto colado (email) em pedidos: linhas, marcadores ou frases numeradas. */
export function splitChanges(input: unknown): string[] {
  const list = Array.isArray(input) ? input.map(String) : String(input ?? "").split(/\r?\n+/);
  return list
    .map((s) => s.replace(/^\s*(?:[-*•–—]|\d+[.)])\s*/, "").trim())
    .filter((s) => s.length > 1)
    .map((s) => s.slice(0, 2000))
    .slice(0, 50);
}

/**
 * Regista os pedidos como comentários do cliente (abertos) e põe o conteúdo em "Alterações pedidas"
 * (se estava em aprovação, aprovado ou agendado). Publicado: regista, mas não muda de fase.
 */
export function applyChangeRequests(p: ContentPost, o: { changes: unknown; from?: string; source?: string; at?: string }) {
  const items = splitChanges(o.changes);
  if (!items.length) throw new DraftError("sem alterações para registar (changes vazio)");
  const at = o.at ?? new Date().toISOString();
  const author = [o.from?.trim(), o.source?.trim() ? `via ${o.source.trim()}` : ""].filter(Boolean).join(" · ").slice(0, 80) || undefined;
  let next = p;
  for (const text of items) next = addNote(next, { by: "client", text, media: 0, author }, at);
  const moved = ["review", "approved", "scheduled"].includes(p.status);
  if (moved) next = moveToPhase(next, "changes", at);
  return { post: next, added: items.length, moved, open: openNotes(next).length, published: p.status === "published" };
}

/** Resumo para confirmar (assistente) e para a resposta do MCP. */
export function changeLines(hit: PostHit, r: ReturnType<typeof applyChangeRequests>, items: string[]) {
  return [
    `${hit.customer.name} · "${hit.post.title || hit.post.type}": +${r.added} alteração(ões) do cliente${r.moved ? " → Alterações pedidas" : ""}${r.published ? " (já publicado: fica só registado)" : ""}`,
    ...items.slice(0, 15).map((t) => `• ${t}`),
  ];
}
