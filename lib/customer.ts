// Clientes (Customers) e portal do cliente: fases Marques, marcos, acesso ao portal,
// Instagram, mensalidade da plataforma e conteúdos (reels/posts) com fila e calendário.
// Funções puras (testadas em customer.test.ts).
import type { Lang } from "./i18n";
import type { Appearance } from "./appearance";
import type { BrandIdentity } from "./brand";
import type { ClientProcess } from "./clientProcess";
import type { Task } from "./tasks";
import type { Moodboard } from "./moodboard";
import type { References } from "./references";
import type { CustomerFeedback } from "./feedback";
import type { Media } from "./proposal";

// ---------- fases (Notion: Clients Projects) ----------
export const CSTAGES = ["not_started", "stage0", "stage1", "stage2", "stage3", "stage4", "complete"] as const;
export type CStage = (typeof CSTAGES)[number];
export type WorkStage = Exclude<CStage, "not_started" | "complete">;

export type Milestone = { code: string; title: string; desc: string };

/** Marcos de cada fase, tal como estão no Notion (Client Portal v2). */
export const MILESTONES: Record<WorkStage, Milestone[]> = {
  stage0: [
    { code: "00.1", title: "Kickoff & alinhamento inicial", desc: "Reunião de arranque: objetivos, público, tom e expectativas do ciclo." },
    { code: "00.2", title: "Convite e acesso ao Client Portal confirmado", desc: "O cliente entra no portal, define o código de acesso e liga o Instagram." },
    { code: "00.3", title: "Coleta de assets de marca", desc: "Logótipo, fontes, cores, fotografias e materiais existentes." },
    { code: "00.4", title: "Definir responsáveis e canais de aprovação", desc: "Quem aprova, por onde e em que prazo." },
    { code: "00.5", title: "Estrutura de pastas e links", desc: "Pastas partilhadas, links de entrega e referências organizadas." },
    { code: "00.6", title: "Agendamento de captação do mês", desc: "Data, hora e local da captação confirmados." },
  ],
  stage1: [
    { code: "01.1", title: "Estratégia de conteúdo mensal", desc: "Temas, objetivos e formatos do mês." },
    { code: "01.2", title: "Pesquisa de referências", desc: "Referências visuais e de narrativa alinhadas à marca." },
    { code: "01.3", title: "Análise estética premium", desc: "Luz, enquadramento, cor e ritmo que elevam a perceção da marca." },
    { code: "01.4", title: "Descrição de cenas + roteiro (2 Reels)", desc: "Roteiro e lista de cenas dos dois reels do mês." },
    { code: "01.5", title: "Documento apresentativo da campanha mensal", desc: "Apresentação da campanha para validação." },
    { code: "01.6", title: "Alinhamento com Diretor Criativo", desc: "Revisão interna com a direção criativa." },
    { code: "01.7", title: "Aprovação do cliente", desc: "O cliente aprova estratégia e roteiro." },
    { code: "01.8", title: "Plano de produção", desc: "Equipa, equipamento, horários e logística do dia." },
  ],
  stage2: [
    { code: "02.1", title: "Preparação do dia", desc: "Checklist de equipamento, baterias, cartões e plano de cenas." },
    { code: "02.2", title: "Chegada + setup", desc: "Montagem de luz, som e câmara no local." },
    { code: "02.3", title: "Captação Reel 1", desc: "Captação completa do primeiro reel." },
    { code: "02.4", title: "Captação Reel 2", desc: "Captação completa do segundo reel." },
    { code: "02.5", title: "Sessão de fotografia (carrossel)", desc: "Fotografias para carrosséis e capas." },
    { code: "02.6", title: "QC no local", desc: "Verificação de ficheiros e cobertura antes de sair." },
  ],
  stage3: [
    { code: "03.a", title: "Seleção e organização", desc: "Seleção dos melhores takes e organização do material." },
    { code: "03.b", title: "Edição primeiro corte", desc: "Primeira montagem dos reels." },
    { code: "03.c", title: "Refinamento e corte final", desc: "Ritmo, transições e corte final." },
    { code: "03.d", title: "Color grading e design de áudio", desc: "Cor cinematográfica e mistura de som." },
    { code: "03.e", title: "Controle de qualidade", desc: "Revisão técnica de imagem, som e legendas." },
    { code: "03.f", title: "Seleção e edição de fotografia", desc: "Edição das fotografias selecionadas." },
    { code: "03.g", title: "Capas personalizadas", desc: "Capas dos reels alinhadas com o grid." },
    { code: "03.h", title: "Carrosseis de autoridade (3 slides)", desc: "Carrossel de autoridade com três slides." },
  ],
  stage4: [
    { code: "03.1", title: "Aprovação interna final", desc: "Última revisão interna antes do envio." },
    { code: "03.2", title: "Envio para revisão do cliente", desc: "Conteúdos enviados para aprovação no portal." },
    { code: "03.3", title: "Coleta de feedback", desc: "Feedback do cliente reunido num só sítio." },
    { code: "03.4", title: "Revisões e ajustes", desc: "Até duas rondas de ajustes." },
    { code: "03.5", title: "Entrega final", desc: "Ficheiros finais e calendário de publicação." },
    { code: "03.6", title: "Encerramento do ciclo e arquivamento", desc: "Arquivo do material do mês." },
    { code: "03.8", title: "Reunião de fechamento do mês", desc: "Resultados e próximos passos." },
    { code: "03.9", title: "Formulário de feedback (cliente)", desc: "O cliente avalia o ciclo." },
    { code: "03.10", title: "Documento de métricas (mês 2+)", desc: "Relatório de métricas do Instagram a partir do 2.º mês." },
  ],
};

export const isWorkStage = (s: CStage): s is WorkStage => s !== "not_started" && s !== "complete";

