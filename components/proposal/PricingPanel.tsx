"use client";

// Separador "Investimento" do editor de propostas: produção → entregável → extras (do catálogo de serviços)
// e até 3 pacotes (base + extras escolhidos). "Aplicar" recalcula e escreve os slides de pacotes, extras e condições.
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { useMemo, useState } from "react";
import { useCatalog, useMoney } from "@/components/services/parts";
import { useT, type Key } from "@/lib/i18n";
import type { PricingGroup, PricingLine, PricingPackage, Proposal, ProposalPricing } from "@/lib/proposal";
import { GROUPS, applyPricing, emptyPricing, pricingSummary } from "@/lib/proposalPricing";

export function PricingPanel({ p, update, onToast }: { p: Proposal; update: (fn: (x: Proposal) => Proposal) => void; onToast: (m: string) => void }) {
  const { t } = useT();
  const money = useMoney();
  const { catalog } = useCatalog();
  const [pr, setPr] = useState<ProposalPricing>(p.pricing ?? emptyPricing());
  const services = useMemo(() => (catalog?.services ?? []).filter((s) => !s.archived), [catalog]);
  const sum = useMemo(() => (catalog ? pricingSummary(pr, catalog.services, catalog.rules) : null), [pr, catalog]);
  if (!catalog || !sum) return <p className="muted small">…</p>;

  const extras = pr.lines.filter((l) => l.group === "extra");
  const setLine = (line: PricingLine, patch: Partial<PricingLine>) => setPr((x) => ({ ...x, lines: x.lines.map((l) => (l === line ? { ...l, ...patch } : l)) }));
  const removeLine = (line: PricingLine) =>
    setPr((x) => {
      const ei = x.lines.filter((l) => l.group === "extra").indexOf(line);
      return {
        ...x,
        lines: x.lines.filter((l) => l !== line),
        packages: ei < 0 ? x.packages : x.packages?.map((pk) => ({ ...pk, extras: pk.extras.filter((i) => i !== ei).map((i) => (i > ei ? i - 1 : i)) })),
      };
    });
  const addLine = (group: PricingGroup) => {
    const first = services.find((s) => (group === "production" ? s.kind === "capture" : group === "deliverable" ? s.kind === "edit" || s.kind === "reel" : s.kind === "photo")) ?? services[0];
    if (first) setPr((x) => ({ ...x, lines: [...x.lines, { service_id: first.id, qty: 1, group }] }));
  };
  const setPkg = (i: number, patch: Partial<PricingPackage>) => setPr((x) => ({ ...x, packages: (x.packages ?? []).map((k, j) => (j === i ? { ...k, ...patch } : patch.recommended ? { ...k, recommended: false } : k)) }));
  const apply = () => {
    update((x) => applyPricing({ ...x, pricing: pr }, catalog.services, catalog.rules));
    onToast(t("pp.applied"));
  };
  const lineNet = (l: PricingLine) => {
    if (l.group === "extra") return sum.extras.find((e) => e.line === l)?.price;
    return sum.base.lines.find((x) => x.service.id === l.service_id)?.net;
  };

  return (
    <div className="stack pp">
      <p className="muted small">{t("pp.hint")}</p>
      <div className="grid2">
        <label className="field">
          <span>{t("sv.calc.country")}</span>
          <input className="input mono" maxLength={2} value={pr.country} onChange={(e) => setPr({ ...pr, country: e.target.value.toUpperCase() })} />
        </label>
        <label className="field">
          <span>{t("pr.col.valid")}</span>
          <input className="input" type="date" value={pr.valid_until ?? ""} onChange={(e) => setPr({ ...pr, valid_until: e.target.value })} />
        </label>
      </div>
      <div className="row">
        <label className="small row" style={{ gap: 6 }}>
          <input type="checkbox" checked={pr.partner} onChange={(e) => setPr({ ...pr, partner: e.target.checked })} /> {t("sv.calc.partner")}
        </label>
        <Select className="select statussel" value={pr.recurring_months} onChange={(e) => setPr({ ...pr, recurring_months: +e.target.value })} aria-label={t("sv.calc.recurring")}>
          <option value={0}>{t("sv.sim.none")}</option>
          {catalog.rules.recurring.map((r) => (
            <option key={r.months} value={r.months}>
              {t("sv.sim.months", { n: r.months })} · −{r.pct}%
            </option>
          ))}
        </Select>
      </div>

      {GROUPS.map((g, gi) => (
        <section key={g} className="pp-group">
          <div className="row between">
            <span className="label">
              {gi + 1} · {t(`pp.g.${g}` as Key)}
            </span>
            <button className="btn ghost small" onClick={() => addLine(g)}>
              + {t("pp.add")}
            </button>
          </div>
          <span className="muted small">{t(`pp.gh.${g}` as Key)}</span>
          {pr.lines
            .filter((l) => l.group === g)
            .map((l, k) => (
              <div key={`${g}-${k}`} className="pp-line">
                <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                  <Select className="select" value={l.service_id} onChange={(e) => setLine(l, { service_id: e.target.value })} aria-label={t("sv.f.name")}>
                    {catalog.folders.map((f) => (
                      <optgroup key={f.id} label={f.label}>
                        {services
                          .filter((s) => s.folder === f.id)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} · {money(s.price)}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </Select>
                  <input className="input mono pp-qty" type="number" min={0} step={0.5} value={l.qty} onChange={(e) => setLine(l, { qty: Math.max(0, +e.target.value) })} aria-label={t("sv.calc.qty")} />
                  <button className="btn ghost small" onClick={() => removeLine(l)} aria-label={t("remove")}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
                <div className="grid2">
                  <input className="input small" value={l.label ?? ""} onChange={(e) => setLine(l, { label: e.target.value })} placeholder={t("pp.label")} />
                  <input className="input small" value={l.item ?? ""} onChange={(e) => setLine(l, { item: e.target.value })} placeholder={t("pp.item")} />
                </div>
                <textarea className="textarea small" rows={2} value={l.note ?? ""} onChange={(e) => setLine(l, { note: e.target.value })} placeholder={t("pp.note")} />
                <div className="row between small">
                  <label className="row" style={{ gap: 6 }}>
                    {t("pp.override")}
                    <input
                      className="input mono pp-qty"
                      type="number"
                      min={0}
                      value={l.price_override ?? ""}
                      onChange={(e) => setLine(l, { price_override: e.target.value === "" ? null : +e.target.value })}
                      placeholder="—"
                    />
                  </label>
                  <b className="mono">{lineNet(l) != null ? `${g === "extra" ? "+ " : ""}${money(lineNet(l)!, 2)}` : "—"}</b>
                </div>
              </div>
            ))}
        </section>
      ))}

      <section className="pp-group">
        <div className="row between">
          <span className="label">4 · {t("pp.packages")}</span>
          {(pr.packages?.length ?? 0) < 3 && (
            <button className="btn ghost small" onClick={() => setPr({ ...pr, packages: [...(pr.packages ?? []), { name: `Package ${(pr.packages?.length ?? 0) + 1}`, description: "", extras: [] }] })}>
              + {t("pp.add")}
            </button>
          )}
        </div>
        <span className="muted small">{t("pp.packagesHint")}</span>
        {(pr.packages ?? []).map((pk, i) => (
          <div key={i} className="pp-line">
            <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
              <input className="input" value={pk.name} onChange={(e) => setPkg(i, { name: e.target.value })} aria-label={t("sv.f.name")} />
              <b className="mono" style={{ whiteSpace: "nowrap" }}>
                {money(sum.packages[i]?.quote.subtotal ?? 0, 2)}
              </b>
              <button className="btn ghost small" onClick={() => setPr({ ...pr, packages: pr.packages!.filter((_, j) => j !== i) })} aria-label={t("remove")}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <textarea className="textarea small" rows={3} value={pk.description} onChange={(e) => setPkg(i, { description: e.target.value })} placeholder={t("pp.desc")} />
            <div className="row small">
              <label className="row" style={{ gap: 6 }}>
                <input type="radio" name="pp-rec" checked={!!pk.recommended} onChange={() => setPkg(i, { recommended: true })} /> {t("pp.recommended")}
              </label>
              {extras.map((x, ei) => (
                <label key={ei} className="row" style={{ gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={pk.extras.includes(ei)}
                    onChange={(e) => setPkg(i, { extras: e.target.checked ? [...pk.extras, ei] : pk.extras.filter((v) => v !== ei) })}
                  />
                  + {x.label || services.find((s) => s.id === x.service_id)?.name}
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="sv-internal">
        <div className="sv-sum-row small">
          <span>{t("pp.g.production")}</span>
          <span className="mono">{money(sum.production.subtotal, 2)}</span>
        </div>
        <div className="sv-sum-row small">
          <span>{t("pp.base")}</span>
          <b className="mono">{money(sum.base.subtotal, 2)}</b>
        </div>
        <div className="sv-sum-row small muted">
          <span>{t("sv.calc.marginLine")}</span>
          <span className="mono">{sum.full.margin}%</span>
        </div>
        {[...sum.base.warnings, ...sum.full.warnings]
          .filter((w, i, a) => a.findIndex((x) => x.code === w.code) === i)
          .map((w, i) => (
            <p key={i} className="small tone-warn">
              <Icon name="alert" size={14} /> {t(`sv.w.${w.code}` as Key, { cap: catalog.rules.cap_pct, n: w.detail ?? "", d: w.detail ?? "" })}
            </p>
          ))}
      </div>
      <button className="btn accent" onClick={apply} disabled={!pr.lines.length}>
        {t("pp.apply")}
      </button>
    </div>
  );
}
