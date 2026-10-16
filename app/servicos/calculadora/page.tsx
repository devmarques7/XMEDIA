"use client";

// Calculadora de propostas: recebedor (cliente), horas, parceiro, recorrência, urgência e serviços →
// valores linha a linha com descontos (teto e piso), BTW, depósito, margem interna; guarda, PDF, invoice e proposta.
import { Select } from "@/components/Select";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useCatalog, useMoney } from "@/components/services/parts";
import { AppShell, Toast, useToast } from "@/components/ui";
import { useAccess } from "@/lib/access";
import type { Customer } from "@/lib/customer";
import { customerStore } from "@/lib/customerStore";
import { useT, type Key } from "@/lib/i18n";
import { emptyInvoice, nextNumber } from "@/lib/invoice";
import { invoiceStore } from "@/lib/invoiceStore";
import { emptyProposal } from "@/lib/proposal";
import { applyPricing, groupFromCalculator } from "@/lib/proposalPricing";
import { proposalStore } from "@/lib/proposalStore";
import { can } from "@/lib/roles";
import { newQuoteId, serviceStore, type SavedQuote } from "@/lib/serviceStore";
import { proposalText, quote, quoteItems, quoteNote, searchServices, type QuoteInput } from "@/lib/services";

const EMPTY: QuoteInput = { client: { name: "", company: "", email: "", country: "NL", customer_id: null }, lines: [], partner: false, recurring_months: 0, rush: false, extra_discount_pct: 0, note: "" };
const DRAFT = "xmedia:quote:draft";
const STARTERS: { key: Key; lines: { service_id: string; qty: number }[]; months?: number }[] = [
  { key: "sv.calc.st.reel", lines: [{ service_id: "edit-pro", qty: 1 }] },
  { key: "sv.calc.st.day", lines: [{ service_id: "cap-day-pro", qty: 1 }, { service_id: "edit-pro", qty: 4 }, { service_id: "strategy-on-demand", qty: 1 }] },
  { key: "sv.calc.st.photo", lines: [{ service_id: "photo-event-on-demand", qty: 3 }, { service_id: "photo-express", qty: 1 }] },
  { key: "sv.calc.st.monthly", lines: [{ service_id: "pkg-pro", qty: 4 }, { service_id: "photo-sub-on-demand", qty: 1 }], months: 6 },
];