// ---------- modelos ----------
export type PortalStatus = "none" | "invited" | "active" | "disabled";

export type IgMedia = {
  id: string;
  caption: string;
  media_type: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  product: string; // FEED | REELS | STORY
  url: string; // media_url ou thumbnail_url
  permalink: string;
  timestamp: string;
  likes: number;
  comments: number;
  reach?: number;
  views?: number;
  saves?: number;
  shares?: number;
};

export type Instagram = {
  handle: string; // registo rápido (@handle)
  connected: boolean; // ligado pela API (Instagram Login)
  ig_user_id?: string;
  username?: string;
  name?: string;
  account_type?: string;
  picture?: string;
  bio?: string;
  followers?: number;
  follows?: number;
  media_count?: number;
  synced_at?: string;
  period?: { since: string; until: string };
  insights?: Record<string, number>;
  media?: IgMedia[];
  history?: { d: string; followers: number }[];
  error?: string;
};

export type Billing = { company: string; contact: string; address: string; country: string; vat: string; kvk: string; email: string; website?: string; sector?: string; size?: string; phone?: string };

export type Customer = {
  id: string;
  name: string; // projeto/marca (ex.: "Carioca Restaurant")
  contact: string; // pessoa de contacto
  email: string;
  phone: string;
  lang: Lang;
  stage: CStage;
  done: string[]; // códigos de marcos concluídos
  contract_signed: boolean;
  cover: string;
  notes: string;
  instagram: Instagram;
  portal: { status: PortalStatus; invited_at?: string; invite_expires_at?: string; google_email?: string; passcode_set?: boolean; registered_at?: string; last_login_at?: string };
  plan: { active: boolean; price: number | null; since: string; paid_until: string };
  /** Etiquetas livres (ex.: "Imobiliário", "VIP") para filtrar. */
  tags?: string[];
  /** Frequência de trabalho definida à mão (senão é calculada pelos conteúdos — ver lib/clientAccess.ts). */
  frequency?: "recurring" | "one_off" | "none";
  /** Documentos do cliente (contratos, faturas, briefings; assinatura) — ver lib/documents.ts. */
  documents?: import("./documents").Doc[];
  /** Lembrete de acompanhamento (ex.: reenviar convite, ligar ao cliente). */
  reminder?: { at: string; note: string };
  /** Dados de faturação (como aparecem nas invoices). */
  billing?: Billing;
  /** Clientes incluídos na app (criados sem SQL): versão dos dados de origem. */
  bundle_version?: number;
  /** Empresa ou pessoa (cliente particular / marca pessoal). */
  kind?: "company" | "person";
  /** Quando o cliente alterou os dados da empresa no portal (para não serem perdidos por uma cópia antiga). */
  company_updated_at?: string;
  /** Processo de produção deste cliente (etapas, nomes, prazos) — ver lib/clientProcess.ts. */
  process?: ClientProcess;
  /** Identidade visual (preenchida no portal ou pelo estúdio) — ver lib/brand.ts. */
  brand?: BrandIdentity;
  /** Moodboards (imagens, links, notas) — ver lib/moodboard.ts. */
  moodboards?: Moodboard[];
  /** Canal de referências (Instagram, YouTube, TikTok…) por grupos — ver lib/references.ts. */
  references?: References;
  /** Tarefas (to-dos) do cliente e do estúdio, ligadas ou não a conteúdos. */
  tasks?: Task[];
  /** Pedidos de avaliação (feedback) enviados e respostas — escritos pelo servidor. */
  feedback?: CustomerFeedback;
  created_at?: string;
  updated_at?: string;
};

