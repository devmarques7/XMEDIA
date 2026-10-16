// Rascunhos de conteúdo gerados por IA (MCP e assistente XMEDIA): o utilizador diz o que vai produzir e para que
// cliente; a IA lê o briefing do cliente (marca, voz, o que já foi feito, datas ocupadas) e cria os rascunhos
// prontos — só falta carregar o vídeo/as imagens. Puro (sem browser nem servidor): usado pelos dois lados.
import { normalizeBrand } from "./brand";
import { POST_TYPES, emptyPost, type ContentPost, type Customer, type PostType } from "./customer";

export const MAX_DRAFTS = 40;
const TZ = "Europe/Amsterdam"; // horas sem fuso são da MediaMarques

/** Um rascunho pedido pela IA (todos os campos texto; o que faltar fica vazio). */
export type DraftInput = {
  type?: string;
  title?: string;
  caption?: string;
  hashtags?: string[] | string;
  first_comment?: string;
  production_notes?: string;
  shot_list?: string[];
  scheduled_at?: string;
  due_finish?: string;
  due_deliver?: string;
  music?: string;
  instagram_ref?: string;
  assignee?: string;
};

/** Esquema JSON de um rascunho (o mesmo no MCP e no assistente). */
export const DRAFT_ITEM_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: [...POST_TYPES], description: "reel | post | carousel | story" },
    title: { type: "string", description: "Título interno curto, ex.: \"[WEEK 43 · POST #2] Bastidores do novo menu\"" },
    caption: { type: "string", description: "Legenda final para o Instagram, na voz da marca e na língua do cliente" },
    hashtags: { type: "array", items: { type: "string" }, description: "Sem # (são acrescentados ao fim da legenda); máx. 30 no total" },
    first_comment: { type: "string", description: "Primeiro comentário (opcional)" },
    production_notes: { type: "string", description: "Para a equipa: ideia, gancho dos 3 primeiros segundos, formato, duração, CTA" },
    shot_list: { type: "array", items: { type: "string" }, description: "Planos a gravar, um por item" },
    scheduled_at: { type: "string", description: "Publicação: AAAA-MM-DD HH:mm (hora de Amesterdão) ou ISO; vazio = sem data" },
    due_finish: { type: "string", description: "Prazo para acabar a produção (AAAA-MM-DD)" },
    due_deliver: { type: "string", description: "Prazo para entregar ao cliente (AAAA-MM-DD)" },
    music: { type: "string", description: "Música de referência (nome ou link)" },
    instagram_ref: { type: "string", description: "Link de um conteúdo do Instagram como referência" },
    assignee: { type: "string", description: "Email do responsável na equipa (opcional)" },
  },
  required: ["type", "title"],
  additionalProperties: false,
} as const;

export class DraftError extends Error {}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Minutos de diferença entre o fuso e UTC nesse instante (ex.: +120 no verão de Amesterdão). */
function tzOffsetMin(at: Date, tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** "AAAA-MM-DD HH:mm" (Amesterdão), "AAAA-MM-DD" (10:00) ou ISO com fuso → ISO UTC. Vazio → "". */
export function toScheduledIso(raw: unknown, tz = TZ): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new DraftError(`data inválida: ${s}`);
    return d.toISOString();
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(s);
  if (!m) throw new DraftError(`data inválida: ${s} (use AAAA-MM-DD HH:mm)`);
  const [, y, mo, d, h = "10", mi = "00"] = m;
  const guess = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  return new Date(guess.getTime() - tzOffsetMin(guess, tz) * 60_000).toISOString();
}

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const day = (v: unknown, field: string) => {
  const s = clean(v, 10);
  if (s && !DAY.test(s)) throw new DraftError(`${field} inválido: ${s} (use AAAA-MM-DD)`);
  return s || undefined;
};

/** Legenda + hashtags (sem repetidas, máx. 30). */
function captionWith(caption: string, tags: DraftInput["hashtags"]) {
  const list = (Array.isArray(tags) ? tags : String(tags ?? "").split(/[\s,]+/)).map((t) => String(t).trim().replace(/^#+/, "")).filter(Boolean);
  const already = new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1).toLowerCase()));
  const extra = [...new Set(list.map((t) => t.toLowerCase()))].filter((t) => !already.has(t)).slice(0, Math.max(0, 30 - already.size));
  return extra.length ? `${caption}${caption ? "\n\n" : ""}${extra.map((t) => `#${t}`).join(" ")}` : caption;
}

/** Bloco de produção no fim da legenda (o mesmo formato que a equipa já usa; apagar antes de publicar). */
function productionBlock(d: DraftInput) {
  const notes = clean(d.production_notes, 3000);
  const shots = (Array.isArray(d.shot_list) ? d.shot_list : []).map((s) => clean(s, 300)).filter(Boolean).slice(0, 30);
  if (!notes && !shots.length) return "";
  return ["— PRODUCTION NOTES (remove before publishing) —", notes, shots.length ? `Shot list:\n${shots.map((s) => `• ${s}`).join("\n")}` : ""].filter(Boolean).join("\n");
}

