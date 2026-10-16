"use client";

import { Icon } from "@/components/Icon";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LangSwitch, Toast, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { ApiError, memberApi, type MyData } from "@/lib/memberApi";
import {
  CURRENCIES,
  FALLBACK_RATES,
  convert,
  entryMinutes,
  fetchRates,
  fmtHours,
  fmtMoney,
  monthRange,
  monthSummary,
  shiftMonth,
  type Currency,
  type Rates,
} from "@/lib/team";
import { isoDay, pad } from "@/lib/util";

const LS_CUR = "xmedia:cur";
const SYMBOL: Record<Currency, string> = { EUR: "€", GBP: "£", BRL: "R$" };
type Tab = "hours" | "close" | "profile";

export default function Page() {
  return (
    <Suspense>
      <MyArea />
    </Suspense>
  );
}

/** Área do funcionário (login por código). Perfil no estilo do cartão "Anna K.", tema claro. */
function MyArea() {
  const { t, locale } = useT();
  const router = useRouter();
  const tab = (useSearchParams().get("tab") as Tab) || "profile";
  const [toast, setToast] = useToast();
  const [month, setMonth] = useState(isoDay().slice(0, 7));
  const [data, setData] = useState<MyData | null>(null);
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES);
  const [cur, setCur] = useState<Currency>("EUR");

  // tema claro só nesta área
  useEffect(() => {
    document.documentElement.classList.add("paper");
    return () => document.documentElement.classList.remove("paper");
  }, []);

  useEffect(() => {
    try {
      const c = localStorage.getItem(LS_CUR) as Currency | null;
      if (c && CURRENCIES.includes(c)) setCur(c);
    } catch {}
    fetchRates().then(setRates);
  }, []);

  const load = useCallback(async () => {
    try {
      setData(await memberApi.me(month));
    } catch (e) {
      if (e instanceof ApiError && e.message === "unauthorized") location.href = "/login";
      else setToast((e as Error).message);
    }
  }, [month, setToast]);
  useEffect(() => {
    load();
  }, [load]);

  const go = (k: Tab) => {
    router.replace(k === "profile" ? "/eu" : `/eu?tab=${k}`, { scroll: false });
    window.scrollTo({ top: 0 });
  };
  function pickCur(c: Currency) {
    setCur(c);
    try {
      localStorage.setItem(LS_CUR, c);
    } catch {}
  }
  async function logout() {
    await memberApi.logout();
    location.href = "/login";
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const entry = {
      date: String(fd.get("date")),
      start: String(fd.get("start")),
      end: String(fd.get("end")),
      break_min: Math.max(0, parseInt(String(fd.get("break") || "0"), 10) || 0),
      project: String(fd.get("project") ?? "").trim(),
      note: String(fd.get("note") ?? "").trim(),
    };
    if (!entryMinutes(entry)) return setToast(t("tm.badTime"));
    try {
      await memberApi.addEntry(entry);
      form.reset();
      setToast(t("tm.logged"));
      load();
    } catch (err) {
      setToast(err instanceof ApiError && err.message === "month_closed" ? t("me.month_closed") : (err as Error).message);
    }
  }
  async function remove(id: string) {
    if (!confirm(t("removeConfirm", { what: t("tm.hours").toLowerCase() }))) return;
    await memberApi.removeEntry(id).catch((e) => setToast(e.message));
    load();
  }

  const mDate = new Date(month + "-15T12:00:00");
  const monthName = mDate.toLocaleDateString(locale, { month: "long" });
  const monthLabel = mDate.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const m = data?.member;
  const s = m ? monthSummary(m, data!.entries) : null;
  const close = data?.close ?? null;
  const amount = close ? close.amount : s?.amount ?? 0;
  const base: Currency = close ? close.rate_currency : m?.rate_currency ?? "EUR";
  const earned = fmtMoney(convert(amount, base, cur, rates), cur, locale);
  const today = isoDay();
  const title = tab === "hours" ? t("tm.tab.hours") : tab === "close" ? t("tm.tab.close") : t("nav.profile");

  const monthNav = (
    <div className="pp-month">
      <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("cal.prev")}>
        <Icon name="back" size={14} />
      </button>
      <span>{monthLabel}</span>
      <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("cal.next")}>
        <Icon name="next" size={14} />
      </button>
    </div>
  );

  return (
    <main className="pp">
      <header className="pp-top">
        <span>{title}</span>
        <span>{pad(mDate.getMonth() + 1)}</span>
      </header>

      {m && s && tab === "profile" && (
        <>
          <section className="pp-hero">
            <div className="pp-photo">
              {m.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photo_url} alt={m.name} referrerPolicy="no-referrer" />
              ) : (
                <span className="pp-initials">{m.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
              )}
            </div>
            <div className="pp-count">
              <span className="pp-big" aria-label={t("me.hoursIn", { month: monthName })}>
                {pad(Math.floor(s.minutes / 60))}
              </span>
              <span className="pp-label">
                <i className="pp-dot" /> {close ? (close.paid ? t("tm.paid") : t("tm.closed")) : t("me.activeNow")}
              </span>
              <span className="pp-sub">
                {t("tm.rate")} <b>{new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(m.rate)}</b> {SYMBOL[m.rate_currency]}
              </span>
            </div>
          </section>

          <h1 className="pp-name">{m.name}</h1>
          <div className="pp-label" style={{ marginTop: 14, display: "flex" }}>
            {m.role || "—"}
          </div>
          {m.city && (
            <a className="pp-city" href={`https://maps.google.com/?q=${encodeURIComponent(m.city)}`} target="_blank" rel="noreferrer">
              {m.city} <span className="pp-arrow"><Icon name="arrow" size={14} /></span>
            </a>
          )}
          <hr className="pp-rule" />

          {m.description && (
            <section className="pp-sec">
              <div className="pp-label">{t("pf.bio")}</div>
              <p className="pp-about">{m.description}</p>
            </section>
          )}
          {m.responsibilities.length > 0 && (
            <section className="pp-sec">
              <div className="pp-label">{t("tm.resp")}</div>
              <div className="pp-tags">
                {m.responsibilities.map((r) => (
                  <span key={r}>{r}</span>
                ))}
              </div>
            </section>
          )}

          {/* cartão (ref. "Connect card") → valor a receber */}
          <button className="pp-card" onClick={() => go("close")}>
            <span className="pp-card-head">
              <span className="pp-label">{t("tm.earned")}</span>
              <span className="pp-label">{pad(mDate.getMonth() + 1)}</span>
            </span>
            <span className="pp-card-body">
              <span className="pp-card-text">
                <b data-testid="my-earned">{earned}</b> {t("me.inMonth", { month: monthName })}
              </span>
              <span className="pp-dots" aria-hidden />
            </span>
            <span className="pp-card-foot pp-label">
              {t("me.viewClose")} <span className="pp-arrow"><Icon name="arrow" size={14} /></span>
            </span>
          </button>

          <section className="pp-stats">
            <button onClick={() => go("hours")}>
              <span className="pp-label">{t("tm.days")}</span>
              <span className="pp-num">
                {pad(s.days)} <span className="pp-arrow"><Icon name="arrow" size={14} /></span>
              </span>
            </button>
            <button onClick={() => go("hours")}>
              <span className="pp-label">{t("me.records")}</span>
              <span className="pp-num">
                {pad(data!.entries.length)} <span className="pp-arrow"><Icon name="arrow" size={14} /></span>
              </span>
            </button>
          </section>

          <section className="pp-foot">
            <LangSwitch />
            <span className="muted small">
              {m.code_hint && (
                <>
                  {t("inv.code")} <span className="mono">{m.code_hint}</span> ·{" "}
                </>
              )}
              <Icon name="lock" size={14} /> {t("me.readonly")}
            </span>
            <button className="pp-link" onClick={logout}>
              {t("me.logout")} <Icon name="arrow" size={14} />
            </button>
          </section>
        </>
      )}

      {m && s && tab === "hours" && (
        <>
          {monthNav}
          <div className="pp-summary">
            <span className="pp-big sm">{fmtHours(s.minutes)}</span>
            <span className="pp-label">{t("me.hoursIn", { month: monthName })}</span>
          </div>
          {close ? (
            <p className="note">{t("tm.locked")}</p>
          ) : (
            <form className="stack pp-form" onSubmit={add}>
              <div className="hoursgrid">
                <label className="field">
                  <span>{t("tm.date")}</span>
                  <input
                    className="input"
                    type="date"
                    name="date"
                    required
                    defaultValue={today.startsWith(month) ? today : `${month}-01`}
                    min={monthRange(month).from}
                    max={monthRange(month).to}
                  />
                </label>
                <label className="field">
                  <span>{t("tm.start")}</span>
                  <input className="input" type="time" name="start" required />
                </label>
                <label className="field">
                  <span>{t("tm.end")}</span>
                  <input className="input" type="time" name="end" required />
                </label>
                <label className="field">
                  <span>{t("tm.break")}</span>
                  <input className="input" type="number" name="break" min={0} step={5} defaultValue={0} inputMode="numeric" />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span>{t("tm.project")}</span>
                  <input className="input" name="project" />
                </label>
                <label className="field">
                  <span>{t("tm.note")}</span>
                  <input className="input" name="note" />
                </label>
              </div>
              <div>
                <button className="btn solid" type="submit">
                  + {t("tm.log")}
                </button>
              </div>
            </form>
          )}
          {data!.entries.length === 0 ? (
            <p className="muted">{t("tm.noEntries")}</p>
          ) : (
            <ol className="timeline">
              {data!.entries.map((e) => (
                <li key={e.id}>
                  <span className="mono small tl-time">
                    {new Date(e.date + "T12:00:00").toLocaleDateString(locale, { weekday: "short", day: "2-digit" })}
                  </span>
                  <div className="row between" style={{ flexWrap: "nowrap", gap: 10 }}>
                    <span style={{ minWidth: 0 }}>
                      <span className="mono">
                        {e.start}–{e.end}
                      </span>
                      {e.break_min > 0 && <span className="muted small"> · −{e.break_min}′</span>}
                      {(e.project || e.note) && (
                        <span className="muted small" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {[e.project, e.note].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                      <b className="mono">{fmtHours(entryMinutes(e))}</b>
                      {!close && (
                        <button className="btn ghost small" onClick={() => remove(e.id)} aria-label={t("remove")}>
                          <Icon name="close" size={14} />
                        </button>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {m && s && tab === "close" && (
        <>
          {monthNav}
          <div className="pp-summary">
            <span className="pp-big sm">{earned}</span>
            <span className="pp-label">
              <i className="pp-dot" />{" "}
              {close ? `${close.paid ? t("tm.paid") : t("tm.unpaid")} · ${t("tm.closedOn", { date: new Date(close.closed_at).toLocaleDateString(locale) })}` : t("tm.earned")}
            </span>
          </div>
          <div className="seg" role="group" aria-label={t("tm.currency")} style={{ marginBottom: 16 }}>
            {CURRENCIES.map((c) => (
              <button key={c} aria-pressed={cur === c} onClick={() => pickCur(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="closegrid">
            {CURRENCIES.map((c) => (
              <div key={c} className={`closecell ${c === base ? "base" : ""}`}>
                <span className="label muted">{c}</span>
                <span className="pp-num" style={{ fontSize: 20 }}>
                  {fmtMoney(convert(amount, base, c, rates), c, locale)}
                </span>
              </div>
            ))}
          </div>
          <p className="muted small">
            {fmtHours(close ? close.minutes : s.minutes)} × {fmtMoney(close ? close.rate : m.rate, base, locale)}
            {t("tm.perHour")} · {t("tm.sameValue")}
          </p>
          <p className="muted small">
            {rates.date ? t("tm.fx", { gbp: rates.rates.GBP.toFixed(4), brl: rates.rates.BRL.toFixed(4), date: rates.date }) : t("tm.fxOffline")}
          </p>
        </>
      )}

      {/* barra inferior (ref.: Discover · Messages · Profile) */}
      <nav className="pp-nav" aria-label="main">
        {(["hours", "close", "profile"] as Tab[]).map((k) => (
          <button key={k} aria-current={tab === k ? "page" : undefined} onClick={() => go(k)}>
            <i />
            <span>{k === "hours" ? t("tm.tab.hours") : k === "close" ? t("tm.tab.close") : t("nav.profile")}</span>
          </button>
        ))}
      </nav>
      <Toast msg={toast} />
    </main>
  );
}