export const POST_TYPES = ["reel", "post", "carousel", "story"] as const;
export type PostType = (typeof POST_TYPES)[number];
export const POST_STATUSES = ["idea", "draft", "review", "approved", "scheduled", "published", "failed"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export type Feedback = { id: string; at: string; by: "client" | "studio"; text: string; action?: "approve" | "changes"; author?: string };

// ---------- utilizadores do portal (várias pessoas por cliente) ----------
export const CUSTOMER_USER_ROLES = ["owner", "member", "viewer"] as const;
/** owner = responsável (aprova, gere Instagram); member = aprova e comenta; viewer = só vê. */
export type CustomerUserRole = (typeof CUSTOMER_USER_ROLES)[number];
export type CustomerUserStatus = "invited" | "active" | "disabled";
export type CustomerUser = {
  id: string;
  customer_id: string;
  email: string;
  name: string;
  role: CustomerUserRole;
  status: CustomerUserStatus;
  passcode_set?: boolean;
  /** Entrou com a conta Google (email validado). */
  email_verified?: boolean;
  invited_at?: string | null;
  invite_expires_at?: string | null;
  registered_at?: string | null;
  last_login_at?: string | null;
  created_at?: string;
};
export const canReview = (role: CustomerUserRole) => role === "owner" || role === "member";
export const canManageInstagram = (role: CustomerUserRole) => role === "owner";

/**
 * Comentário posicionado no material (como no Figma / Frame.io):
 * media = índice do ficheiro (-1 = capa), t = segundo exato do vídeo, x/y = ponto na imagem (0–1).
 * Para o editor é um item da checklist (done). Os do estúdio são internos (o cliente não os vê).
 */
export type Note = {
  id: string;
  by: "client" | "studio";
  author?: string; // nome de quem comentou (cada cliente pode ter várias pessoas)
  text: string;
  media: number;
  t?: number;
  x?: number;
  y?: number;
  round: number;
  done: boolean;
  done_at?: string;
  deleted?: boolean;
  at: string;
  updated: string;
};

export type ContentPost = {
  id: string;
  customer_id: string;
  type: PostType;
  status: PostStatus;
  title: string;
  caption: string;
  first_comment: string;
  cover: string; // imagem da capa (grid)
  media: Media[]; // vídeo do reel, imagem(s) do post/carrossel
  scheduled_at: string; // ISO (UTC) ou ""
  auto: boolean; // publicar automaticamente à hora marcada
  published_at: string;
  ig_media_id: string;
  ig_container_id: string;
  permalink: string;
  error: string;
  feedback: Feedback[];
  notes: Note[];
  round: number; // ronda de revisão do cliente (sobe a cada envio para aprovação)
  blocked: boolean;
  blocked_reason: string;
  phase_since: string; // quando entrou na fase atual do processo (para os prazos)
  /** Etapa do processo do cliente onde o conteúdo foi fixado (ver lib/clientProcess.ts). */
  stage?: string;
  /** Validação do cliente por critério do tipo de conteúdo (ver lib/validation.ts): ok / ajustar. */
  validation?: Record<string, "ok" | "fix">;
  /** Responsável no estúdio (email do membro da equipa). */
  assignee?: string;
  /** Rascunho planeado pelo cliente no portal (título, conceito, capa, data) — fica em Ideias até a equipa produzir. */
  client_draft?: { by: string; at: string };
  /** Referências para a produção: música, um moodboard do cliente e um conteúdo do Instagram. */
  refs?: {
    music?: string;
    moodboard?: string;
    instagram?: string;
    /** Trecho da música a usar (segundos) e dados da faixa (título, artista, duração). */
    music_start?: number;
    music_end?: number;
    music_title?: string;
    music_duration?: number;
  };
  /** Prazos (AAAA-MM-DD): acabar a produção e entregar ao cliente para aprovação. */
  due_finish?: string;
  due_deliver?: string;
  /** Interno: só o estúdio vê; "Pronto para o cliente" (ou enviar para aprovação) mostra-o no portal. */
  internal?: boolean;
  /** No lixo desde (ISO): fica 15 dias para restaurar e depois é apagado de vez. */
  deleted_at?: string;
  /** Rascunho sem cliente marcado como modelo: ao atribuí-lo a um cliente cria-se uma cópia e o modelo fica. */
  template?: boolean;
  created_at?: string;
  updated_at?: string;
};

/** Fases do processo de produção (kanban de conteúdos). Bloqueado é uma marca à parte. */
export const PHASES = ["idea", "editing", "client_review", "changes", "approved", "scheduled", "published"] as const;
export type Phase = (typeof PHASES)[number] | "blocked";
export type ProcessStep = { label: string; days: number };
/** Só o admin vê e configura: dias por fase e regras de prazo. */
export type ProcessSettings = {
  steps: Record<(typeof PHASES)[number], ProcessStep>;
  approval_lead_days: number; // tudo aprovado X dias antes da data de publicação
  warn_days: number; // alerta quando faltam ≤ X dias
  max_rounds: number; // rondas de alterações incluídas
  fps: number; // para mostrar o frame exato dos comentários em vídeo
};
export const DEFAULT_PROCESS: ProcessSettings = {
  steps: {
    idea: { label: "", days: 3 },
    editing: { label: "", days: 5 },
    client_review: { label: "", days: 2 },
    changes: { label: "", days: 2 },
    approved: { label: "", days: 1 },
    scheduled: { label: "", days: 0 },
    published: { label: "", days: 0 },
  },
  approval_lead_days: 2,
  warn_days: 1,
  max_rounds: 2,
  fps: 30,
};

/** Horários de publicação (estilo fila do Buffer): dias 0=Seg … 6=Dom. */
export type Slots = { days: number[]; times: string[] };

export type PortalSettings = {
  price: number; // mensalidade da plataforma (€ / mês)
  currency: "EUR";
  slots: Slots;
  studio_hours: string;
  contact_email: string;
  contact_phone: string;
  delivery_days: number;
  process: ProcessSettings;
  /** Aparência da app (cores, fontes, opções) — ver lib/appearance.ts. */
  appearance?: Appearance;
  /** Estúdio: metas semanais da equipa (ver lib/studio.ts). */
  goals?: import("./studio").Goal[];
  /** Capacidade diária para o planeamento (minutos, margem, dias úteis) — ver lib/plan.ts. */
  plan?: Partial<import("./plan").PlanSettings>;
  /** Rascunhos e modelos sem cliente (Estúdio → "Sem cliente"); customer_id = "". */
  loose_drafts?: ContentPost[];
  /** Automação de responsáveis (criação / mudança de etapa → pessoa). Ver lib/assignRules.ts. */
  assign_rules?: import("./assignRules").AssignRule[];
  /** Horário Pomodoro (início, refeições, horas) e planos do dia guardados por pessoa ("email:AAAA-MM-DD"). */
  schedule?: Partial<import("./schedule").ScheduleSettings>;
  day_plans?: Record<string, import("./schedule").DaySchedule & { notes?: string; tips?: string[]; source?: "ai" | "rules"; at: string; person: string }>;
  /** Documentos internos da empresa (e modelos de assinatura). */
  documents?: import("./documents").Doc[];
  /** Tarefas internas da empresa (não ligadas a um cliente). */
  tasks?: Task[];
};

export const DEFAULT_SETTINGS: PortalSettings = {
  price: 12,
  currency: "EUR",
  slots: { days: [1, 3, 4], times: ["12:00", "18:30"] },
  studio_hours: "Seg – Sex · 08:00 – 16:00 (GMT)",
  contact_email: "contact@mediamarques.com",
  contact_phone: "+31 6 84066378",
  delivery_days: 15,
  process: DEFAULT_PROCESS,
};

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function emptyCustomer(name = ""): Customer {
  return {
    id: uid(),
    name,
    contact: "",
    email: "",
    phone: "",
    lang: "pt",
    stage: "not_started",
    done: [],
    contract_signed: false,
    cover: "",
    notes: "",
    instagram: { handle: "", connected: false },
    portal: { status: "none" },
    plan: { active: true, price: null, since: "", paid_until: "" },
  };
}

export function normalizeCustomer(x: Partial<Customer> & { id?: string }): Customer {
  const e = emptyCustomer();
  const ig = (x.instagram ?? {}) as Partial<Instagram>;
  return {
    ...e,
    ...x,
    id: x.id || e.id,
    name: str(x.name),
    stage: CSTAGES.includes(x.stage as CStage) ? (x.stage as CStage) : "not_started",
    lang: x.lang === "en" || x.lang === "nl" ? x.lang : "pt",
    done: Array.isArray(x.done) ? x.done.filter((c) => typeof c === "string") : [],
    instagram: { ...e.instagram, ...ig, handle: cleanHandle(str(ig.handle)), connected: !!ig.connected },
    portal: { ...e.portal, ...(x.portal ?? {}) },
    plan: { ...e.plan, ...(x.plan ?? {}), price: num(x.plan?.price) ?? null },
  };
}

// ---------- capa: regra do Instagram ----------
/** Só os Reels têm capa própria (cover_url). Carrossel: a capa é o 1.º slide; post: a própria imagem; story: sem capa. */
export const hasCover = (type: PostType) => type === "reel";
/** Miniatura do conteúdo (grelha, cartões, listas). */
export function thumbOf(p: Pick<ContentPost, "type" | "cover" | "media">): string {
  if (hasCover(p.type)) return p.cover || p.media.find((m) => m.kind === "image")?.src || "";
  const first = p.media[0];
  // como no Instagram: o 1.º slide é a capa; se for vídeo, quem mostra usa o frame do vídeo (devolve "")
  if (first?.kind === "video") return "";
  return (first?.kind === "image" ? first.src : p.media.find((m) => m.kind === "image")?.src) || p.cover || "";
}
/**
 * Aplica a regra ao gravar: fora dos reels o campo "capa" fica vazio. Se ainda não houver ficheiros, a imagem
 * passa a ser o 1.º ficheiro (com os comentários que tinha). Se já houver ficheiros e alguém comentou na capa,
 * mantém-na para não perder esses comentários.
 */
export function applyCoverRule<T extends Pick<ContentPost, "type" | "cover" | "media" | "notes">>(p: T): T {
  // reel sem vídeo e só com uma imagem (ex.: rascunho que mudou para reel): essa imagem é a capa
  if (hasCover(p.type)) {
    if (p.cover || p.media.length !== 1 || p.media[0].kind !== "image") return p;
    return { ...p, cover: p.media[0].src, media: [], notes: p.notes.map((n) => (n.media === 0 ? { ...n, media: -1 } : n)) };
  }
  if (!p.cover) return p;
  if (p.media.some((m) => m.src === p.cover)) return { ...p, cover: "" };
  if (!p.media.length) return { ...p, cover: "", media: [{ src: p.cover, kind: "image" as const }], notes: p.notes.map((n) => (n.media === -1 ? { ...n, media: 0 } : n)) };
  if (p.notes.some((n) => n.media === -1 && !n.deleted)) return p;
  return { ...p, cover: "" };
}

export function emptyPost(customer_id: string, type: PostType = "reel"): ContentPost {
  return {
    id: uid(),
    customer_id,
    type,
    status: "draft",
    title: "",
    caption: "",
    first_comment: "",
    cover: "",
    media: [],
    scheduled_at: "",
    auto: true,
    published_at: "",
    ig_media_id: "",
    ig_container_id: "",
    permalink: "",
    error: "",
    feedback: [],
    notes: [],
    round: 0,
    blocked: false,
    blocked_reason: "",
    phase_since: new Date().toISOString(),
  };
}

export function normalizePost(x: Partial<ContentPost> & { customer_id: string }): ContentPost {
  const e = emptyPost(x.customer_id);
  return {
    ...e,
    ...x,
    id: x.id || e.id,
    type: POST_TYPES.includes(x.type as PostType) ? (x.type as PostType) : "post",
    status: POST_STATUSES.includes(x.status as PostStatus) ? (x.status as PostStatus) : "draft",
    media: Array.isArray(x.media) ? x.media.filter((m) => m && typeof m.src === "string") : [],
    feedback: Array.isArray(x.feedback) ? x.feedback : [],
    notes: Array.isArray(x.notes) ? x.notes.filter((n) => n && typeof n.id === "string") : [],
    round: typeof x.round === "number" ? x.round : 0,
    blocked: !!x.blocked,
    phase_since: x.phase_since || x.updated_at || x.created_at || e.phase_since,
    auto: x.auto !== false,
  };
}

export const normalizeSettings = (x?: Partial<PortalSettings> | null): PortalSettings => ({
  ...DEFAULT_SETTINGS,
  ...(x ?? {}),
  price: Math.max(0, num(x?.price) ?? DEFAULT_SETTINGS.price),
  slots: {
    days: Array.isArray(x?.slots?.days) ? x!.slots!.days.filter((d) => d >= 0 && d <= 6) : DEFAULT_SETTINGS.slots.days,
    times: Array.isArray(x?.slots?.times) ? x!.slots!.times.filter((t) => /^\d{2}:\d{2}$/.test(t)).sort() : DEFAULT_SETTINGS.slots.times,
  },
  process: normalizeProcess(x?.process),
});

export function normalizeProcess(x?: Partial<ProcessSettings> | null): ProcessSettings {
  const d = DEFAULT_PROCESS;
  const n = (v: unknown, def: number, min = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.round(v)) : def);
  const steps = Object.fromEntries(
    PHASES.map((k) => {
      const s = (x?.steps as Partial<Record<string, Partial<ProcessStep>>> | undefined)?.[k];
      return [k, { label: typeof s?.label === "string" ? s.label : "", days: n(s?.days, d.steps[k].days) }];
    })
  ) as ProcessSettings["steps"];
  return {
    steps,
    approval_lead_days: n(x?.approval_lead_days, d.approval_lead_days),
    warn_days: n(x?.warn_days, d.warn_days),
    max_rounds: n(x?.max_rounds, d.max_rounds, 1),
    fps: n(x?.fps, d.fps, 1),
  };
}

