import type { CustomerUserRole } from "@/lib/customer";
import { HttpError, fail } from "@/lib/server/admin";
import { listCustomerUsers, requireCustomer } from "@/lib/server/portal";
import { createInvite, removeUser, saveUser } from "@/lib/server/portalTeam";

/** Equipa do cliente no portal: todos veem; só o responsável (owner) convida, muda funções e remove. */
export async function GET() {
  try {
    const { customer } = await requireCustomer();
    return Response.json({ users: await listCustomerUsers(customer.id) });
  } catch (e) {
    return fail(e);
  }
}

type Body = { action: "save" | "invite" | "remove"; id?: string; name?: string; email?: string; role?: CustomerUserRole; send?: boolean };

export async function POST(req: Request) {
  try {
    const { customer, user } = await requireCustomer();
    if (user.role !== "owner") throw new HttpError(403, "owner_only");
    const b = (await req.json()) as Body;
    const users = await listCustomerUsers(customer.id);
    const target = b.id ? users.find((u) => u.id === b.id) : null;
    if (b.id && !target) throw new HttpError(404, "not_found");
    const owners = users.filter((u) => u.role === "owner" && u.status !== "disabled");
    if (target?.id === user.id && (b.action === "remove" || (b.action === "save" && b.role !== "owner"))) throw new HttpError(409, "not_self");
    if (target?.role === "owner" && owners.length <= 1 && (b.action === "remove" || b.role !== "owner")) throw new HttpError(409, "last_owner");
    if (b.action === "remove") return Response.json({ users: await removeUser(customer.id, b.id!) });
    if (b.action === "invite") return Response.json({ invite: await createInvite(customer, b.id!, !!b.send, new URL(req.url).origin), users: await listCustomerUsers(customer.id) });
    return Response.json({ users: await saveUser(customer.id, b) });
  } catch (e) {
    return fail(e);
  }
}
