// Aprovação / recusa de uma proposta no link digital: totais da escolha e os emails de confirmação de booking
// e de agradecimento (mesmo estilo do convite: cabeçalho em gradiente, cartão claro, BioGrotesk + Fragment Mono). Funções puras.
import { emailLayout } from "./email/layout";
import type { Booking, Offer } from "./proposal";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const eur = (n: number) => `€${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Total da escolha: pacote + extras marcados (preço de cada extra somado à base), BTW e depósito. */
export function choiceTotals(offer: Offer, pkg: number, extras: number[]) {
  const p = offer.packages[pkg] ?? offer.packages[0];
  const subtotal = round2((p?.subtotal ?? 0) + extras.reduce((s, i) => s + (offer.extras[i]?.price ?? 0), 0));
  const btw = round2((subtotal * offer.btw_rate) / 100);
  const total = round2(subtotal + btw);
  return { subtotal, btw, total, deposit: round2((total * offer.deposit_pct) / 100) };
}

export function bookingLabel(b?: Booking) {
  if (!b?.date) return "";
  const d = new Date(b.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return [d, b.time, b.place].filter(Boolean).join(" · ");
}

const layout = (o: { label: string; kicker: string; title: string; paragraphs: string[]; rows: [string, string][]; rowsTitle: string; cta?: { label: string; href: string }; closing: string; origin: string }) =>
  emailLayout({ ...o, boldLastRow: true });

export type DecisionMailInput = {
  name: string;
  title: string;
  link: string;
  origin: string;
  offer?: Offer;
  booking?: Booking;
  pkg?: number;
  extras?: number[];
  note?: string;
};

/** Confirmação de booking (cliente + cópia para a MediaMarques). */
export function bookingEmail(o: DecisionMailInput) {
  const first = o.name.trim().split(" ")[0] || o.name;
  const date = bookingLabel(o.booking);
  const rows: [string, string][] = [["Proposal", o.title]];
  if (date) rows.push(["Date booked", date]);
  let totalsText: string[] = [];
  if (o.offer) {
    const p = o.offer.packages[o.pkg ?? 0];
    const ex = (o.extras ?? []).map((i) => o.offer!.extras[i]).filter(Boolean);
    const t = choiceTotals(o.offer, o.pkg ?? 0, o.extras ?? []);
    rows.push(["Package", `${p?.name ?? "—"} — ${eur(p?.subtotal ?? 0)}`]);
    if (ex.length) rows.push(["Extras", ex.map((e) => `${e.label} + ${eur(e.price)}`).join("\n")]);
    rows.push(["Total excl. BTW", eur(t.subtotal)], [`BTW ${o.offer.btw_rate}%`, eur(t.btw)], [`Deposit ${o.offer.deposit_pct}% to secure the date`, eur(t.deposit)], ["Total incl. BTW", eur(t.total)]);
    totalsText = rows.map(([k, v]) => `${k}: ${v.replace(/\n/g, ", ")}`);
  }
  const subject = `Booking confirmed · ${o.title}`;
  const paragraphs = [
    `Thank you for approving the proposal — ${date ? `${date} is now reserved in our calendar.` : "your booking is confirmed."}`,
    ...(o.note ? [`Your note: “${o.note}”`] : []),
    "Next: we send the invoice for the deposit and, closer to the day, the call sheet with the final times and the shooting plan. If anything changes, just reply to this email.",
  ];
  const closing = "Looking forward to it,\nDaniel Marques · MediaMarques";
  const html = layout({ label: "BOOKING CONFIRMED", kicker: o.title, title: `${first}, your date is booked`, paragraphs, rows, rowsTitle: "Your booking", cta: { label: "View the proposal", href: o.link }, closing, origin: o.origin });
  const text = [`Hi ${first},`, "", ...paragraphs, "", ...totalsText, "", `Proposal: ${o.link}`, "", closing].join("\n");
  return { subject, html, text };
}

/** Agradecimento quando o cliente recusa (cliente + cópia para a MediaMarques). */
export function declineEmail(o: DecisionMailInput) {
  const first = o.name.trim().split(" ")[0] || o.name;
  const subject = `Thank you · ${o.title}`;
  const paragraphs = [
    "Thank you for taking the time to look at our proposal and for letting us know. We have released the date.",
    ...(o.note ? [`Your note: “${o.note}”`] : []),
    "If the plans change — a different date, a smaller scope or another event — we would be glad to prepare a new proposal. Just reply to this email.",
  ];
  const closing = "With gratitude,\nDaniel Marques · MediaMarques";
  const html = layout({ label: "THANK YOU", kicker: o.title, title: `Thank you, ${first}`, paragraphs, rows: [], rowsTitle: "", closing, origin: o.origin });
  const text = [`Hi ${first},`, "", ...paragraphs, "", closing].join("\n");
  return { subject, html, text };
}