export const cleanHandle = (h: string) =>
  h
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
export const validHandle = (h: string) => /^[a-z0-9._]{1,30}$/.test(h) && !h.includes("..") && !h.endsWith(".");

// ---------- código do portal (4 a 6 dígitos) ----------
export const validPasscode = (p: string) => /^\d{4,6}$/.test(p);

/** Fraco: todos iguais (1111) ou sequência (1234, 6543). Avisa, não bloqueia. */
export function weakPasscode(p: string) {
  if (!validPasscode(p)) return true;
  if (/^(\d)\1+$/.test(p)) return true;
  const d = [...p].map(Number);
  const step = d[1] - d[0];
  return Math.abs(step) === 1 && d.every((x, i) => i === 0 || x - d[i - 1] === step);
}

// ---------- fases e progresso ----------
export function stageProgress(c: Pick<Customer, "stage" | "done">) {
  if (c.stage === "complete") return { done: 1, total: 1, pct: 100 };
  if (!isWorkStage(c.stage)) return { done: 0, total: 0, pct: 0 };
  const list = MILESTONES[c.stage];
  const done = list.filter((m) => c.done.includes(m.code)).length;
  return { done, total: list.length, pct: Math.round((done / list.length) * 100) };
}

/** Fase seguinte quando todos os marcos estão feitos. */
export const nextStage = (s: CStage): CStage => CSTAGES[Math.min(CSTAGES.indexOf(s) + 1, CSTAGES.length - 1)];

