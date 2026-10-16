"use client";

// Ficha de um serviço — análise linear ponto a ponto:
// 01 o que é · 02 preço e valor · 03 é este ou outro? · 04 descontos · 05 simulação por horas · 06 mercado · 07 margem · 08 histórico.
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ServiceEditor } from "@/components/services/Editor";
import { MarketBar, VerdictBadge, useCatalog, useMoney } from "@/components/services/parts";
import { AppShell, Toast, useToast } from "@/components/ui";
import { useAccess } from "@/lib/access";
import { useT, type Key } from "@/lib/i18n";
import { can } from "@/lib/roles";
import { serviceStore } from "@/lib/serviceStore";
import { alternatives, hourlyOf, marginOf, marketPosition, priceForMargin, quote, recurringPct, unitsForHours, type Service } from "@/lib/services";

const STEPS = ["what", "price", "when", "discounts", "sim", "market", "margin", "history"] as const;

function Step({ n, id, title, children }: { n: number; id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="sv-step" id={id}>
      <div className="sv-step-n mono">{String(n).padStart(2, "0")}</div>
      <div className="sv-step-body">
        <h2 className="h2">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function DetailInner() {
  const { t, locale } = useT();
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const money = useMoney();
  const access = useAccess();
  const edit = can(access, "proposals.edit");
  const [toast, setToast] = useToast();
  const { catalog } = useCatalog();
  const [editing, setEditing] = useState(params.get("editar") === "1");
  const [hours, setHours] = useState(0);
  const [partner, setPartner] = useState(false);
  const [months, setMonths] = useState(0);
  const [rush, setRush] = useState(false);

  const s = useMemo(() => catalog?.services.find((x) => x.id === decodeURIComponent(id)), [catalog, id]);
  useEffect(() => {
    if (s && !hours) setHours(s.unit === "hour" ? 1 : s.hours || 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.id]);

  if (!catalog) return <AppShell><p className="muted">…</p></AppShell>;
  if (!s)
    return (
      <AppShell>
        <p className="muted w">{t("sv.notFound")}</p>
        <Link href="/servicos" className="btn">
          <Icon name="back" size={14} /> {t("sv.back")}
        </Link>
      </AppShell>
    );

  const rules = catalog.rules;
  const folder = catalog.folders.find((f) => f.id === s.folder);
  const h = hourlyOf(s);
  const m = marginOf(s.price, s.crp);
  const pos = marketPosition(s);
  const alts = alternatives(s, catalog.services);
  const units = s.unit === "trip" ? 1 : unitsForHours(s, hours || 1);
  const sim = quote({ client: { name: "" }, lines: [{ service_id: s.id, qty: units }], partner, recurring_months: months, rush }, catalog.services, rules);
  const line = sim.lines[0];
  const maxDisc = s.pass_through || s.price <= 0 ? 0 : Math.max(0, Math.floor((1 - s.crp / (s.price * (1 - s.min_margin / 100))) * 1000) / 10);
  const isReel = (s.kind === "edit" || s.kind === "reel") && (s.unit === "item" || s.unit === "hour");
  const hoursApplies = !s.pass_through && s.unit !== "item" && s.kind !== "travel" && (s.kind !== "capture" || rules.hours_on_capture);
  const date = (iso: string) => new Date(iso).toLocaleString(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  async function act(f: () => Promise<unknown>, msg = t("sv.saved")) {
    try {
      await f();
      setToast(msg);
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  const duplicate = () =>
    act(async () => {
      const copy: Service = { ...s!, id: `${s!.id}-copy-${Date.now().toString(36).slice(-4)}`, name: `${s!.name} (copy)`, uses: 0, history: [] };
      await serviceStore.saveService(copy, "admin");
      router.push(`/servicos/${copy.id}?editar=1`);
    });
  const remove = () => confirm(t("sv.deleteConfirm", { name: s.name })) && act(async () => (await serviceStore.removeService(s.id), router.push("/servicos")));

  return (
    <AppShell>
      <section className="pagehead sv-dhead" style={{ ["--fc" as string]: folder?.color ?? "var(--accent)" }}>
        <div style={{ minWidth: 0 }}>
          <Link href={`/servicos?pasta=${s.folder}`} className="label muted">
            <Icon name="back" size={14} /> {t("sv.back")} / <span className="sv-fdot" /> {folder?.label ?? s.folder}
          </Link>
          <h1 className="h1" style={{ marginTop: 10 }}>
            {s.name}
          </h1>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            {s.plan && <span className="sv-chip">{t(`sv.plan.${s.plan}` as Key)}</span>}
            {s.tier && <span className={`sv-chip${s.tier === "pro" ? " pro" : ""}`}>{t(`sv.tier.${s.tier}` as Key)}</span>}
            <span className="sv-chip">{t(`sv.pot.${s.potential}` as Key)}</span>
            <VerdictBadge s={s} rules={rules} />
            {s.archived && <span className="label tone-warn">{t("sv.archived")}</span>}
          </div>
        </div>
        <div className="row">
          {edit && (
            <>
              <button className="btn" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
                {t("sv.edit")}
              </button>
              <button className="btn ghost small" onClick={duplicate}>
                <Icon name="copy" size={14} /> {t("sv.duplicate")}
              </button>
              <button className="btn ghost small" onClick={() => act(() => serviceStore.saveService({ ...s, archived: !s.archived }, "admin"))}>
                {s.archived ? t("sv.unarchive") : t("sv.archive")}
              </button>
              <button className="btn ghost small danger" onClick={remove}>
                <Icon name="close" size={14} />
              </button>
            </>
          )}
          <Link href={`/servicos/calculadora?add=${encodeURIComponent(s.id)}&qty=${units}`} className="btn accent">
            + {t("sv.sim.toCalc")}
          </Link>
        </div>
      </section>

      {editing && edit && (
        <ServiceEditor
          service={s}
          folders={catalog.folders}
          rules={rules}
          onSaved={(n) => {
            setEditing(false);
            setToast(t("sv.saved"));
            if (n.id !== s.id) router.replace(`/servicos/${n.id}`);
          }}
          onError={setToast}
        />
      )}

      <div className="sv-detail">
        <nav className="sv-index" aria-label="index">
          {STEPS.map((k, i) => (
            <a key={k} href={`#${k}`}>
              <span className="mono">{String(i + 1).padStart(2, "0")}</span> {t(`sv.step.${k}` as Key)}
            </a>
          ))}
        </nav>

        <div className="sv-steps">
          <Step n={1} id="what" title={t("sv.step.what")}>
            <p className="sv-lead">{s.deliverable || "—"}</p>
            <div className="grid2">
              {s.includes.length > 0 && (
                <div>
                  <div className="label muted">{t("sv.includes")}</div>
                  <ul className="sv-list">
                    {s.includes.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {s.use_for.length > 0 && (
                <div>
                  <div className="label muted">{t("sv.useFor")}</div>
                  <ul className="sv-list">
                    {s.use_for.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {s.notes && (
              <details className="sv-notes">
                <summary className="label muted">{t("sv.notes")}</summary>
                <p className="small" style={{ whiteSpace: "pre-wrap" }}>
                  {s.notes}
                </p>
              </details>
            )}
          </Step>

          <Step n={2} id="price" title={t("sv.step.price")}>
            <div className="sv-kpis">
              <div>
                <span className="label muted">{t("sv.price")}</span>
                <b className="sv-amount small">{money(s.price, s.price % 1 ? 2 : 0)}</b>
                <span className="muted small">{t("sv.perUnit", { unit: t(`sv.unit.${s.unit}` as Key) })} · excl. BTW</span>
              </div>
              {h != null && (
                <div>
                  <span className="label muted">{t("sv.hourlyReal")}</span>
                  <b className="sv-amount small">{money(h)}</b>
                  <span className="muted small">
                    {t("sv.hours")}: {s.hours}
                  </span>
                </div>
              )}
              <div>
                <span className="label muted">{t("sv.sim.total")}</span>
                <b className="sv-amount small">{money(s.price * (1 + rules.btw / 100), 2)}</b>
                <span className="muted small">BTW {rules.btw}%</span>
              </div>
            </div>
            <p className="small muted">
              <span className="mono">{s.invoice_label}</span>
            </p>
          </Step>

          <Step n={3} id="when" title={t("sv.step.when")}>
            {s.use_for.length > 0 && <p>{t("sv.decide", { use: s.use_for.join(", ").toLowerCase() })}</p>}
            {s.not_for && (
              <p className="sv-warn small">
                <b>{t("sv.notFor")}:</b> {s.not_for}
              </p>
            )}
            <div className="label muted" style={{ marginTop: 14 }}>
              {t("sv.alternatives")}
            </div>
            <ul className="sv-alts">
              {alts.map((a) => (
                <li key={a.id}>
                  <Link href={`/servicos/${encodeURIComponent(a.id)}`}>
                    <b>{a.name}</b>
                    <span className="muted small">{a.deliverable}</span>
                  </Link>
                  <span className="mono small">
                    {money(a.price)} / {t(`sv.unit.${a.unit}` as Key)}
                  </span>
                  <span className={`mono small ${a.price > s.price ? "tone-warn" : "tone-ok"}`}>{t("sv.diff", { d: `${a.price >= s.price ? "+" : ""}${money(a.price - s.price)}` })}</span>
                </li>
              ))}
            </ul>
          </Step>

          <Step n={4} id="discounts" title={t("sv.step.discounts")}>
            {s.pass_through ? (
              <p className="muted">{t("sv.d.passthrough")}</p>
            ) : (
              <>
                <ul className="sv-disc">
                  <li data-on={hoursApplies || undefined}>
                    <b>{t("sv.d.hours")}</b>
                    <span>{rules.hours_tiers.filter((x) => x.pct).map((x) => `${x.min}h+ → ${x.pct}%`).join(" · ")}</span>
                    <em>{hoursApplies ? t("sv.applies") : s.kind === "capture" ? t("sv.d.captureSuspended") : t("sv.notApplies")}</em>
                  </li>
                  <li data-on={isReel || undefined}>
                    <b>{t("sv.d.volume")}</b>
                    <span>{rules.volume_tiers.filter((x) => x.pct).map((x) => `${x.min}+ → ${x.pct}%`).join(" · ")}</span>
                    <em>{isReel ? t("sv.applies") : t("sv.notApplies")}</em>
                  </li>
                  <li data-on>
                    <b>{t("sv.d.recurring")}</b>
                    <span>{rules.recurring.map((x) => `${x.months}m → ${x.pct}%`).join(" · ")}</span>
                    <em>{t("sv.applies")}</em>
                  </li>
                  <li data-on>
                    <b>{t("sv.d.partner")}</b>
                    <span>{rules.partner_pct}%</span>
                    <em>{t("sv.applies")}</em>
                  </li>
                </ul>
                <p className="small muted">{t("sv.d.capNote", { cap: rules.cap_pct })}</p>
                <p className="small">
                  {t("sv.maxDiscount")}: <b className="mono">{maxDisc}%</b> <span className="muted">({t("sv.minMargin")} {s.min_margin}%)</span>
                </p>
              </>
            )}
          </Step>

          <Step n={5} id="sim" title={t("sv.step.sim")}>
            <div className="row sv-sim-ctrl">
              {s.unit !== "trip" && (
                <label className="field" style={{ width: 120 }}>
                  <span>{t("sv.sim.hours")}</span>
                  <input className="input big mono" type="number" min={0.25} step={0.25} value={hours} onChange={(e) => setHours(Math.max(0, +e.target.value))} />
                </label>
              )}
              <span className="muted small">
                = {units} × {t(`sv.unit.${s.unit}` as Key)}
              </span>
              <label className="chip" data-on={partner || undefined}>
                <input type="checkbox" checked={partner} onChange={(e) => setPartner(e.target.checked)} /> {t("sv.sim.partner")}
              </label>
              <Select className="select statussel" value={months} onChange={(e) => setMonths(+e.target.value)} aria-label={t("sv.sim.recurring")}>
                <option value={0}>{t("sv.sim.none")}</option>
                {rules.recurring.map((r) => (
                  <option key={r.months} value={r.months}>
                    {t("sv.sim.months", { n: r.months })} · −{r.pct}%
                  </option>
                ))}
              </Select>
              {(s.kind === "edit" || s.kind === "reel") && (
                <label className="chip">
                  <input type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} /> {t("sv.sim.rush")}
                </label>
              )}
            </div>
            {line && (
              <div className="sv-simres">
                <div>
                  <span className="label muted">{t("sv.sim.gross")}</span>
                  <b className="mono">{money(line.gross, 2)}</b>
                </div>
                <div>
                  <span className="label muted">{t("sv.sim.discount")}</span>
                  <b className="mono">
                    −{money(line.gross - line.net, 2)} <span className="muted small">({line.applied_pct}%{line.capped ? ` · ${t("sv.calc.capped")}` : ""}{line.floor_limited ? ` · ${t("sv.calc.floor")}` : ""})</span>
                  </b>
                </div>
                <div>
                  <span className="label muted">{t("sv.sim.net")}</span>
                  <b className="sv-amount small">{money(line.net, 2)}</b>
                </div>
                <div>
                  <span className="label muted">{t("sv.sim.total")}</span>
                  <b className="mono">{money(sim.total, 2)}</b>
                </div>
              </div>
            )}
            {months > 0 && recurringPct(rules, months) > 0 && <p className="small muted">{t("sv.calc.monthly", { n: months, v: money(sim.contract_total) })}</p>}
            {sim.warnings
              .filter((w) => w.code !== "unknown_service")
              .map((w, i) => (
                <p key={i} className={`small ${w.code === "blocked" ? "tone-danger" : "tone-warn"}`}>
                  <Icon name="alert" size={14} /> {t(`sv.w.${w.code}` as Key, { cap: rules.cap_pct, n: w.detail ?? "" })}
                </p>
              ))}
          </Step>

          <Step n={6} id="market" title={t("sv.step.market")}>
            {s.market ? (
              <>
                <p>
                  <b>{s.market.label}</b>{" "}
                  <span className="muted small">· {t("sv.mk.compare", { per: t(`sv.mk.per.${s.market.per}` as Key) })}</span>
                </p>
                <MarketBar s={s} />
                {pos && (
                  <p className="small">
                    {t(`sv.seg.${pos.segment}` as Key)} · <span className="mono">{Math.round(pos.pct)}%</span> · {t("sv.mk.band")} {money(s.market.low)}–{money(s.market.high)}
                  </p>
                )}
                <div className="label muted" style={{ marginTop: 10 }}>
                  {t("sv.mk.sources")}
                </div>
                <ul className="sv-list small">
                  {s.market.sources.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">{t("sv.mk.none")}</p>
            )}
          </Step>

          <Step n={7} id="margin" title={t("sv.step.margin")}>
            <div className="sv-kpis">
              <div>
                <span className="label muted">{t("sv.crp")}</span>
                <b className="mono">{money(s.crp, 2)}</b>
              </div>
              <div>
                <span className="label muted">{t("sv.margin")}</span>
                <b className="mono">{s.pass_through ? "—" : `${m}%`}</b>
              </div>
              <div>
                <span className="label muted">{t("sv.minMargin")}</span>
                <b className="mono">{s.min_margin}%</b>
              </div>
              {!s.pass_through && (
                <div>
                  <span className="label muted">{t("sv.target", { m: rules.target_margin })}</span>
                  <b className="mono">{money(priceForMargin(s.crp, rules.target_margin), 2)}</b>
                </div>
              )}
            </div>
            <div className="sv-marginbar">
              <span style={{ width: `${Math.max(0, Math.min(100, 100 - m))}%` }} title={t("sv.crp")} />
              <em style={{ left: `${100 - s.min_margin}%` }} title={t("sv.minMargin")} />
            </div>
            <p className="small">
              <VerdictBadge s={s} rules={rules} withMargin={false} /> {t(`sv.vh.${s.pass_through ? "passthrough" : s.price <= s.crp ? "blocked" : m < s.min_margin ? "below_floor" : m < rules.healthy[0] ? "tight" : m <= rules.healthy[1] ? "healthy" : "premium"}` as Key, { a: rules.healthy[0], b: rules.healthy[1] })}
            </p>
          </Step>

          <Step n={8} id="history" title={t("sv.step.history")}>
            <ul className="sv-feed">
              {s.history
                .slice()
                .reverse()
                .map((x, i) => (
                  <li key={i}>
                    <span className="small">{x.field === "created" ? t("sv.h.created") : <><b>{x.field}</b>: {x.from || "—"} <Icon name="next" size={14} /> {x.to || "—"}</>}</span>
                    <span className="muted small mono">
                      {date(x.at)}
                      {x.by ? ` · ${t("sv.h.by", { who: x.by })}` : ""}
                    </span>
                  </li>
                ))}
            </ul>
            {s.source?.notion && (
              <a className="small muted" href={s.source.notion} target="_blank" rel="noreferrer">
                Notion <Icon name="arrow" size={14} />
              </a>
            )}
          </Step>
        </div>
      </div>
      <Toast msg={toast} />
    </AppShell>
  );
}

export default function ServiceDetail() {
  return (
    <Suspense>
      <DetailInner />
    </Suspense>
  );
}
