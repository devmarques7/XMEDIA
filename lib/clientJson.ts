// Importação de dados de um cliente num só JSON (portal, admin e MCP): client, kind, billing, process, brand,
// tasks e posts — só as partes presentes são alteradas. Funções puras (testadas em clientJson.test.ts).
import { normalizeBrand } from "./brand";
import { normalizeProcessDef } from "./clientProcess";
import { CSTAGES, normalizePost, type Billing, type ContentPost, type Customer } from "./customer";
import { mergeTasks, normalizeTask, type Task } from "./tasks";

export const CLIENT_JSON_EXAMPLE = JSON.stringify(
  {
    client: { name: "Carioca Restaurant", contact: "Mavi", email: "management@cariocarestaurant.nl", phone: "+31 6 0000 0000", lang: "pt", stage: "stage1" },
    kind: "company",
    billing: { company: "Carioca Restaurant B.V.", kvk: "00000000", vat: "NL000000000B01", address: "Rua …\n1000 AA Amsterdam", country: "NL", website: "https://…", sector: "Restaurante" },
    process: { groups: ["Produção", "Aprovação", "Entrega"], stages: [{ label: "Rascunhos", group: "Produção", days: 5, phases: ["idea", "editing"] }, { label: "Preview", group: "Aprovação", days: 2, phases: ["client_review"], client: true }] },
    brand: { name: "Carioca", tagline: "Sabor do Rio em Amsterdam", colors: [{ name: "Brasa", hex: "#ff5a1f", role: "primary" }], fonts: { primary: { family: "Syne" } } },
    tasks: [{ title: "Enviar menu de outono", due: "2026-10-30" }],
    posts: [{ type: "reel", status: "draft", title: "Bastidores da cozinha", scheduled_at: "2026-10-28T18:30:00Z" }],
  },
  null,
  2
);

/** Aplica um JSON de cliente (só as partes presentes). Devolve o cliente atualizado, os posts novos e o que mudou. */
export function applyClientJson(c: Customer, text: string, by: string): { customer: Customer; posts: ContentPost[]; parts: string[] } {
  const o = JSON.parse(text) as Record<string, unknown>;
  const parts: string[] = [];
  let next: Customer = { ...c };
  const cl = o.client as Partial<Customer> | undefined;
  if (cl && typeof cl === "object") {
    const pick = Object.fromEntries((["name", "contact", "email", "phone"] as const).filter((k) => typeof cl[k] === "string").map((k) => [k, String(cl[k]).slice(0, 200)]));
    next = { ...next, ...pick, ...(cl.lang === "pt" || cl.lang === "en" || cl.lang === "nl" ? { lang: cl.lang } : {}), ...(CSTAGES.includes(cl.stage as never) ? { stage: cl.stage! } : {}) };
    parts.push("client");
  }
  if (o.kind === "company" || o.kind === "person") (next.kind = o.kind), parts.push("kind");
  if (o.billing && typeof o.billing === "object") {
    next.billing = { ...(next.billing ?? { company: "", contact: "", address: "", country: "NL", vat: "", kvk: "", email: "" }), ...(Object.fromEntries(Object.entries(o.billing).map(([k, v]) => [k, String(v ?? "").slice(0, 300)])) as Partial<Billing>) };
    parts.push("billing");
  }
  if (o.process) (next.process = normalizeProcessDef(o.process)), parts.push("process");
  if (o.brand) (next.brand = { ...normalizeBrand({ ...(next.brand ?? {}), ...(o.brand as object) }, next.name), updated_at: new Date().toISOString() }), parts.push("brand");
  if (Array.isArray(o.tasks)) {
    const now = new Date().toISOString();
    const tasks = o.tasks.map((x) => normalizeTask({ id: crypto.randomUUID(), by, side: "studio", at: now, updated: now, ...(x as Partial<Task>) })).filter((x): x is Task => !!x);
    next.tasks = mergeTasks(next.tasks, tasks);
    parts.push(`tasks (${tasks.length})`);
  }
  const posts = Array.isArray(o.posts) ? o.posts.map((x) => normalizePost({ ...(x as Partial<ContentPost>), id: crypto.randomUUID(), customer_id: c.id })) : [];
  if (posts.length) parts.push(`posts (${posts.length})`);
  return { customer: next, posts, parts };
}