/** Jornada do portal (Notion "Nossa Jornada"): 4 fases ↔ stage1…stage4. */
export const JOURNEY: WorkStage[] = ["stage1", "stage2", "stage3", "stage4"];
export function journeyState(stage: CStage, phase: WorkStage): "done" | "now" | "next" {
  const i = CSTAGES.indexOf(stage);
  const j = CSTAGES.indexOf(phase);
  return i > j ? "done" : i === j ? "now" : "next";
}

// ---------- mensalidade ----------
export const monthlyFee = (c: Customer, s: PortalSettings) => (c.plan.active ? c.plan.price ?? s.price : 0);
export const mrr = (list: Customer[], s: PortalSettings) => list.filter((c) => c.portal.status !== "disabled").reduce((a, c) => a + monthlyFee(c, s), 0);
export function planState(c: Customer, today: string): "inactive" | "paid" | "due" {
  if (!c.plan.active) return "inactive";
  return c.plan.paid_until && c.plan.paid_until >= today ? "paid" : "due";
}

/** Marca um mês pago: estende "pago até" um mês a partir do maior entre hoje e o valor atual. */
export function addPaidMonth(paidUntil: string, today: string) {
  const base = paidUntil && paidUntil > today ? paidUntil : today;
  const d = new Date(base + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------- conteúdos: fila, calendário, grid ----------
const dayIdx = (d: Date) => (d.getDay() + 6) % 7; // 0 = segunda
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Próximos horários livres da fila (como "Add to Queue" do Buffer), na hora local. */
export function nextSlots(slots: Slots, taken: string[], from: Date, n = 1): string[] {
  const out: string[] = [];
  if (!slots.days.length || !slots.times.length) return out;
  const busy = new Set(taken.filter(Boolean).map((t) => new Date(t).getTime()));
  const d = new Date(from);
  for (let i = 0; i < 400 && out.length < n; i++) {
    if (slots.days.includes(dayIdx(d)))
      for (const t of [...slots.times].sort()) {
        const [h, m] = t.split(":").map(Number);
        const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
        if (at > from && !busy.has(at.getTime())) {
          out.push(at.toISOString());
          busy.add(at.getTime());
          if (out.length >= n) break;
        }
      }
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
  }
  return out;
}

/** Posts por dia (yyyy-mm-dd na hora local) — publicado usa published_at, os outros scheduled_at. */
export function postsByDay(posts: ContentPost[]) {
  const m = new Map<string, ContentPost[]>();
  for (const p of posts) {
    const when = p.status === "published" ? p.published_at || p.scheduled_at : p.scheduled_at;
    if (!when) continue;
    const k = localDay(new Date(when));
    m.set(k, [...(m.get(k) ?? []), p].sort((a, b) => (a.scheduled_at || "").localeCompare(b.scheduled_at || "")));
  }
  return m;
}

/** Semanas (seg→dom) do mês "yyyy-mm" para o calendário. */
export function monthGrid(month: string): string[][] {
  const [y, mo] = month.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const start = new Date(first);
  start.setDate(1 - dayIdx(first));
  const weeks: string[][] = [];
  const d = new Date(start);
  do {
    const w: string[] = [];
    for (let i = 0; i < 7; i++) {
      w.push(localDay(d));
      d.setDate(d.getDate() + 1);
    }
    weeks.push(w);
  } while (d.getMonth() === mo - 1);
  return weeks;
}

export type GridItem = { key: string; cover: string; type: PostType | "ig"; planned: boolean; when: string; post?: ContentPost; ig?: IgMedia };

/**
 * Pré-visualização do grid do Instagram: planeados (sem stories) no topo, do mais tarde para o mais cedo,
 * seguidos dos já publicados (posts da app e media sincronizada do Instagram, sem duplicar).
 */
export function gridItems(posts: ContentPost[], ig: IgMedia[] = []): GridItem[] {
  const feed = posts.filter((p) => p.type !== "story" && p.status !== "failed");
  const planned = feed
    .filter((p) => p.status !== "published")
    .sort((a, b) => (b.scheduled_at || "9999").localeCompare(a.scheduled_at || "9999"))
    .map((p) => ({ key: p.id, cover: thumbOf(p), type: p.type, planned: true, when: p.scheduled_at, post: p }));
  const pubIds = new Set(feed.map((p) => p.ig_media_id).filter(Boolean));
  const published: GridItem[] = [
    ...feed.filter((p) => p.status === "published").map((p) => ({ key: p.id, cover: thumbOf(p), type: p.type, planned: false, when: p.published_at || p.scheduled_at, post: p })),
    ...ig.filter((m) => m.product !== "STORY" && !pubIds.has(m.id)).map((m) => ({ key: m.id, cover: m.url, type: "ig" as const, planned: false, when: m.timestamp, ig: m })),
  ].sort((a, b) => b.when.localeCompare(a.when));
  return [...planned, ...published];
}

/** Posts a publicar agora pelo agendador (automático, aprovados/agendados, hora passada). */
export const duePosts = (posts: ContentPost[], now: Date) =>
  posts.filter((p) => p.auto && p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at) <= now);

/** Ação do cliente no portal: aprovar (→ agendado se tiver data, senão aprovado) ou pedir alterações (→ rascunho). */
export function clientReview(p: ContentPost, action: "approve" | "changes", text: string, at = new Date().toISOString(), author?: string): ContentPost {
  if (p.status !== "review") throw new Error("not_in_review");
  if (action === "changes" && !text.trim() && !openNotes(p).some((n) => n.by === "client")) throw new Error("text_required");
  const note: Feedback = { id: uid(), at, by: "client", text: text.trim(), action, ...(author ? { author } : {}) };
  return { ...p, status: action === "approve" ? (p.scheduled_at ? "scheduled" : "approved") : "draft", feedback: [...p.feedback, note], phase_since: at };
}

// ---------- comentários no material (checklist do editor) ----------
export const liveNotes = (p: Pick<ContentPost, "notes">) => p.notes.filter((n) => !n.deleted);
export const openNotes = (p: Pick<ContentPost, "notes">) => liveNotes(p).filter((n) => !n.done);

export function addNote(p: ContentPost, n: Pick<Note, "by" | "text" | "media" | "t" | "x" | "y" | "author">, at = new Date().toISOString()): ContentPost {
  if (!n.text.trim()) throw new Error("text_required");
  const clamp = (v?: number) => (typeof v === "number" ? Math.min(1, Math.max(0, v)) : undefined);
  const note: Note = {
    id: uid(),
    by: n.by,
    ...(n.author ? { author: n.author.slice(0, 80) } : {}),
    text: n.text.trim().slice(0, 2000),
    media: Math.max(-1, Math.floor(n.media)),
    t: typeof n.t === "number" && n.t >= 0 ? Math.round(n.t * 1000) / 1000 : undefined,
    x: clamp(n.x),
    y: clamp(n.y),
    round: p.round,
    done: false,
    at,
    updated: at,
  };
  return { ...p, notes: [...p.notes, note] };
}

export type NoteMove = { media: number; x?: number; y?: number };
/** Posição válida para mover um comentário: ficheiro existente (-1 = capa) e ponto dentro da imagem (0–1). */
export function cleanMove(p: Pick<ContentPost, "media" | "cover">, m: NoteMove): NoteMove | null {
  const media = Math.trunc(Number(m.media));
  if (!(media === -1 ? !!p.cover : media >= 0 && media < p.media.length)) return null;
  const clamp = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : undefined);
  return { media, x: clamp(m.x), y: clamp(m.y) };
}
export function patchNote(p: ContentPost, id: string, patch: Partial<Pick<Note, "done" | "deleted" | "text" | "media" | "x" | "y">>, at = new Date().toISOString()): ContentPost {
  return {
    ...p,
    notes: p.notes.map((n) => (n.id === id ? { ...n, ...patch, ...(patch.done !== undefined ? { done_at: patch.done ? at : undefined } : {}), updated: at } : n)),
  };
}