function CalcInner() {
  const { t, locale } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const money = useMoney();
  const access = useAccess();
  const edit = can(access, "proposals.edit");
  const [toast, setToast] = useToast();
  const { catalog, quotes } = useCatalog();
  const [input, setInput] = useState<QuoteInput>(EMPTY);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [status, setStatus] = useState<SavedQuote["status"]>("draft");
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState<number | "">("");
  const [find, setFind] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [busy, setBusy] = useState("");
  const booted = useRef(false);

  useEffect(() => {
    customerStore.list().then(setCustomers).catch(() => {});
  }, []);

  // arranque: ?q=<orçamento guardado>, ?add=<serviço>&qty=, ou rascunho local
  useEffect(() => {
    if (!catalog || booted.current) return;
    const qid = params.get("q");
    if (qid && !quotes.length) return; // espera pela lista
    booted.current = true;
    const saved = qid ? quotes.find((x) => x.id === qid) : null;
    if (saved) {
      setInput({ ...EMPTY, ...saved.input, client: { ...EMPTY.client, ...saved.input.client } });
      setQuoteId(saved.id);
      setStatus(saved.status);
      setTitle(saved.title);
      return;
    }
    let base = EMPTY;
    try {
      const d = localStorage.getItem(DRAFT);
      if (d) base = { ...EMPTY, ...JSON.parse(d) };
    } catch {}
    const add = params.get("add");
    if (add && catalog.services.some((s) => s.id === add)) {
      const qty = Math.max(0.25, Number(params.get("qty")) || 1);
      base = { ...base, lines: [...base.lines.filter((l) => l.service_id !== add), { service_id: add, qty }] };
    }
    setInput(base);
  }, [catalog, quotes, params]);

  useEffect(() => {
    if (!booted.current || quoteId) return;
    try {
      localStorage.setItem(DRAFT, JSON.stringify(input));
    } catch {}
  }, [input, quoteId]);

  const services = useMemo(() => catalog?.services ?? [], [catalog]);
  const rules = catalog?.rules;
  const result = useMemo(() => (rules ? quote(input, services, rules) : null), [input, services, rules]);
  const found = useMemo(() => (find.trim() ? searchServices(services, find, catalog?.folders).slice(0, 8) : []), [find, services, catalog]);

  const patch = (p: Partial<QuoteInput>) => setInput((x) => ({ ...x, ...p }));
  const setClient = (p: Partial<QuoteInput["client"]>) => setInput((x) => ({ ...x, client: { ...x.client, ...p } }));
  const addLine = (id: string, qty?: number) => {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    const q = qty ?? (s.unit === "hour" && hours ? Number(hours) : 1);
    setInput((x) => (x.lines.some((l) => l.service_id === id) ? { ...x, lines: x.lines.map((l) => (l.service_id === id ? { ...l, qty: l.qty + q } : l)) } : { ...x, lines: [...x.lines, { service_id: id, qty: q }] }));
    setFind("");
  };
  const setQty = (i: number, qty: number) => setInput((x) => ({ ...x, lines: x.lines.map((l, k) => (k === i ? { ...l, qty } : l)) }));
  const removeLine = (i: number) => setInput((x) => ({ ...x, lines: x.lines.filter((_, k) => k !== i) }));
  const applyHours = (h: number | "") => {
    setHours(h);
    if (h === "" || !h) return;
    setInput((x) => ({ ...x, lines: x.lines.map((l) => (services.find((s) => s.id === l.service_id)?.unit === "hour" ? { ...l, qty: Number(h) } : l)) }));
  };
  const pickCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id);
    if (!c) return setClient({ customer_id: null });
    setClient({ customer_id: c.id, company: c.name, name: c.contact, email: c.email });
  };
  function reset() {
    setInput(EMPTY);
    setQuoteId(null);
    setStatus("draft");
    setTitle("");
    setHours("");
    router.replace("/servicos/calculadora");
  }

  async function run(key: string, f: () => Promise<void>) {
    setBusy(key);
    try {
      await f();
    } catch (e) {
      setToast((e as Error).message);
    }
    setBusy("");
  }
  const save = () =>
    run("save", async () => {
      if (!result) return;
      const isNew = !quoteId;
      const q: SavedQuote = { id: quoteId ?? newQuoteId(), title: title || input.client.company || input.client.name || t("sv.calc.untitled"), input, subtotal: result.subtotal, total: result.total, status };
      const saved = await serviceStore.saveQuote(q);
      if (isNew) await serviceStore.bump(input.lines.map((l) => l.service_id));
      setQuoteId(saved.id);
      router.replace(`/servicos/calculadora?q=${saved.id}`);
      setToast(t("sv.calc.saved"));
    });
  const pdf = () =>
    run("pdf", async () => {
      if (!result || !rules) return;
      const { downloadQuotePdf, quoteNumber } = await import("@/lib/servicePdf");
      await downloadQuotePdf(result, input, rules, quoteNumber());
    });
  const toInvoice = () =>
    run("inv", async () => {
      if (!result || !rules) return;
      const today = new Date().toISOString().slice(0, 10);
      const all = await invoiceStore.list();
      const inv = emptyInvoice(nextNumber(all.map((i) => i.number), today, 50), today);
      inv.client = { ...inv.client, name: [input.client.company, input.client.name].filter(Boolean).join(" — Attn. "), email: input.client.email ?? "", country: (input.client.country || "NL").toUpperCase() };
      inv.items = quoteItems(result, rules).map((i) => ({ ...i, id: crypto.randomUUID() }));
      inv.note = quoteNote(result, input, rules);
      const saved = await invoiceStore.save(inv);
      setToast(t("sv.calc.invoiceDone", { n: saved.number }));
      router.push(`/financas/${saved.id}`);
    });
  const toProposal = () =>
    run("prop", async () => {
      if (!result) return;
      const p = emptyProposal(title || `${input.client.company || input.client.name || "Client"} — Proposal`);
      p.client = { name: input.client.name, company: input.client.company ?? "", email: input.client.email ?? "" };
      p.value = result.subtotal;
      p.notes = proposalText(result, input);
      p.pricing = {
        lines: groupFromCalculator(input.lines, services),
        partner: input.partner,
        recurring_months: input.recurring_months,
        rush: input.rush,
        country: input.client.country || "NL",
        insert_after: p.doc.slides.filter((s) => s.type !== "closing").at(-1)?.id,
      };
      const priced = applyPricing(p, services, rules);
      Object.assign(p, priced);
      p.doc.meta.fao = `[ ${input.client.company || input.client.name || "Client"} Proposal ]`;
      const saved = await proposalStore.save(p);
      if (quoteId) await serviceStore.saveQuote({ ...(quotes.find((x) => x.id === quoteId) as SavedQuote), input, subtotal: result.subtotal, total: result.total, status, title, proposal_id: saved.id });
      router.push(`/propostas/${saved.id}`);
    });
  const copy = () =>
    run("copy", async () => {
      if (!result) return;
      await navigator.clipboard.writeText(proposalText(result, input, { title: title || undefined }));
      setToast(t("sv.calc.copied"));
    });

  const unitLabel = (u: string) => t(`sv.unit.${u}` as Key);
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : "");

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <Link href="/servicos" className="label muted">
            <Icon name="back" size={14} /> {t("sv.back")}
          </Link>
          <h1 className="h1">{t("sv.calc.sub")}</h1>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={reset}>
            {t("sv.calc.reset")}
          </button>
        </div>
      </section>

      <div className="sv-calc">
        <div className="sv-calc-main stack">
          <section className="w stack">
            <div className="label">{t("sv.calc.client")}</div>
            <div className="grid2">
              <label className="field">
                <span>{t("nav.customers")}</span>
                <Select className="select" value={input.client.customer_id ?? ""} onChange={(e) => pickCustomer(e.target.value)}>
                  <option value="">{t("sv.calc.pickCustomer")}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="field">
                <span>{t("sv.calc.company")}</span>
                <input className="input" value={input.client.company ?? ""} onChange={(e) => setClient({ company: e.target.value })} data-testid="calc-company" />
              </label>
              <label className="field">
                <span>{t("sv.calc.clientName")}</span>
                <input className="input" value={input.client.name} onChange={(e) => setClient({ name: e.target.value })} />
              </label>
              <label className="field">
                <span>Email</span>
                <input className="input" type="email" value={input.client.email ?? ""} onChange={(e) => setClient({ email: e.target.value })} />
              </label>
              <label className="field">
                <span>{t("sv.calc.country")}</span>
                <input className="input mono" maxLength={2} value={input.client.country ?? "NL"} onChange={(e) => setClient({ country: e.target.value.toUpperCase() })} />
              </label>
              <label className="field">
                <span>{t("pr.col.title")}</span>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("sv.calc.untitled")} />
              </label>
            </div>
          </section>

          <section className="w sv-calc-opts">
            <label className="field" style={{ maxWidth: 170 }}>
              <span>{t("sv.calc.hours")}</span>
              <input className="input big mono" type="number" min={0} step={0.5} value={hours} onChange={(e) => applyHours(e.target.value === "" ? "" : Math.max(0, +e.target.value))} placeholder="—" data-testid="calc-hours" />
            </label>
            <label className={`sv-toggle${input.partner ? " on" : ""}`}>
              <input type="checkbox" checked={input.partner} onChange={(e) => patch({ partner: e.target.checked })} data-testid="calc-partner" />
              <span>{t("sv.calc.partner")}</span>
              <b>−{rules?.partner_pct ?? 0}%</b>
            </label>
            <div className={`sv-toggle${input.recurring_months ? " on" : ""}`}>
              <span>{t("sv.calc.recurring")}</span>
              <div className="seg" role="group">
                <button aria-pressed={!input.recurring_months} onClick={() => patch({ recurring_months: 0 })}>
                  {t("sv.sim.none")}
                </button>
                {rules?.recurring.map((r) => (
                  <button key={r.months} aria-pressed={input.recurring_months === r.months} onClick={() => patch({ recurring_months: r.months })} data-testid={`calc-rec-${r.months}`}>
                    {r.months}m · −{r.pct}%
                  </button>
                ))}
              </div>
            </div>
            <label className={`sv-toggle${input.rush ? " on" : ""}`}>
              <input type="checkbox" checked={input.rush} onChange={(e) => patch({ rush: e.target.checked })} />
              <span>{t("sv.sim.rush")}</span>
              <b>+{rules?.rush_pct ?? 0}%</b>
            </label>
            <label className="field" style={{ maxWidth: 150 }}>
              <span>{t("sv.calc.extra")}</span>
              <input className="input mono" type="number" min={0} max={100} value={input.extra_discount_pct ?? 0} onChange={(e) => patch({ extra_discount_pct: Math.max(0, +e.target.value) })} />
            </label>
          </section>

          <section className="w stack">
            <div className="w-head">
              <span className="label">{t("sv.calc.lines")}</span>
            </div>
            <div className="sv-add">
              <label className="search">
                <Icon name="search" />
                <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={t("sv.calc.add")} onKeyDown={(e) => e.key === "Enter" && found[0] && addLine(found[0].id)} data-testid="calc-find" />
              </label>
              {found.length > 0 && (
                <ul className="sv-add-list">
                  {found.map((s) => (
                    <li key={s.id}>
                      <button onClick={() => addLine(s.id)}>
                        <b>{s.name}</b>
                        <span className="mono small">
                          {money(s.price)} / {unitLabel(s.unit)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {input.lines.length === 0 ? (
              <div className="stack">
                <p className="muted small">{t("sv.calc.noLines")}</p>
                <div className="label muted">{t("sv.calc.starters")}</div>
                <div className="row">
                  {STARTERS.map((s) => (
                    <button key={s.key} className="chip" onClick={() => patch({ lines: s.lines, recurring_months: s.months ?? input.recurring_months })}>
                      {t(s.key)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="sv-lines">
                {input.lines.map((ln, i) => {
                  const sv = services.find((x) => x.id === ln.service_id);
                  const l = result?.lines.find((x) => x.service.id === ln.service_id);
                  if (!sv) return null;
                  return (
                    <li key={ln.service_id} className={l?.blocked ? "blocked" : undefined}>
                      <div className="sv-line-name">
                        <Link href={`/servicos/${encodeURIComponent(sv.id)}`}>
                          <b>{sv.name}</b>
                        </Link>
                        <span className="muted small mono">
                          {money(l?.unit_price ?? sv.price, 2)} / {unitLabel(sv.unit)}
                          {l?.rush ? ` · rush +${money(l.rush)}` : ""}
                        </span>
                      </div>
                      <input className="input mono sv-qty" type="number" min={0} step={sv.unit === "hour" ? 0.5 : 1} value={ln.qty} onChange={(e) => setQty(i, Math.max(0, +e.target.value))} aria-label={t("sv.calc.qty")} />
                      <span className="sv-line-disc small mono">
                        {l?.applied_pct ? (
                          <>
                            −{l.applied_pct}%{l.capped && <em> {t("sv.calc.capped")}</em>}
                            {l.floor_limited && <em> {t("sv.calc.floor")}</em>}
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </span>
                      <b className="mono sv-line-net">{money(l?.net ?? 0, 2)}</b>
                      <button className="btn ghost small" onClick={() => removeLine(i)} aria-label={t("remove")}>
                        <Icon name="close" size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <label className="field">
              <span>NOTE</span>
              <textarea className="textarea small" rows={2} value={input.note ?? ""} onChange={(e) => patch({ note: e.target.value })} />
            </label>
          </section>
        </div>

        <aside className="sv-calc-side">
          <section className="w stack sv-summary" data-testid="calc-summary">
            <div className="label">{t("sv.calc.summary")}</div>
            {result && (
              <>
                <div className="sv-sum-row">
                  <span>{t("sv.sim.gross")}</span>
                  <span className="mono">{money(result.gross, 2)}</span>
                </div>
                {result.discount > 0 && (
                  <div className="sv-sum-row tone-ok">
                    <span>{t("sv.sim.discount")}</span>
                    <span className="mono">−{money(result.discount, 2)}</span>
                  </div>
                )}
                <div className="sv-sum-row">
                  <span>{t("sv.calc.subtotal")}</span>
                  <b className="mono">{money(result.subtotal, 2)}</b>
                </div>
                <div className="sv-sum-row muted">
                  <span>{t("sv.calc.btw", { r: result.btw_rate })}</span>
                  <span className="mono">{money(result.btw, 2)}</span>
                </div>
                <div className="sv-total">
                  <span className="label muted">{t("sv.calc.total")}</span>
                  <span className="sv-amount" data-testid="calc-total">
                    {money(result.total, 2)}
                  </span>
                </div>
                <div className="sv-sum-row">
                  <span>{t("sv.calc.deposit", { p: rules?.deposit_pct ?? 50 })}</span>
                  <span className="mono">{money(result.deposit, 2)}</span>
                </div>
                {result.months > 0 && <p className="small muted">{t("sv.calc.monthly", { n: result.months, v: money(result.contract_total) })}</p>}
                {result.warnings
                  .filter((w, i, a) => a.findIndex((x) => x.code === w.code) === i)
                  .map((w, i) => (
                    <p key={i} className={`small ${w.code === "blocked" || w.code === "below_floor" ? "tone-danger" : "tone-warn"}`}>
                      <Icon name="alert" size={14} /> {t(`sv.w.${w.code}` as Key, { cap: rules?.cap_pct ?? 35, n: w.detail ?? "", d: w.detail ?? "" })}
                    </p>
                  ))}
                <div className="sv-internal">
                  <span className="label muted"><Icon name="lock" size={14} /> {t("sv.calc.internal")}</span>
                  <div className="sv-sum-row small">
                    <span>{t("sv.calc.crp")}</span>
                    <span className="mono">{money(result.crp, 2)}</span>
                  </div>
                  <div className="sv-sum-row small">
                    <span>{t("sv.calc.marginLine")}</span>
                    <span className={`mono ${result.margin < (rules?.floor_margin ?? 50) ? "tone-warn" : "tone-ok"}`}>{result.margin}%</span>
                  </div>
                  <div className="sv-sum-row small">
                    <span>{t("sv.sim.hours")}</span>
                    <span className="mono">{result.hours}h</span>
                  </div>
                </div>
                <div className="stack sv-actions">
                  {edit && (
                    <div className="row">
                      <button className="btn accent" onClick={save} disabled={!!busy || !input.lines.length} data-testid="calc-save">
                        {t("sv.calc.save")}
                      </button>
                      <Select className="select statussel" value={status} onChange={(e) => setStatus(e.target.value as SavedQuote["status"])} aria-label="status">
                        {(["draft", "sent", "won", "lost"] as const).map((s) => (
                          <option key={s} value={s}>
                            {t(`sv.status.${s}` as Key)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <button className="btn" onClick={pdf} disabled={!!busy || !input.lines.length || result.warnings.some((w) => w.code === "blocked")} data-testid="calc-pdf">
                    <Icon name="download" size={14} /> {t("sv.calc.pdf")}
                  </button>
                  <button className="btn" onClick={copy} disabled={!input.lines.length}>
                    <Icon name="copy" size={14} /> {t("sv.calc.copy")}
                  </button>
                  {edit && (
                    <>
                      <button className="btn" onClick={toProposal} disabled={!!busy || !input.lines.length}>
                        <Icon name="proposal" size={16} /> {t("sv.calc.proposal")}
                      </button>
                      {can(access, "invoices.create") && (
                        <button className="btn" onClick={toInvoice} disabled={!!busy || !input.lines.length || result.warnings.some((w) => w.code === "blocked")}>
                          <Icon name="finance" size={16} /> {t("sv.calc.invoice")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </section>

          <section className="w stack">
            <div className="label">{t("sv.recentQuotes")}</div>
            {quotes.length === 0 && <p className="muted small">{t("sv.noQuotes")}</p>}
            <ul className="sv-feed">
              {quotes.slice(0, 12).map((q) => (
                <li key={q.id} className={q.id === quoteId ? "on" : undefined}>
                  <Link href={`/servicos/calculadora?q=${q.id}`} onClick={() => (booted.current = false)}>
                    <b>{q.title}</b>
                  </Link>
                  <span className="muted small mono">
                    {money(q.subtotal)} · {t(`sv.status.${q.status}` as Key)} · {date(q.updated_at)}
                    {edit && (
                      <button className="btn ghost small" onClick={() => confirm(t("sv.calc.deleteConfirm")) && serviceStore.removeQuote(q.id).then(() => q.id === quoteId && reset())} aria-label={t("remove")}>
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <Toast msg={toast} />
    </AppShell>
  );
}

export default function CalculatorPage() {
  return (
    <Suspense>
      <CalcInner />
    </Suspense>
  );
}
