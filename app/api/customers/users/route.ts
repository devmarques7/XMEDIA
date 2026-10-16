import type { CustomerUserRole } from "@/lib/customer";
import { fail } from "@/lib/server/admin";
import { requireOwnCustomer } from "@/lib/server/customerAdmin";
import { listCustomerUsers } from "@/lib/server/portal";
import { removeUser, saveUser } from "@/lib/server/portalTeam";

/** Utilizadores do portal de um cliente (sem segredos). */
export async function GET(req: Request) {
  try {
    const customerId = new URL(req.url).searchParams.get("customerId") ?? "";
    await requireOwnCustomer(customerId, "customers.view");
    return Response.json({ users: await listCustomerUsers(customerId) });
  } catch (e) {
    return fail(e);
  }
}

/** Criar ou atualizar uma pessoa do cliente (nome, email, papel). */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { customerId: string; id?: string; name?: string; email?: string; role?: CustomerUserRole };
    await requireOwnCustomer(b.customerId);
    return Response.json({ users: await saveUser(b.customerId, b) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const customerId = q.get("customerId") ?? "";
    await requireOwnCustomer(customerId);
    return Response.json({ users: await removeUser(customerId, q.get("id") ?? "") });
  } catch (e) {
    return fail(e);
  }
}
