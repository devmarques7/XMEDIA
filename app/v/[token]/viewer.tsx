"use client";

// Link digital da proposta: apresentação + PDF + aprovar (escolher pacote/extras → booking confirmado) ou recusar.
import { Icon } from "@/components/Icon";
import { useState } from "react";
import { Deck } from "@/components/proposal/Deck";
import { bookingLabel, choiceTotals } from "@/lib/decision";
import { useT } from "@/lib/i18n";
import type { Booking, Offer, ProposalDoc } from "@/lib/proposal";

export type PublicDecision = { status: "approved" | "declined"; at: string; name: string; package?: number; extras?: number[] };
type Props = {
  token: string;
  shared: { title: string; doc: ProposalDoc } | null;
  offer?: Offer | null;
  booking?: Booking | null;
  decision?: PublicDecision | null;
  client?: { name: string; email: string } | null;
};

const eur = (n: number) => `€${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ShareViewer({ token, shared, offer, booking, decision: initial, client }: Props) {
  const { t } = useT();
  const [decision, setDecision] = useState<PublicDecision | null>(initial ?? null);
  const [modal, setModal] = useState<"approve" | "decline" | null>(null);
  if (!shared)
    return (
      <main className="deck" style={{ placeItems: "center", display: "grid" }}>
        <p className="muted">{t("pr.view.expired")}</p>
      </main>
    );
  const actions = decision ? (
    <span className={`dv-state ${decision.status}`}>
      {decision.status === "approved" ? "Approved" : "Declined"} · {new Date(decision.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
    </span>
  ) : (
    <>
      <button className="dk-btn dk-ghost" onClick={() => setModal("decline")}>
        Decline
      </button>
      <button className="dk-btn dk-primary" onClick={() => setModal("approve")} data-testid="dv-approve">
        <Icon name="check" size={14} /> Approve
      </button>
    </>
  );
  return (
    <>
      <Deck doc={shared.doc} title={shared.title} actions={actions} />
      {modal && (
        <DecisionModal
          kind={modal}
          token={token}
          title={shared.title}
          offer={offer ?? null}
          booking={booking ?? null}
          client={client ?? null}
          onClose={() => setModal(null)}
          onDone={(d) => setDecision(d)}
        />
      )}
    </>
  );
}

function DecisionModal({
  kind,
  token,
  title,
  offer,
  booking,
  client,
  onClose,
  onDone,
}: {
  kind: "approve" | "decline";
  token: string;
  title: string;
  offer: Offer | null;
  booking: Booking | null;
  client: { name: string; email: string } | null;
  onClose: () => void;
  onDone: (d: PublicDecision) => void;
}) {
  const rec = Math.max(0, offer?.packages.findIndex((p) => p.recommended) ?? 0);
  const [pkg, setPkg] = useState(rec);
  const [extras, setExtras] = useState<number[]>([]);
  const [name, setName] = useState(client?.name ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ emailed: boolean; booking: string | null; email: string } | null>(null);
  const totals = offer ? choiceTotals(offer, pkg, extras) : null;
  const date = bookingLabel(booking ?? undefined);
  const approve = kind === "approve";
  const valid = name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && (!approve || agree);

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/proposal-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: kind, name: name.trim(), email: email.trim(), package: pkg, extras, note }),
      });
      const j = await r.json();
      if (r.status === 409) {
        onDone(j.decision);
        throw new Error("This proposal already has a decision.");
      }
      if (!r.ok) throw new Error(j.error === "bad_contact" ? "Please enter your name and a valid email." : "Something went wrong — please try again or reply to our email.");
      setDone({ emailed: j.emailed, booking: j.booking, email: email.trim() });
      onDone({ status: j.decision.status, at: j.decision.at, name: j.decision.name, package: j.decision.package, extras: j.decision.extras });
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="dv-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dv-modal" role="dialog" aria-modal="true" aria-label={approve ? "Approve proposal" : "Decline proposal"}>
        <button className="dv-x" onClick={onClose} aria-label="Close">
          <Icon name="close" size={14} />
        </button>
        <span className="dv-kicker">{title}</span>
        {done ? (
          <div className="dv-done">
            <div className={`dv-check ${approve ? "ok" : ""}`}>{approve ? "" : "♡"}</div>
            <h2>{approve ? "Booking confirmed" : "Thank you"}</h2>
            {approve && done.booking && <p className="dv-date">{done.booking}</p>}
            <p>
              {approve
                ? done.emailed
                  ? `The confirmation is on its way to ${done.email} (with a copy to MediaMarques). Next, we send the invoice for the deposit.`
                  : "Your approval is registered and the date is reserved. MediaMarques will send you the confirmation and the deposit invoice by email."
                : done.emailed
                  ? `We sent a short note to ${done.email}. Thank you for considering MediaMarques.`
                  : "Your answer is registered. Thank you for considering MediaMarques."}
            </p>
            <button className="dv-primary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <h2>{approve ? "Approve & book the date" : "Decline the proposal"}</h2>
            {approve && date && <p className="dv-date"><Icon name="calendar" size={14} /> {date}</p>}
            {approve && offer && (
              <>
                <div className="dv-label">Package</div>
                <div className="dv-pkgs">
                  {offer.packages.map((p, i) => (
                    <label key={i} className={`dv-pkg${pkg === i ? " on" : ""}`}>
                      <input type="radio" name="dv-pkg" checked={pkg === i} onChange={() => setPkg(i)} />
                      <span className="dv-pkg-head">
                        <b>{p.name}</b>
                        {p.recommended && <em>Recommended</em>}
                      </span>
                      <span className="dv-price">{eur(p.subtotal)}</span>
                      <span className="dv-sub">excl. BTW</span>
                    </label>
                  ))}
                </div>
                {offer.extras.length > 0 && (
                  <>
                    <div className="dv-label">Optional extras</div>
                    {offer.extras.map((x, i) => (
                      <label key={i} className="dv-extra">
                        <input type="checkbox" checked={extras.includes(i)} onChange={(e) => setExtras(e.target.checked ? [...extras, i] : extras.filter((v) => v !== i))} />
                        <span>{x.label}</span>
                        <b>+ {eur(x.price)}</b>
                      </label>
                    ))}
                  </>
                )}
                {totals && (
                  <div className="dv-totals">
                    <div>
                      <span>Total excl. BTW</span>
                      <b>{eur(totals.subtotal)}</b>
                    </div>
                    <div>
                      <span>BTW {offer.btw_rate}%</span>
                      <span>{eur(totals.btw)}</span>
                    </div>
                    <div className="big">
                      <span>Total incl. BTW</span>
                      <b>{eur(totals.total)}</b>
                    </div>
                    <div>
                      <span>Deposit {offer.deposit_pct}% to secure the date</span>
                      <span>{eur(totals.deposit)}</span>
                    </div>
                  </div>
                )}
              </>
            )}
            {!approve && <p className="dv-p">No problem — let us know what didn’t fit (optional). It helps us prepare a better proposal next time.</p>}
            <div className="dv-fields">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" autoComplete="email" />
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={approve ? "Anything we should know? (optional)" : "Reason (optional)"} />
            </div>
            {approve && (
              <label className="dv-agree">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>
                  I approve this quote and the {offer?.deposit_pct ?? 50}% deposit to secure the date. The balance is due within 5 days after final delivery.
                </span>
              </label>
            )}
            {err && <p className="dv-err">{err}</p>}
            <button className={approve ? "dv-primary" : "dv-secondary"} onClick={submit} disabled={busy || !valid} data-testid="dv-confirm">
              {busy ? "…" : approve ? "Confirm booking" : "Decline proposal"}
            </button>
            <p className="dv-small">A confirmation is sent to your email, with a copy to MediaMarques.</p>
          </>
        )}
      </div>
    </div>
  );
}