/** Cria os rascunhos (internos, sem ficheiros) para um cliente. Valida tudo antes de devolver. */
export function buildDrafts(customer: Pick<Customer, "id">, items: unknown): ContentPost[] {
  const list = Array.isArray(items) ? (items as DraftInput[]) : [];
  if (!list.length) throw new DraftError("sem rascunhos (drafts vazio)");
  if (list.length > MAX_DRAFTS) throw new DraftError(`demasiados rascunhos (máx. ${MAX_DRAFTS} de cada vez)`);
  return list.map((d, i) => {
    const type = String(d.type ?? "").toLowerCase() as PostType;
    if (!POST_TYPES.includes(type)) throw new DraftError(`rascunho ${i + 1}: tipo "${d.type}" inválido (reel, post, carousel, story)`);
    const title = clean(d.title, 160);
    if (!title) throw new DraftError(`rascunho ${i + 1}: falta o título`);
    const base = captionWith(clean(d.caption, 2200), d.hashtags);
    const prod = productionBlock(d);
    const refs = { ...(d.music ? { music: clean(d.music, 500) } : {}), ...(d.instagram_ref ? { instagram: clean(d.instagram_ref, 500) } : {}) };
    return {
      ...emptyPost(customer.id, type),
      title,
      caption: [base, prod].filter(Boolean).join("\n\n\n"),
      first_comment: clean(d.first_comment, 2200),
      scheduled_at: toScheduledIso(d.scheduled_at),
      due_finish: day(d.due_finish, "due_finish"),
      due_deliver: day(d.due_deliver, "due_deliver"),
      ...(Object.keys(refs).length ? { refs } : {}),
      ...(d.assignee ? { assignee: clean(d.assignee, 200).toLowerCase() } : {}),
      internal: true, // só o estúdio vê até carregar o ficheiro e marcar "Pronto para o cliente"
    };
  });
}

/** Linhas de resumo (confirmação no assistente e resposta do MCP). */
export function draftLines(customerName: string, posts: ContentPost[]) {
  const when = (p: ContentPost) => (p.scheduled_at ? new Date(p.scheduled_at).toLocaleString("pt-PT", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "sem data");
  return [`${customerName}: ${posts.length} rascunho(s) internos, sem ficheiros (prontos para o upload)`, ...posts.slice(0, 20).map((p) => `+ ${p.type} · ${p.title} · ${when(p)}`)];
}

/**
 * Briefing do cliente para escrever rascunhos certos: marca e voz, o que já foi feito (para não repetir),
 * datas já ocupadas e o próximo número de post por semana.
 */
export function customerBrief(c: Customer, posts: ContentPost[], now = new Date()) {
  const b = normalizeBrand(c.brand, c.name);
  const live = posts.filter((p) => !p.deleted_at);
  const recent = [...live].sort((a, z) => (z.scheduled_at || z.phase_since || "").localeCompare(a.scheduled_at || a.phase_since || "")).slice(0, 15);
  const upcoming = live.filter((p) => p.scheduled_at && new Date(p.scheduled_at) >= now).sort((a, z) => a.scheduled_at.localeCompare(z.scheduled_at));
  return {
    customer: { id: c.id, name: c.name, kind: c.kind ?? "company", lang: c.lang, contact: c.contact },
    brand: {
      tagline: b.tagline,
      about: b.about,
      keywords: b.keywords,
      voice: b.voice.map((v) => `${v.title}: ${v.details.join("; ")}`),
      dos: b.dos,
      donts: b.donts,
      persona: Object.values(b.persona).some(Boolean) ? b.persona : undefined,
      imagery: b.imagery.notes || undefined,
    },
    recent_posts: recent.map((p) => ({ type: p.type, title: p.title, status: p.status, scheduled_at: p.scheduled_at || undefined, caption_start: p.caption.split("— PRODUCTION NOTES")[0].trim().slice(0, 160) })),
    busy_slots: upcoming.slice(0, 40).map((p) => ({ at: p.scheduled_at, type: p.type, title: p.title })),
    counts: { total: live.length, drafts: live.filter((p) => p.status === "draft" || p.status === "idea").length, scheduled: upcoming.length },
    timezone: TZ,
  };
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Clientes que correspondem a um texto (id, nome exato, início ou parte do nome/contacto/email), melhores primeiro. */
export function matchCustomers<T extends Pick<Customer, "id" | "name" | "contact" | "email">>(all: T[], query: unknown): T[] {
  const raw = String(query ?? "").trim();
  if (!raw) return all;
  const q = fold(raw);
  const score = (c: T) => {
    const name = fold(c.name);
    if (c.id === raw) return 100;
    if (name === q) return 90;
    if (name.startsWith(q)) return 70;
    if (name.split(/[\s·|\-–—]+/).some((w) => w.startsWith(q))) return 60;
    if (q.length >= 3 && name.includes(q)) return 50;
    if (q.length >= 3 && fold(`${c.contact} ${c.email}`).includes(q)) return 30;
    return 0;
  };
  return all.map((c) => [score(c), c] as const).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).map(([, c]) => c);
}

/** Um só cliente para escrever: o melhor, se for claro; senão erro com os candidatos (a IA pergunta). */
export function pickCustomer<T extends Pick<Customer, "id" | "name" | "contact" | "email">>(all: T[], query: unknown): T {
  const hits = matchCustomers(all, query);
  if (!String(query ?? "").trim() || !hits.length) throw new DraftError(`cliente "${query}" não encontrado — use find_customers`);
  const q = fold(String(query));
  const exact = hits.filter((c) => c.id === query || fold(c.name) === q);
  if (exact.length === 1) return exact[0];
  if (hits.length > 1) throw new DraftError(`"${query}" corresponde a vários clientes: ${hits.slice(0, 6).map((c) => `${c.name} (${c.id})`).join(", ")} — pergunte qual`);
  return hits[0];
}