/** Junta as notas de duas cópias (admin e cliente): por id, ganha a alteração mais recente. */
export function mergeNotes(a: Note[], b: Note[]): Note[] {
  const m = new Map<string, Note>();
  for (const n of [...a, ...b]) {
    const cur = m.get(n.id);
    if (!cur || n.updated > cur.updated) m.set(n.id, n);
  }
  return [...m.values()].sort((x, y) => x.at.localeCompare(y.at));
}

/** 00:03:12 · f96 — tempo do vídeo e frame (ao fps configurado). */
export function timecode(t: number, fps = 30) {
  const s = Math.floor(t);
  const f = Math.round((t - s) * fps);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return { tc: `${mm}:${ss}:${String(Math.min(f, fps - 1)).padStart(2, "0")}`, frame: Math.round(t * fps) };
}

// ---------- processo de produção, prazos ----------
/** Fase do kanban a partir do estado do post. */
export function phaseOf(p: Pick<ContentPost, "status" | "blocked" | "notes" | "feedback">): Phase {
  if (p.blocked || p.status === "failed") return "blocked";
  switch (p.status) {
    case "idea":
      return "idea";
    case "review":
      return "client_review";
    case "approved":
      return "approved";
    case "scheduled":
      return "scheduled";
    case "published":
      return "published";
    default: {
      const asked = p.feedback.at(-1)?.action === "changes" || openNotes(p).some((n) => n.by === "client");
      return asked ? "changes" : "editing";
    }
  }
}

