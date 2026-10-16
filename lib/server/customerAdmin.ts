import { HttpError, requirePerm } from "./admin";
import { loadCustomer } from "./portal";

/** Admin, ou team member com a permissão (por omissão customers.edit), do workspace dono do cliente. */
export async function requireOwnCustomer(customerId: string, perm = "customers.edit") {
  const { user, ownerId } = await requirePerm(perm);
  const row = customerId ? await loadCustomer(customerId) : null;
  if (!row || row.owner_id !== ownerId) throw new HttpError(404, "not_found");
  return { admin: user, ...row };
}
