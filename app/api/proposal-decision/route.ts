import { bookingEmail, bookingLabel, choiceTotals, declineEmail } from "@/lib/decision";
import { sendEmail } from "@/lib/inviteEmail";
import type { Decision } from "@/lib/proposal";
import { HttpError, fail, serviceClient } from "@/lib/server/admin";
import { loadShare } from "@/lib/server/shareAccess";

const STUDIO = "contact@mediamarques.com";
type Body = { token: string; action: "approve" | "decline"; name: string; email: string; package?: number; extras?: number[]; note?: string };

/**
 * Decisão do cliente no link digital (público): aprovar → booking confirmado (proposta "ganha", data no calendário)
 * e email de confirmação; recusar → proposta "perdida" e email de agradecimento. Ambos com cópia para a MediaMarques.
 * Só aceita uma decisão por proposta.
 */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    if (b.action !== "approve" && b.action !== "decline") throw new HttpError(400, "bad_action");
    const email = String(b.email ?? "").trim().toLowerCase();
    const name = String(b.name ?? "").trim().slice(0, 120);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "bad_contact");
    const ctx = await loadShare(String(b.token ?? ""));
    if (!ctx?.proposal) throw new HttpError(404, "not_found");
    const p = ctx.proposal;
    if (p.decision) return Response.json({ error: "already_decided", decision: p.decision }, { status: 409 });

    const offer = p.pricing?.offer;
    const pkg = offer ? Math.min(Math.max(0, Math.floor(Number(b.package) || 0)), offer.packages.length - 1) : undefined;
    const extras = offer ? [...new Set((b.extras ?? []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < offer.extras.length))] : [];
    const note = String(b.note ?? "").trim().slice(0, 1000) || undefined;
    const decision: Decision = {
      status: b.action === "approve" ? "approved" : "declined",
      at: new Date().toISOString(),
      name,
      email,
      ...(b.action === "approve" && offer ? { package: pkg, extras, totals: choiceTotals(offer, pkg ?? 0, extras) } : {}),
      ...(note ? { note } : {}),
    };

    const origin = new URL(req.url).origin;
    const link = `${origin}/v/${b.token}`;
    const mailIn = { name, title: p.title, link, origin, offer, booking: p.booking, pkg, extras, note };
    const mail = decision.status === "approved" ? bookingEmail(mailIn) : declineEmail(mailIn);
    const sent = await sendEmail(email, mail, { cc: email === STUDIO ? [] : [STUDIO], replyTo: STUDIO });
    decision.emailed = sent.sent;

    const db = serviceClient();
    const stage = decision.status === "approved" ? "won" : "lost";
    const value = decision.totals?.subtotal ?? p.value;
    const data = { ...p, id: undefined, created_at: undefined, updated_at: undefined, stage, value, decision, client: { ...p.client, name: p.client.name || name, email: p.client.email || email } };
    const { error } = await db.from("proposals").update({ stage, value, data }).eq("id", p.id);
    if (error) throw error;
    // aprovado: a data fica reservada no calendário da equipa
    if (decision.status === "approved" && p.booking?.date)
      await db.from("tasks").insert({ owner_id: ctx.ownerId, title: `📌 BOOKED · ${p.title} — ${name}`, date: p.booking.date, time: p.booking.time ?? "" });

    return Response.json({ ok: true, decision, emailed: sent.sent, reason: sent.sent ? null : sent.reason, booking: decision.status === "approved" ? bookingLabel(p.booking) : null });
  } catch (e) {
    return fail(e);
  }
}