/** Estado a aplicar quando o cartão é arrastado para uma fase. */
export function moveToPhase(p: ContentPost, phase: Phase, at = new Date().toISOString()): ContentPost {
  if (phase === "blocked") return { ...p, blocked: true, phase_since: at };
  const status: PostStatus =
    phase === "idea" ? "idea" : phase === "client_review" ? "review" : phase === "approved" ? "approved" : phase === "scheduled" ? (p.scheduled_at ? "scheduled" : "approved") : phase === "published" ? "published" : "draft";
  const next = { ...p, status, blocked: false, phase_since: at, round: phase === "client_review" && p.status !== "review" ? p.round + 1 : p.round };
  // a partir da aprovação do cliente o conteúdo deixa de ser interno
  if (["client_review", "approved", "scheduled", "published"].includes(phase)) next.internal = false;
  return phase === "published" && !p.published_at ? { ...next, published_at: at } : next;
}

/** Atualiza phase_since quando a fase muda (ao gravar). */
export function touchPhase(prev: ContentPost | null, next: ContentPost, at = new Date().toISOString()): ContentPost {
  if (!prev) return { ...next, phase_since: next.phase_since || at };
  return phaseOf(prev) !== phaseOf(next) && prev.phase_since === next.phase_since ? { ...next, phase_since: at } : next;
}

export type Deadline = { due: string; daysLeft: number; state: "ok" | "warn" | "late" | "none"; reason: "step" | "publish" | "finish" | "deliver" | "none" };
/** Fim do dia (18:00 local) de uma data AAAA-MM-DD. */
const endOf = (d: string) => new Date(`${d}T18:00:00`).getTime();
const DAY = 86_400_000;

/**
 * Prazo do conteúdo: o mais apertado entre (a) fim da fase atual (entrada na fase + dias configurados) e
 * (b) data de publicação − dias de antecedência para estar aprovado (só antes de aprovado).
 */
export function deadline(p: ContentPost, proc: ProcessSettings, now = new Date()): Deadline {
  const ph = phaseOf(p);
  if (ph === "published" || ph === "scheduled") return { due: "", daysLeft: 0, state: "none", reason: "none" };
  const cands: { t: number; reason: Deadline["reason"] }[] = [];
  const step = ph === "blocked" ? null : proc.steps[ph];
  if (step && step.days > 0 && p.phase_since) cands.push({ t: new Date(p.phase_since).getTime() + step.days * DAY, reason: "step" });
  if (p.scheduled_at && ph !== "approved") cands.push({ t: new Date(p.scheduled_at).getTime() - proc.approval_lead_days * DAY, reason: "publish" });
  if (p.scheduled_at && ph === "approved") cands.push({ t: new Date(p.scheduled_at).getTime(), reason: "publish" });
  // prazos definidos à mão: acabar a produção (até ao envio) e entregar ao cliente (até ser aprovado)
  if (p.due_finish && ["idea", "editing", "changes", "blocked"].includes(ph)) cands.push({ t: endOf(p.due_finish), reason: "finish" });
  if (p.due_deliver && ["idea", "editing", "changes", "blocked"].includes(ph)) cands.push({ t: endOf(p.due_deliver), reason: "deliver" });
  if (!cands.length) return { due: "", daysLeft: 0, state: "none", reason: "none" };
  const c = cands.reduce((a, b) => (b.t < a.t ? b : a));
  const daysLeft = Math.ceil((c.t - now.getTime()) / DAY);
  return { due: new Date(c.t).toISOString(), daysLeft, state: c.t < now.getTime() ? "late" : daysLeft <= proc.warn_days ? "warn" : "ok", reason: c.reason };
}

