"use client";

// Avaliações dos clientes: NPS, satisfação por dimensão vs. referência do mercado, pontos fracos e pedidos
// de avaliação (link de uso único por email).
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ExpandedActions, RowActions, useRowExpand, type RowAction } from "@/components/RowActions";
import { Ring, Tile } from "@/components/bento";
import { AppShell, Toast, useToast } from "@/components/ui";
import { useAccess } from "@/lib/access";
import { CUSTOMER_SAVED, customerStore } from "@/lib/customerStore";
import type { Customer } from "@/lib/customer";
import { BENCHMARK, FB_DIMS, collect, requestState, roundOf, summarize } from "@/lib/feedback";
import { feedbackApi, type SendResult } from "@/lib/feedbackApi";
import { LANGS, useT, type Key, type Lang } from "@/lib/i18n";
import { can } from "@/lib/roles";
import { supabaseEnabled } from "@/lib/supabase/client";

export default function FeedbackPage() {
  const { t, locale } = useT();
  const access = useAccess();
  const [toast, setToast] = useToast();
  const [list, setList] = useState<Customer[] | null>(null);
  const [asking, setAsking] = useState<Customer | null | "pick">(null);
  const load = useCallback(() => customerStore.list().then(setList).catch((e) => setToast((e as Error).message)), [setToast]);
  useEffect(() => {
    load();
    window.addEventListener(CUSTOMER_SAVED, load);
    return () => window.removeEventListener(CUSTOMER_SAVED, load);
  }, [load]);

  const { responses, sent } = useMemo(() => collect(list ?? []), [list]);
  const s = useMemo(() => summarize(responses, sent), [responses, sent]);
  const edit = can(access, "customers.edit");
  const { isOpen, onRow } = useRowExpand();
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  const dimLabel = (d: string) => t(`fb.dim.${d}` as Key).split(" — ")[0];
  const round = roundOf();
  const requests = (list ?? [])
    .flatMap((c) => (c.feedback?.requests ?? []).map((r) => ({ c, r, st: requestState(r, c.feedback!.requests) })))
    .sort((a, b) => b.r.sent_at.localeCompare(a.r.sent_at));

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("fb.dashSub")}</span>
          <h1 className="h1">{t("nav.feedback")}</h1>
        </div>
        {edit && (
          <button className="btn accent" onClick={() => setAsking("pick")} data-testid="fb-request">
            <Icon name="mail" size={14} /> {t("fb.request")}
          </button>
        )}
      </section>

      <section className="widgets" style={{ paddingTop: 0 }}>
        <div className="w tile span-3" data-testid="fb-nps">
          <div className="tile-head">
            <span className="tile-t">{t("fb.nps")}</span>
          </div>
          <Ring value={s.nps === null ? 0 : (s.nps + 100) / 200}>
            <span className="tile-num">{s.nps ?? "—"}</span>
            <div className="tile-t" style={{ marginTop: 8, fontSize: 10.5 }}>
              {t("fb.npsMarket", { n: BENCHMARK.nps.market, top: BENCHMARK.nps.top })}
            </div>
          </Ring>
        </div>
        <Tile span={3} tone="blue" title={t("fb.csat")} value={s.csat === null ? "—" : `${s.csat}%`} of={`/ ${BENCHMARK.csat}%`} foot={<span>{t("fb.csatHint", { n: BENCHMARK.csat })}</span>} />
        <Tile span={3} title={t("fb.responses")} value={s.n} of={`/ ${s.sent}`} foot={<><span>{t("fb.rate")}</span><span>{s.rate === null ? "—" : `${s.rate}%`}</span></>} />
        <div className="w tile span-3">
          <div className="tile-head">
            <span className="tile-t">
              {t("fb.promoters")} / {t("fb.detractors")}
            </span>
          </div>
          <div className="fbd-split" aria-hidden>
            {s.n > 0 && (
              <>
                <i className="p" style={{ flex: s.promoters }} />
                <i className="n" style={{ flex: s.passives }} />
                <i className="d" style={{ flex: s.detractors }} />
              </>
            )}
          </div>
          <div className="fbd-legend mono small">
            <span>
              <i className="p" /> {t("fb.promoters")} {s.promoters}
            </span>
            <span>
              <i className="n" /> {t("fb.passives")} {s.passives}
            </span>
            <span>
              <i className="d" /> {t("fb.detractors")} {s.detractors}
            </span>
          </div>
        </div>

        <section className="w span-8 stack">
          <span className="tile-t">{t("fb.dims")}</span>
          <div className="fbd-dims">
            {s.dims.map((d) => (
              <div key={d.dim} className="fbd-dim">
                <span className="small">{dimLabel(d.dim)}</span>
                <div className="fbd-track" title={`${d.avg ?? "—"} / 5 · ref. ${d.bench}`}>
                  <i style={{ width: `${((d.avg ?? 0) / 5) * 100}%` }} className={d.gap !== null && d.gap < 0 ? "low" : ""} />
                  <b style={{ left: `${(d.bench / 5) * 100}%` }} />
                </div>
                <span className="mono small">
                  {d.avg ?? "—"}
                  {d.gap !== null && <span className={d.gap < 0 ? "tone-danger" : "tone-ok"}> {d.gap > 0 ? "+" : ""}{d.gap}</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            {t("fb.benchNote")}
          </p>
        </section>

        <section className="w tile sand span-4">
          <span className="tile-t">{t("fb.focus")}</span>
          {s.weak.length ? (
            <ol className="fbd-focus">
              {s.weak.slice(0, 3).map((d) => {
                const x = s.dims.find((y) => y.dim === d)!;
                return (
                  <li key={d}>
                    <b>{dimLabel(d)}</b>
                    <span className="mono small">
                      {x.avg} vs {x.bench}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="tile-text">{s.n ? t("fb.focusNone") : t("fb.none")}</p>
          )}
          {s.strong.length > 0 && (
            <div className="tile-sep">
              <span>{t("fb.strong")}</span>
              <span>{s.strong.slice(0, 2).map(dimLabel).join(" · ")}</span>
            </div>
          )}
        </section>

        <section className="w span-4 stack">
          <span className="tile-t">{t("fb.themes")}</span>
          {s.themes.length ? (
            s.themes.map((x) => (
              <div key={x.theme} className="statrow">
                <span style={{ flex: 1 }}>{t(`fb.theme.${x.theme}` as Key)}</span>
                <span className="mono">{x.n}</span>
              </div>
            ))
          ) : (
            <p className="muted small">—</p>
          )}
        </section>

        <section className="w span-8 stack">
          <span className="tile-t">{t("fb.comments")}</span>
          {!responses.length && <p className="muted">{t("fb.none")}</p>}
          {responses.map((r, i) => (
            <article key={i} className="fbd-c">
              <header className="row between">
                <b>{r.customer}</b>
                <span className="mono small">
                  <span className={r.answers.nps >= 9 ? "tone-ok" : r.answers.nps <= 6 ? "tone-danger" : "tone-warn"}>NPS {r.answers.nps}</span> · {date(r.at)}
                </span>
              </header>
              {r.answers.improve && (
                <p>
                  <span className="label muted">{t("fb.q.improve")}</span>
                  <br />
                  {r.answers.improve}
                </p>
              )}
              {r.answers.best && (
                <p>
                  <span className="label muted">{t("fb.q.best")}</span>
                  <br />
                  {r.answers.best}
                </p>
              )}
              {r.answers.testimonial && r.answers.quote && <blockquote className="fbd-q">“{r.answers.quote}” — {r.name}</blockquote>}
            </article>
          ))}
        </section>

        <section className="w span-12 stack">
          <div className="row between">
            <span className="tile-t">
              {t("fb.requests")} · {t("fb.round")} {round}
            </span>
          </div>
          {!requests.length ? (
            <p className="muted small">{t("fb.none")}</p>
          ) : (
            <div className="tablewrap">
              <table className="table rt">
                <thead>
                  <tr>
                    <th>{t("fb.customer")}</th>
                    <th>{t("fin.col.date")}</th>
                    <th>{t("fin.col.status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {requests.map(({ c, r, st }) => {
                    const actions: RowAction[] = [
                      { key: "open", label: t("ra.open"), icon: "eye", href: `/clientes/${c.id}` },
                      { key: "resend", label: t("fb.request"), icon: "mail", onClick: () => setAsking(c), allowed: edit && st !== "used" },
                    ];
                    const open = isOpen(r.id);
                    return (
                      <Fragment key={r.id}>
                        <tr className={open ? "open has-exp" : ""} style={{ cursor: "pointer" }} onClick={() => onRow(r.id)}>
                          <td className="rt-main">
                            <span style={{ minWidth: 0 }}>
                              <span className="cell-title">{c.name}</span>
                              <span className="muted small" style={{ display: "block" }}>
                                {r.email} · {r.round}
                              </span>
                            </span>
                            <span className="rt-chev"><Icon name="chevronDown" size={14} /></span>
                          </td>
                          <td className="mono small" data-label={t("fin.col.date")}>
                            {date(r.sent_at)}
                          </td>
                          <td data-label={t("fin.col.status")}>
                            <span className={`label ${st === "used" ? "tone-ok" : st === "expired" ? "muted" : "tone-warn"}`}>{t(`fb.st.${st === "invalid" ? "expired" : st}` as Key)}</span>
                          </td>
                          <td className="rt-act">
                            <RowActions actions={actions} />
                          </td>
                        </tr>
                        <tr className={`rt-exp ${open ? "open" : ""}`}>
                          <td colSpan={4}>
                            <ExpandedActions actions={actions} />
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {asking && list && (
        <RequestDialog
          customers={list}
          initial={asking === "pick" ? null : asking}
          onClose={() => setAsking(null)}
          onDone={(m) => {
            setToast(m);
            load();
          }}
        />
      )}
      <Toast msg={toast} />
    </AppShell>
  );
}

function RequestDialog({ customers, initial, onClose, onDone }: { customers: Customer[]; initial: Customer | null; onClose: () => void; onDone: (msg: string) => void }) {
  const { t } = useT();
  const [id, setId] = useState(initial?.id ?? "");
  const c = customers.find((x) => x.id === id) ?? null;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState<Lang>("en"); // emails em inglês por omissão
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<SendResult | null>(null);
  useEffect(() => {
    if (!c) return;
    setEmail(c.email || c.billing?.email || "");
    setName(c.contact || c.billing?.contact || c.name);
    setLang(c.lang);
    setRes(null);
    setErr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const answered = !!c?.feedback?.requests.some((r) => r.round === roundOf() && r.used_at);
  const valid = !!c && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && !answered;

  async function go(send: boolean) {
    if (!c) return;
    if (send && !confirm(t("fb.confirm", { email: email.trim() }))) return;
    setBusy(true);
    setErr("");
    try {
      const r = await feedbackApi.send(c, { email: email.trim(), name: name.trim(), lang, send });
      setRes(r);
      onDone(r.sent ? t("fb.sent", { email: email.trim() }) : t("fb.linkReady"));
    } catch (e) {
      const m = (e as Error).message;
      setErr(m === "already_answered" ? t("fb.alreadyAnswered") : m);
    }
    setBusy(false);
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog stack" role="dialog" aria-modal="true" style={{ maxWidth: 560 }}>
        <div className="row between">
          <b>{t("fb.requestTitle")}</b>
          <button className="btn ghost" onClick={onClose} aria-label={t("close")}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <label className="field">
          <span>{t("fb.customer")}</span>
          <Select className="select" value={id} onChange={(e) => setId(e.target.value)} data-testid="fb-customer">
            <option value="">—</option>
            {[...customers]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </Select>
        </label>
        <div className="grid4" style={{ gridTemplateColumns: "2fr 1.4fr 1fr" }}>
          <label className="field">
            <span>{t("fb.email")}</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="fb-email" />
          </label>
          <label className="field">
            <span>{t("fb.name")}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("fb.lang")}</span>
            <Select className="select" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {answered && <p className="note tone-ok small">{t("fb.alreadyAnswered")}</p>}
        {!supabaseEnabled && <p className="muted small">{t("fb.localNote")}</p>}
        {err && <p className="note tone-danger small">{err}</p>}
        <div className="row">
          <button className="btn accent" onClick={() => go(true)} disabled={busy || !valid || !supabaseEnabled}>
            <Icon name="mail" size={14} /> {t("fb.sendEmail")}
          </button>
          <button className="btn" onClick={() => go(false)} disabled={busy || !valid} data-testid="fb-link">
            {t("fb.onlyLink")}
          </button>
        </div>
        {res && (
          <div className="jsonbox stack">
            <span className={`small ${res.sent ? "tone-ok" : "tone-warn"}`}>{res.sent ? t("fb.sent", { email }) : `${t("fb.linkReady")}${res.reason && res.reason !== "local_mode" ? ` (${res.reason})` : ""}`}</span>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input className="input mono" readOnly value={res.link} onFocus={(e) => e.target.select()} data-testid="fb-linkval" />
              <button
                className="btn"
                onClick={() => {
                  navigator.clipboard?.writeText(res.link);
                  onDone(t("fb.copied"));
                }}
              >
                {t("fb.copy")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
