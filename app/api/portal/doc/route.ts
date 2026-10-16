import { normalizeBrand } from "@/lib/brand";
import { mergeBoards, normalizeBoards } from "@/lib/moodboard";
import { mergeRefs, normalizeRefs } from "@/lib/references";
import type { Billing } from "@/lib/customer";
import { HttpError, fail } from "@/lib/server/admin";
import { patchCustomer, requireCustomer } from "@/lib/server/portal";
import { clientTasks, mergeTasks, normalizeTask, type Task } from "@/lib/tasks";

type Body =
  | { type: "brand"; brand: unknown }
  | { type: "company"; kind: "company" | "person"; billing: Partial<Billing> }
  | { type: "tasks"; tasks: Partial<Task>[] }
  | { type: "moodboards"; boards: unknown }
  | { type: "references"; references: unknown };

const FIELDS: (keyof Billing)[] = ["company", "contact", "address", "country", "vat", "kvk", "email", "website", "sector", "size", "phone"];

/**
 * O cliente grava no portal: identidade visual e tarefas (responsável e editores) e dados da empresa (responsável).
 * O id do cliente vem sempre da sessão. Devolve a parte atualizada.
 */
export async function POST(req: Request) {
  try {
    const { customer, user } = await requireCustomer();
    if (user.role === "viewer") throw new HttpError(403, "read_only");
    const b = (await req.json()) as Body;
    const now = new Date().toISOString();
    if (b.type === "brand") {
      const brand = { ...normalizeBrand(b.brand, customer.name), updated_at: now };
      await patchCustomer(customer.id, (c) => ({ ...c, brand }));
      return Response.json({ brand });
    }
    if (b.type === "company") {
      if (user.role !== "owner") throw new HttpError(403, "owner_only");
      const src = (b.billing ?? {}) as Record<string, unknown>;
      const next = await patchCustomer(customer.id, (c) => ({
        ...c,
        kind: b.kind === "person" ? "person" : "company",
        company_updated_at: now,
        billing: { ...(c.billing ?? { company: "", contact: "", address: "", country: "NL", vat: "", kvk: "", email: "" }), ...Object.fromEntries(FIELDS.filter((k) => k in src).map((k) => [k, String(src[k] ?? "").slice(0, 300)])) } as Billing,
      }));
      return Response.json({ kind: next.kind, billing: next.billing });
    }
    if (b.type === "tasks") {
      const incoming = (Array.isArray(b.tasks) ? b.tasks : []).slice(0, 100).map((x) => normalizeTask(x)).filter((x): x is Task => !!x);
      const next = await patchCustomer(customer.id, (c) => {
        const cur = c.tasks ?? [];
        // o cliente não mexe em tarefas internas do estúdio; as dele ficam marcadas como do cliente
        const allowed = incoming.filter((x) => !cur.find((y) => y.id === x.id && y.internal)).map((x) => ({ ...x, internal: undefined, side: cur.find((y) => y.id === x.id)?.side ?? ("client" as const) }));
        return { ...c, tasks: mergeTasks(cur, allowed) };
      });
      return Response.json({ tasks: clientTasks(next.tasks) });
    }
    if (b.type === "moodboards") {
      const next = await patchCustomer(customer.id, (c) => ({ ...c, moodboards: mergeBoards(c.moodboards, normalizeBoards(b.boards)) }));
      return Response.json({ boards: next.moodboards });
    }
    if (b.type === "references") {
      const next = await patchCustomer(customer.id, (c) => ({ ...c, references: mergeRefs(c.references, normalizeRefs(b.references)) }));
      return Response.json({ references: next.references });
    }
    throw new HttpError(400, "bad_type");
  } catch (e) {
    return fail(e);
  }
}