export const CAPTION_MAX = 2200;
export const HASHTAG_MAX = 30;
export const hashtags = (s: string) => (s.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;

// ---------- Instagram API (Instagram Login) ----------
export const IG_SCOPES = ["instagram_business_basic", "instagram_business_manage_insights", "instagram_business_content_publish", "instagram_business_manage_comments"];
export const IG_METRICS = ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments", "shares", "saves", "follows_and_unfollows", "profile_links_taps"];

export function igAuthorizeUrl(o: { appId: string; redirectUri: string; state: string }) {
  const q = new URLSearchParams({ client_id: o.appId, redirect_uri: o.redirectUri, response_type: "code", scope: IG_SCOPES.join(","), state: o.state, enable_fb_login: "false" });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

/** Resposta de /insights (metric_type=total_value) → { reach: 1234, … }. */
export function parseInsights(json: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const data = (json as { data?: unknown[] })?.data;
  if (!Array.isArray(data)) return out;
  for (const m of data as { name?: string; total_value?: { value?: number }; values?: { value?: number }[] }[]) {
    if (!m.name) continue;
    const v = m.total_value?.value ?? m.values?.reduce((a, x) => a + (typeof x.value === "number" ? x.value : 0), 0);
    if (typeof v === "number") out[m.name] = v;
  }
  return out;
}

export const engagementRate = (ig: Instagram) => {
  const reach = ig.insights?.reach;
  const inter = ig.insights?.total_interactions;
  return reach && inter !== undefined ? Math.round((inter / reach) * 1000) / 10 : null;
};

// ---------- clientes do Notion (Clients Projects) ----------
export function seedCustomers(): Customer[] {
  // [nome, email, fase, contrato assinado, contacto] — o convite do portal XMEDIA é gerado aqui (os do Notion não servem)
  const rows: [string, string, CStage, boolean, string][] = [
    ["Luuk Melisse | Personal Brand", "luuk@wearesanctum.com", "stage1", false, "Luuk Melisse"],
    ["Schilders Bedrijf Bueno", "buenoonderhoudnl@outlook.com", "stage1", true, ""],
    ["Carioca Restaurant", "management@cariocarestaurant.nl", "stage3", true, ""],
    ["WHY NOT FLY", "contato@whynotfly.com.br", "stage2", true, ""],
    ["Carine Hair Salon", "carinelopeshairstudio@gmail.com", "complete", true, "Carine Lopes"],
    ["E-bikes ecosystem", "wjebikes@gmail.com", "not_started", true, ""],
  ];
  return rows.map(([name, email, stage, contract, contact]) => {
    const c = emptyCustomer(name);
    const before = CSTAGES.slice(1, CSTAGES.indexOf(stage)).filter(isWorkStage);
    return {
      ...c,
      email,
      contact,
      stage,
      contract_signed: contract,
      lang: email.endsWith(".nl") ? "nl" : "pt",
      done: before.flatMap((s) => MILESTONES[s].map((m) => m.code)),
    };
  });
}

/** O cliente vê tudo menos as ideias internas do estúdio (os rascunhos dele próprio vê). */
export const visibleToClient = (p: Pick<ContentPost, "status" | "client_draft" | "internal" | "deleted_at">) => !p.deleted_at && !p.internal && (p.status !== "idea" || !!p.client_draft);

// ---------- rascunhos sem cliente ----------
export const LOOSE = ""; // customer_id dos rascunhos sem cliente
/**
 * Atribuir um rascunho sem cliente a um cliente: vira um conteúdo do cliente (interno, em rascunho).
 * Se for modelo, é uma cópia nova (id e comentários novos) e o modelo continua na lista.
 */
export function assignLoose(d: ContentPost, customerId: string): { post: ContentPost; keep: boolean } {
  const keep = !!d.template;
  const base = keep ? { ...d, id: uid(), notes: [], feedback: [], round: 0 } : d;
  const { template: _t, ...rest } = base;
  return { post: { ...rest, customer_id: customerId, internal: true, phase_since: new Date().toISOString() }, keep };
}

// ---------- lixo (soft delete) ----------
export const BIN_DAYS = 15;
export const isTrashed = (p: Pick<ContentPost, "deleted_at">) => !!p.deleted_at;
/** Já passou o prazo do lixo (apagar de vez). */
export const binExpired = (p: Pick<ContentPost, "deleted_at">, now = new Date()) => !!p.deleted_at && now.getTime() - new Date(p.deleted_at).getTime() > BIN_DAYS * 86_400_000;
/** Dias que faltam até ser apagado de vez. */
export const binDaysLeft = (p: Pick<ContentPost, "deleted_at">, now = new Date()) => (p.deleted_at ? Math.max(0, Math.ceil((new Date(p.deleted_at).getTime() + BIN_DAYS * 86_400_000 - now.getTime()) / 86_400_000)) : BIN_DAYS);
/**
 * Conteúdo vazio (sem ficheiros, legenda, comentários, feedback nem referências): apaga-se de vez sem perguntar.
 * Com alguma coisa dentro vai para o lixo, depois de confirmar.
 */
export const isEmptyPost = (p: ContentPost) =>
  !p.media.length && !p.cover && !p.caption.trim() && !p.first_comment.trim() && !p.notes.some((n) => !n.deleted) && !p.feedback.length && !p.refs?.music && !p.refs?.moodboard && !p.refs?.instagram;
export type ClientDraftInput = { id?: string; type: PostType; title: string; caption: string; cover?: string; scheduled_at?: string; refs?: ContentPost["refs"] };
const httpsUrl = (v?: string) => (v && /^https:\/\/\S+$/.test(v.trim()) ? v.trim().slice(0, 500) : undefined);
/** Referências limpas (só https; o moodboard é o id de um quadro do cliente). */
export function cleanRefs(r?: ContentPost["refs"]): ContentPost["refs"] | undefined {
  if (!r) return undefined;
  const sec = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 36000 ? Math.round(v) : undefined);
  const music = httpsUrl(r.music);
  let start = music ? sec(r.music_start) : undefined;
  let end = music ? sec(r.music_end) : undefined;
  if (start !== undefined && end !== undefined && end <= start) end = undefined;
  if (start === undefined && end !== undefined) start = 0;
  const out = {
    music,
    instagram: httpsUrl(r.instagram),
    moodboard: r.moodboard ? String(r.moodboard).slice(0, 64) : undefined,
    ...(music && start !== undefined ? { music_start: start } : {}),
    ...(music && end !== undefined ? { music_end: end } : {}),
    ...(music && r.music_title ? { music_title: String(r.music_title).slice(0, 200) } : {}),
    ...(music && sec(r.music_duration) ? { music_duration: sec(r.music_duration) } : {}),
  };
  return out.music || out.instagram || out.moodboard ? out : undefined;
}
/** Cria/atualiza um rascunho do cliente (só enquanto continuar a ser ideia dele). */
export function clientDraft(cur: ContentPost | null, customerId: string, d: ClientDraftInput, by: string): ContentPost {
  if (cur && (cur.status !== "idea" || !cur.client_draft)) throw new Error("not_a_draft");
  const base = cur ?? { ...emptyPost(customerId, d.type), status: "idea" as const, client_draft: { by, at: new Date().toISOString() } };
  return applyCoverRule({
    ...base,
    type: POST_TYPES.includes(d.type) ? d.type : base.type,
    title: String(d.title ?? "").slice(0, 160),
    caption: String(d.caption ?? "").slice(0, 2200),
    // imagem do rascunho: capa num reel; nos outros tipos é o próprio ficheiro (o rascunho só tem essa imagem)
    ...(d.cover === undefined
      ? {}
      : hasCover(POST_TYPES.includes(d.type) ? d.type : base.type)
        ? { cover: String(d.cover).slice(0, 1000), media: base.media.filter((m) => m.kind === "video") }
        : { cover: "", media: d.cover ? [{ src: String(d.cover).slice(0, 1000), kind: "image" as const }] : [] }),
    scheduled_at: d.scheduled_at ? new Date(d.scheduled_at).toISOString() : "",
    auto: false,
    ...(d.refs !== undefined ? { refs: cleanRefs(d.refs) } : {}),
  });
}
