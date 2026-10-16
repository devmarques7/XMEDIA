"use client";

import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { useAccess } from "@/lib/access";
import { can } from "@/lib/roles";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DropOverlay, InvoiceJsonBox, useWindowDrop } from "@/components/InvoiceJson";
import { AppShell, Toast, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n";
import {
  INVOICE_CATEGORIES,
  INVOICE_CURRENCIES,
  THEMES,
  money,
  totals,
  type BtwSetting,
  type Invoice,
  type InvoiceItem,
  type InvoiceTheme,
  type QrMode,
} from "@/lib/invoice";
import { downloadInvoice, invoiceBlob } from "@/lib/invoicePdf";
import { SendInvoice } from "@/components/SendInvoice";
import { INVOICE_SAVED } from "@/lib/ai/exec";
import { invoiceStore } from "@/lib/invoiceStore";
import { pad } from "@/lib/util";
import { VersionHistory } from "@/components/VersionHistory";

const COUNTRIES = ["NL", "GB", "BE", "DE", "FR", "PT", "ES", "IT", "IE", "US", "BR", "CH", "AE"];

export default function InvoiceEditor() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const access = useAccess();
  const [toast, setToast] = useToast();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState(true);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [pdfUrl, setPdfUrl] = useState("");
  const [rendering, setRendering] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  // ?send=1 (ação "Enviar por email" da lista) abre logo o envio
  const [autoSend] = useState(() => typeof location !== "undefined" && new URLSearchParams(location.search).get("send") === "1");
  // largar um .json em qualquer sítio da página abre a caixa já preenchida
  const dropping = useWindowDrop(
    useCallback((text: string) => {
      setJsonText(text);
      setJsonOpen(true);
      setView("edit");
      requestAnimationFrame(() => document.querySelector("[data-jsonbox]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }, [])
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const renderTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    invoiceStore.get(id).then((x) => (x ? setInv(x) : setMissing(true))).catch((e) => setToast(e.message));
    // o assistente gravou esta invoice → mostrar a versão nova
    const h = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail?.id === id) invoiceStore.get(id).then((x) => x && setInv(x));
    };
    window.addEventListener(INVOICE_SAVED, h);
    return () => window.removeEventListener(INVOICE_SAVED, h);
  }, [id, setToast]);

  // grava automaticamente
  const update = useCallback(
    (fn: (x: Invoice) => Invoice) => {
      setInv((cur) => {
        if (!cur) return cur;
        const next = fn(cur);
        setSaved(false);
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          invoiceStore
            .save(next)
            .then(() => setSaved(true))
            .catch((e) => setToast(e.message));
        }, 700);
        return next;
      });
    },
    [setToast]
  );

  // pré-visualização: PDF real, regenerado depois de parar de escrever
  const wide = typeof window !== "undefined" && window.matchMedia("(min-width: 1000px)").matches;
  useEffect(() => {
    if (!inv || (!wide && view !== "preview")) return;
    clearTimeout(renderTimer.current);
    renderTimer.current = setTimeout(async () => {
      setRendering(true);
      try {
        const url = URL.createObjectURL(await invoiceBlob(inv));
        setPdfUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
      } catch (e) {
        setToast((e as Error).message);
      }
      setRendering(false);
    }, 900);
    return () => clearTimeout(renderTimer.current);
  }, [inv, view, wide, setToast]);

  if (missing)
    return (
      <AppShell>
        <p className="muted" style={{ paddingTop: 30 }}>
          404 · <Link href="/financas">{t("fin.back")}</Link>
        </p>
      </AppShell>
    );
  if (!inv) return <AppShell>{null}</AppShell>;

  const tt = totals(inv);
  const set = <K extends keyof Invoice>(k: K, v: Invoice[K]) => update((x) => ({ ...x, [k]: v }));
  const setClient = (k: keyof Invoice["client"], v: string) => update((x) => ({ ...x, client: { ...x.client, [k]: v } }));
  const setItem = (iid: string, patch: Partial<InvoiceItem>) => update((x) => ({ ...x, items: x.items.map((i) => (i.id === iid ? { ...i, ...patch } : i)) }));
  const setTheme = (patch: Partial<InvoiceTheme>) => update((x) => ({ ...x, theme: { ...x.theme, ...patch } }));
  const num = (s: string) => Number(s.replace(",", ".")) || 0;

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <Link href="/financas" className="label muted arrow">
            <Icon name="back" size={14} /> {t("fin.back")}
          </Link>
          <h1 className="h1" style={{ marginTop: 6 }}>
            {inv.number}
          </h1>
          <span className="muted small">
            {inv.client.name || "—"} · {money(tt.total, inv.currency)} · {saved ? `${t("fin.saved")}` : "…"}
          </span>
          {!!inv.sent_log?.length && (
            <span className="muted small" style={{ display: "block" }} data-testid="inv-sent-log">
              <Icon name="send" size={12} /> {t("fin.sentLog", { n: inv.sent_log.length, when: new Date(inv.sent_log.at(-1)!.at).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }), to: inv.sent_log.at(-1)!.to })}
            </span>
          )}
        </div>
        <div className="row">
          <div className="seg only-narrow" role="group">
            <button aria-pressed={view === "edit"} onClick={() => setView("edit")}>
              {t("fin.edit")}
            </button>
            <button aria-pressed={view === "preview"} onClick={() => setView("preview")}>
              {t("fin.preview")}
            </button>
          </div>
          {can(access, "finance.view") && (
            <SendInvoice
              inv={inv}
              autoOpen={autoSend}
              onSent={(m) => {
                setToast(m);
                invoiceStore.get(id).then((x) => x && setInv(x)); // estado "enviada" + registo do envio
              }}
            />
          )}
          <VersionHistory entity="invoice" id={inv.id} className="btn" />
          {can(access, "finance.view") && !inv.void && (
            <button
              className="btn"
              data-testid="inv-copy-link"
              onClick={async () => {
                try {
                  const r = await fetch("/api/invoices/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: inv.id }) });
                  const j = (await r.json()) as { url?: string; expires?: string; error?: string };
                  if (!r.ok || !j.url) throw new Error(j.error || `HTTP ${r.status}`);
                  await navigator.clipboard.writeText(j.url).catch(() => {});
                  setToast(t("fin.linkCopied", { date: new Date(j.expires!).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) }));
                } catch (e) {
                  setToast((e as Error).message);
                }
              }}
            >
              <Icon name="link" size={14} /> {t("fin.copyLink")}
            </button>
          )}
          <button className="btn accent" onClick={() => downloadInvoice(inv).catch((e) => setToast(e.message))}>
            <Icon name="download" size={14} /> PDF
          </button>
        </div>
      </section>

      <div className={`invgrid ${view === "preview" ? "show-preview" : ""}`}>
        <div className="invform stack">
          {/* 01 cliente */}
          <Sec n={1} title={t("fin.sec.client")}>
            <label className="field">
              <span>{t("fin.client.name")}</span>
              <AutoText className="input big" value={inv.client.name} onChange={(v) => setClient("name", v)} placeholder="WE ARE SANCTUM LTD." />
            </label>
            <label className="field">
              <span>{t("fin.client.address")}</span>
              <AutoText multiline minRows={2} className="textarea" value={inv.client.address} onChange={(v) => setClient("address", v)} />
            </label>
            <div className="grid3">
              <label className="field">
                <span>{t("fin.client.country")}</span>
                <input className="input" list="countries" maxLength={2} value={inv.client.country} onChange={(e) => setClient("country", e.target.value.toUpperCase())} />
                <datalist id="countries">
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span>{t("fin.client.vat")}</span>
                <input className="input" value={inv.client.vat} onChange={(e) => setClient("vat", e.target.value)} />
              </label>
              <label className="field span-all">
                <span>{t("fin.client.email")}</span>
                <input className="input" type="email" value={inv.client.email} onChange={(e) => setClient("email", e.target.value)} />
              </label>
            </div>
          </Sec>

          {/* 02 invoice */}
          <Sec n={2} title={t("fin.sec.invoice")}>
            <div className="grid4">
              <label className="field">
                <span>{t("fin.number")}</span>
                <input className="input" value={inv.number} onChange={(e) => set("number", e.target.value)} />
              </label>
              <label className="field">
                <span>{t("fin.date")}</span>
                <input className="input" type="date" value={inv.issue_date} onChange={(e) => e.target.value && set("issue_date", e.target.value)} />
              </label>
              <label className="field">
                <span>{t("fin.currency")}</span>
                <Select className="select" value={inv.currency} onChange={(e) => set("currency", e.target.value as Invoice["currency"])}>
                  {INVOICE_CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </label>
              <label className="field">
                <span>{t("fin.status")}</span>
                <Select className="select" value={inv.status} disabled={!can(access, "finance.view")} onChange={(e) => set("status", e.target.value as Invoice["status"])}>
                  {(["draft", "sent", "paid"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`fin.status.${s}`)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="field">
                <span>{t("fin.category")}</span>
                <Select className="select" value={inv.category ?? ""} onChange={(e) => set("category", (e.target.value || undefined) as Invoice["category"])}>
                  <option value="">{t("fin.cat.none")}</option>
                  {INVOICE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`fin.cat.${c}`)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="field" title={t("fin.voidHint")}>
                <span>{t("fin.void")}</span>
                <label className="row small" style={{ minHeight: 38, gap: 8 }}>
                  <input type="checkbox" checked={!!inv.void} onChange={(e) => set("void", e.target.checked || undefined)} />
                  {t("fin.voidHint")}
                </label>
              </label>
            </div>
            {(inv.attachment || inv.source || inv.flags?.length || inv.costs != null) && (
              <div className="stack" style={{ marginTop: 10, gap: 8 }}>
                <div className="row" style={{ gap: 6 }}>
                  {inv.attachment && (
                    <>
                      <a className="chip accent" href={`/api/invoices/file/${inv.attachment}`} target="_blank" rel="noreferrer">
                        <Icon name="clip" size={14} /> {t("fin.original")}
                      </a>
                      <a className="chip" href={`/api/invoices/file/${inv.attachment}?dl=1`}>
                        <Icon name="download" size={14} /> {inv.attachment}
                      </a>
                    </>
                  )}
                  {inv.source && (
                    <a className="chip" href={inv.source} target="_blank" rel="noreferrer">
                      <Icon name="arrow" size={14} /> {t("fin.source")}
                    </a>
                  )}
                  {inv.customer_id && (
                    <Link className="chip" href={`/clientes/${inv.customer_id}`}>
                      👤 {t("fin.customer")}
                    </Link>
                  )}
                  {inv.costs != null && can(access, "finance.view") && (
                    <span className="chip">
                      {t("fin.costs")}: {money(inv.costs, inv.currency)}
                    </span>
                  )}
                </div>
                {!!inv.flags?.length && (
                  <div className="note fin-flags small">
                    <b>{t("fin.flags")}</b>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                      {inv.flags.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Sec>

          {/* 03 itens */}
          <Sec
            n={3}
            title={t("fin.sec.items")}
            right={
              <button className="btn ghost small" onClick={() => setJsonOpen((o) => !o)}>
                {"{ }"} JSON
              </button>
            }
          >
            {jsonOpen && (
              <InvoiceJsonBox
                initial={jsonText}
                actions={[
                  { label: t("fin.jsonReplace"), mode: "replace", primary: true },
                  { label: t("fin.jsonAppend"), mode: "append" },
                ]}
                onApply={({ items, patch }, mode) => {
                  update((x) => ({ ...x, ...patch, client: patch.client ?? x.client, items: mode === "replace" ? items : [...x.items.filter((i) => i.description), ...items] }));
                  setToast(t("fin.jsonOk", { n: items.length }));
                  setJsonOpen(false);
                  setJsonText("");
                }}
              />
            )}
            <div className="items">
              <div className="items-head label muted">
                <span>{t("fin.item.desc")}</span>
                <span>{t("fin.item.qty")}</span>
                <span>{t("fin.item.rate")}</span>
                <span className="r">{t("fin.item.subtotal")}</span>
                <span />
              </div>
              {tt.lines.map((l) => (
                <div key={l.id} className="items-row">
                  <label className="items-cell desc">
                    <span className="items-lab">{t("fin.item.desc")}</span>
                    <AutoText className="input" aria-label={t("fin.item.desc")} placeholder="® [MM] …" value={l.description} onChange={(v) => setItem(l.id, { description: v })} />
                  </label>
                  <label className="items-cell">
                    <span className="items-lab">{t("fin.item.qty")}</span>
                    <input className="input" aria-label={t("fin.item.qty")} inputMode="decimal" defaultValue={l.qty} onChange={(e) => setItem(l.id, { qty: num(e.target.value) })} />
                  </label>
                  <label className="items-cell">
                    <span className="items-lab">{t("fin.item.rate")}</span>
                    <input className="input" aria-label={t("fin.item.rate")} inputMode="decimal" defaultValue={l.rate} onChange={(e) => setItem(l.id, { rate: num(e.target.value) })} />
                  </label>
                  <span className="items-cell sub">
                    <span className="items-lab">{t("fin.item.subtotal")}</span>
                    <span className="mono r small">{money(l.subtotal, inv.currency)}</span>
                  </span>
                  <button className="btn ghost small" aria-label={t("remove")} onClick={() => update((x) => ({ ...x, items: x.items.filter((i) => i.id !== l.id) }))}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
              <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => update((x) => ({ ...x, items: [...x.items, { id: crypto.randomUUID(), description: "", qty: 1, rate: 0 }] }))}>
                + {t("fin.addItem")}
              </button>
            </div>
          </Sec>

          {/* 04 BTW */}
          <Sec n={4} title={t("fin.sec.btw")}>
            <div className="seg" role="group" style={{ alignSelf: "flex-start" }}>
              {(["auto", 21, 9, 0] as BtwSetting[]).map((b) => (
                <button key={String(b)} aria-pressed={inv.btw === b} onClick={() => set("btw", b)}>
                  {b === "auto" ? t("fin.btw.auto") : `${b}%`}
                </button>
              ))}
            </div>
            <span className="muted small">{t(`fin.btw.${tt.btw.reason}`)}</span>
            {tt.btw.reason === "eu_reverse" && !inv.client.vat && <p className="note">{t("fin.vatMissing")}</p>}
            <div className="sumbox">
              <div>
                <span>{t("fin.subtotal")}</span>
                <b className="mono">{money(tt.subtotal, inv.currency)}</b>
              </div>
              <div>
                <span>{tt.btw.label || "BTW —"}</span>
                <b className="mono">{money(tt.btwAmount, inv.currency)}</b>
              </div>
              <div className="sum-total">
                <span>{t("fin.total")}</span>
                <b className="mono">{money(tt.total, inv.currency)}</b>
              </div>
            </div>
          </Sec>

          {/* 05 nota */}
          <Sec n={5} title={t("fin.sec.note")}>
            <AutoText multiline minRows={4} className="textarea" value={inv.note} placeholder={t("fin.notePh")} onChange={(v) => set("note", v)} />
          </Sec>

          {/* 06 pagamento */}
          <Sec n={6} title={t("fin.sec.payment")}>
            {(["epc", "link", "none"] as QrMode[]).map((m) => (
              <label key={m} className="row" style={{ gap: 10 }}>
                <input type="radio" name="qr" checked={inv.payment.qr === m} onChange={() => update((x) => ({ ...x, payment: { ...x.payment, qr: m } }))} />
                {t(`fin.qr.${m}`)}
              </label>
            ))}
            {inv.payment.qr === "epc" && inv.currency !== "EUR" && <p className="note">{t("fin.qr.eurOnly")}</p>}
            {inv.payment.qr === "link" && (
              <input className="input" type="url" placeholder={t("fin.qr.linkPh")} value={inv.payment.link} onChange={(e) => update((x) => ({ ...x, payment: { ...x.payment, link: e.target.value } }))} />
            )}
            <label className="field" style={{ maxWidth: 160 }}>
              <span>{t("fin.termsDays")}</span>
              <input className="input" type="number" min={0} value={inv.payment.termsDays} onChange={(e) => update((x) => ({ ...x, payment: { ...x.payment, termsDays: Math.max(0, parseInt(e.target.value || "0", 10)) } }))} />
            </label>
          </Sec>

          {/* 07 capa */}
          <Sec n={7} title={t("fin.sec.cover")}>
            <div className="grid3">
              {(["line1", "line2", "title"] as const).map((k) => (
                <label key={k} className="field">
                  <span>{t(`fin.cover.${k}`)}</span>
                  <input className="input" value={inv.cover[k]} onChange={(e) => update((x) => ({ ...x, cover: { ...x.cover, [k]: e.target.value } }))} />
                </label>
              ))}
            </div>
            <label className="field">
              <span>{t("fin.cover.text")}</span>
              <AutoText multiline minRows={3} className="textarea" value={inv.cover.text} onChange={(v) => update((x) => ({ ...x, cover: { ...x.cover, text: v } }))} />
            </label>
          </Sec>

          {/* 08 cores */}
          <Sec n={8} title={t("fin.sec.colors")}>
            <div className="row">
              {Object.entries(THEMES).map(([k, th]) => (
                <button key={k} className="themechip" onClick={() => setTheme(th)} aria-label={t(`fin.theme.${k}` as "fin.theme.original")}>
                  <i style={{ background: th.bg, borderColor: th.ink }}>
                    <b style={{ background: th.accent }} />
                  </i>
                  {t(`fin.theme.${k}` as "fin.theme.original")}
                </button>
              ))}
            </div>
            <div className="colorgrid">
              {(["bg", "ink", "coverInk", "accent", "total", "dots"] as (keyof InvoiceTheme)[]).map((k) => (
                <label key={k} className="colorin">
                  <input type="color" value={inv.theme[k]} onChange={(e) => setTheme({ [k]: e.target.value.toUpperCase() })} />
                  <span>
                    {t(`fin.color.${k}`)}
                    <em className="mono">{inv.theme[k]}</em>
                  </span>
                </label>
              ))}
            </div>
          </Sec>
        </div>

        <aside className="invpreview">
          <div className="invpreview-box">
            {pdfUrl ? <iframe src={`${pdfUrl}#view=FitH&toolbar=0`} title={t("fin.preview")} /> : <p className="muted small">{t("fin.generating")}</p>}
            {rendering && <span className="invbadge label">{t("fin.generating")}</span>}
          </div>
          {pdfUrl && (
            <a className="btn ghost small only-narrow" href={pdfUrl} target="_blank" rel="noreferrer">
              <Icon name="arrow" size={14} /> {t("fin.preview")}
            </a>
          )}
        </aside>
      </div>
      <DropOverlay show={dropping} label={t("fin.dropItems")} />
      <Toast msg={toast} />
    </AppShell>
  );
}

function Sec({ n, title, right, children }: { n: number; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="w stack">
      <div className="w-head">
        <span className="label">
          <b>{pad(n)}</b>
          {title}
        </span>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Texto que cresce em altura: nunca fica cortado (uma linha para nome/descrição; `multiline` para morada, nota…). */
function AutoText({ value, onChange, className, placeholder, "aria-label": aria, multiline, minRows = 1 }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; "aria-label"?: string; multiline?: boolean; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  };
  useEffect(fit, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit); // a largura muda → volta a medir
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      className={`${className ?? ""} autotext`}
      value={value}
      placeholder={placeholder}
      aria-label={aria}
      onChange={(e) => onChange(multiline ? e.target.value : e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => !multiline && e.key === "Enter" && e.preventDefault()}
    />
  );
}
