"use client";

// Vista pública de uma invoice (link digital): resumo, linhas, total, vencimento, PDF para ver e descarregar.
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { money, totals, type Invoice } from "@/lib/invoice";
import { dueDate } from "@/lib/invoiceStats";
import { invoiceBlob, invoiceFileName } from "@/lib/invoicePdf";

const T = {
  title: "Invoice",
  from: "From",
  to: "Billed to",
  issued: "Issued",
  due: "Due",
  total: "Total",
  status: { paid: "Paid", sent: "Awaiting payment", draft: "Draft" },
  download: "Download PDF",
  pay: "Pay online",
  validUntil: "This link works until",
  expired: "This invoice link has expired.",
  invalid: "This invoice link is not valid.",
  ask: "Ask MediaMarques for a new link: contact@mediamarques.com",
  loading: "Preparing the PDF…",
};

export function InvoiceView({ invoice, expires, error }: { invoice?: Invoice; expires?: string; error?: "invalid" | "expired" }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!invoice) return;
    let u = "";
    invoiceBlob(invoice)
      .then((b) => setUrl((u = URL.createObjectURL(b))))
      .catch(() => {});
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [invoice]);

  if (!invoice)
    return (
      <main className="iv iv-err">
        <Logo size={34} />
        <h1>{error === "expired" ? T.expired : T.invalid}</h1>
        <p className="muted">{T.ask}</p>
      </main>
    );

  const t = totals(invoice);
  const day = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const payLink = invoice.payment.qr === "link" && /^https:\/\//.test(invoice.payment.link) ? invoice.payment.link : "";
  async function download() {
    setBusy(true);
    try {
      const a = document.createElement("a");
      a.href = url || URL.createObjectURL(await invoiceBlob(invoice!));
      a.download = invoiceFileName(invoice!);
      a.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="iv">
      <header className="iv-head">
        <span className="row" style={{ gap: 10 }}>
          <Logo size={26} /> <b>MediaMarques</b>
        </span>
        <span className={`label ${invoice.status === "paid" ? "tone-ok" : "tone-warn"}`} data-testid="iv-status">
          {T.status[invoice.status]}
        </span>
      </header>
      <section className="iv-card">
        <span className="label muted">{T.title}</span>
        <h1 className="iv-num" data-testid="iv-number">
          {invoice.number}
        </h1>
        <div className="iv-total">{money(t.total, invoice.currency)}</div>
        <dl className="iv-meta">
          <div>
            <dt>{T.to}</dt>
            <dd>{invoice.client.name || "—"}</dd>
          </div>
          <div>
            <dt>{T.issued}</dt>
            <dd>{day(invoice.issue_date)}</dd>
          </div>
          <div>
            <dt>{T.due}</dt>
            <dd>{day(dueDate(invoice))}</dd>
          </div>
        </dl>
        <table className="iv-lines">
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id}>
                <td>{it.description}</td>
                <td className="r mono">{money(it.qty * it.rate, invoice.currency)}</td>
              </tr>
            ))}
            {t.btwAmount !== 0 && (
              <tr className="sub">
                <td>{t.btw.label}</td>
                <td className="r mono">{money(t.btwAmount, invoice.currency)}</td>
              </tr>
            )}
            <tr className="tot">
              <td>{T.total}</td>
              <td className="r mono">{money(t.total, invoice.currency)}</td>
            </tr>
          </tbody>
        </table>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn accent" onClick={download} disabled={busy} data-testid="iv-download">
            {T.download}
          </button>
          {payLink && invoice.status !== "paid" && (
            <a className="btn" href={payLink} target="_blank" rel="noopener noreferrer">
              {T.pay}
            </a>
          )}
        </div>
        {expires && (
          <p className="muted small" style={{ margin: 0 }}>
            {T.validUntil} {new Date(expires).toLocaleString("en-GB", { timeZone: "Europe/Amsterdam", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}.
          </p>
        )}
      </section>
      <section className="iv-pdf">{url ? <iframe src={url} title={invoice.number} data-testid="iv-pdf" /> : <p className="muted small">{T.loading}</p>}</section>
    </main>
  );
}
