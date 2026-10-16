import { totals, type Invoice } from "@/lib/invoice";
import { HttpError, fail, serviceClient } from "@/lib/server/admin";
import { requireCustomer } from "@/lib/server/portal";

/** Pagamentos do cliente no portal (responsável e editores): invoices emitidas, estado e totais. Sem rascunhos nem anuladas. */
export async function GET() {
  try {
    const { owner_id, customer, user } = await requireCustomer();
    if (user.role === "viewer") throw new HttpError(403, "read_only");
    const { data, error } = await serviceClient().from("invoices").select("id, number, issue_date, status, data").eq("owner_id", owner_id).neq("status", "draft").order("issue_date", { ascending: false });
    if (error) throw error;
    const company = (customer.billing?.company || customer.name).toLowerCase();
    const rows = (data ?? [])
      .map((r) => ({ ...(r.data as Invoice), id: r.id as string, status: r.status as Invoice["status"] }))
      .filter((i) => !i.void && (i.customer_id === customer.id || (!i.customer_id && i.client.name.toLowerCase().startsWith(company))))
      .map((i) => ({ id: i.id, number: i.number, issue_date: i.issue_date, status: i.status, currency: i.currency, total: totals(i).total, due_days: i.payment.termsDays }));
    return Response.json({ invoices: rows });
  } catch (e) {
    return fail(e);
  }
}
