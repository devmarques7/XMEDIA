"use client";

// Editor de um serviço: todos os campos + margem e preço-alvo em tempo real. O id fica estável (ligações e orçamentos).
import { Select } from "@/components/Select";
import { useState } from "react";
import { useT, type Key } from "@/lib/i18n";
import { serviceStore } from "@/lib/serviceStore";
import { marginOf, normalizeService, priceForMargin, type PricingRules, type Service, type ServiceFolder } from "@/lib/services";
import { useMoney } from "./parts";

type P = { service: Service; folders: ServiceFolder[]; rules: PricingRules; onSaved: (s: Service) => void; onError: (m: string) => void };

export function ServiceEditor({ service, folders, rules, onSaved, onError }: P) {
  const { t } = useT();
  const money = useMoney();
  const [d, setD] = useState<Service>(service);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Service>(k: K, v: Service[K]) => setD((x) => ({ ...x, [k]: v }));
  const lines = (v: string[]) => v.join("\n");
  const unlines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
  const m = marginOf(d.price, d.crp);

  async function save() {
    setBusy(true);
    try {
      const saved = await serviceStore.saveService(normalizeService(d, folders), "admin");
      onSaved(saved);
    } catch (e) {
      onError((e as Error).message);
    }
    setBusy(false);
  }

  const sel = <K extends keyof Service>(k: K, label: string, opts: [string, string][]) => (
    <label className="field">
      <span>{label}</span>
      <Select className="select" value={String(d[k] ?? "")} onChange={(e) => set(k, (e.target.value === "" ? null : e.target.value) as Service[K])}>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </label>
  );
  const num = (k: "price" | "crp" | "hours" | "min_margin", label: string, step = 1) => (
    <label className="field">
      <span>{label}</span>
      <input className="input mono" type="number" min={0} step={step} value={d[k]} onChange={(e) => set(k, +e.target.value)} />
    </label>
  );

  return (
    <section className="jsonbox stack sv-panel sv-editor">
      <label className="field">
        <span>{t("sv.f.name")}</span>
        <input className="input big" value={d.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <div className="grid4">
        {sel("folder", t("sv.f.folder"), folders.map((f) => [f.id, f.label]))}
        {sel("plan", t("sv.f.plan"), [["", t("sv.plan.none")], ...(["on_demand", "frequency", "day", "extra", "package"] as const).map((p) => [p, t(`sv.plan.${p}` as Key)] as [string, string])])}
        {sel("tier", t("sv.f.tier"), [["", "—"], ["simple", t("sv.tier.simple")], ["pro", t("sv.tier.pro")]])}
        {sel("unit", t("sv.f.unit"), (["hour", "day", "item", "session", "month", "trip"] as const).map((u) => [u, t(`sv.unit.${u}` as Key)]))}
        {sel("kind", t("sv.f.kind"), (["capture", "edit", "reel", "photo", "strategy", "travel"] as const).map((k) => [k, t(`sv.k.${k}` as Key)]))}
        {sel("potential", t("sv.f.potential"), (["high", "medium", "review", "passthrough"] as const).map((k) => [k, t(`sv.pot.${k}` as Key)]))}
      </div>
      <div className="grid4">
        {num("price", `${t("sv.price")} (€)`, 0.5)}
        {num("crp", `${t("sv.crp")} (€)`, 0.5)}
        {num("hours", t("sv.hours"), 0.25)}
        {num("min_margin", `${t("sv.minMargin")} (%)`)}
      </div>
      <p className="small">
        {t("sv.margin")}: <b className={`mono ${m < d.min_margin && !d.pass_through ? "tone-danger" : ""}`}>{d.pass_through ? "—" : `${m}%`}</b>
        {!d.pass_through && (
          <>
            {" "}
            · {t("sv.target", { m: rules.target_margin })}:{" "}
            <button className="btn ghost small mono" onClick={() => set("price", priceForMargin(d.crp, rules.target_margin))}>
              {money(priceForMargin(d.crp, rules.target_margin), 2)}
            </button>
          </>
        )}
        <label className="row small" style={{ gap: 6, display: "inline-flex", marginLeft: 12 }}>
          <input type="checkbox" checked={d.pass_through} onChange={(e) => set("pass_through", e.target.checked)} /> {t("sv.f.passThrough")}
        </label>
      </p>
      <label className="field">
        <span>{t("sv.deliverable")}</span>
        <textarea className="textarea" rows={2} value={d.deliverable} onChange={(e) => set("deliverable", e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>
            {t("sv.includes")} · {t("sv.f.lines")}
          </span>
          <textarea className="textarea" rows={5} value={lines(d.includes)} onChange={(e) => set("includes", unlines(e.target.value))} />
        </label>
        <label className="field">
          <span>
            {t("sv.useFor")} · {t("sv.f.lines")}
          </span>
          <textarea className="textarea" rows={5} value={lines(d.use_for)} onChange={(e) => set("use_for", unlines(e.target.value))} />
        </label>
      </div>
      <label className="field">
        <span>{t("sv.notFor")}</span>
        <input className="input" value={d.not_for} onChange={(e) => set("not_for", e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>{t("sv.f.invoiceLabel")}</span>
          <input className="input mono" value={d.invoice_label} onChange={(e) => set("invoice_label", e.target.value)} />
        </label>
        <label className="field">
          <span>{t("sv.f.tags")}</span>
          <input className="input" value={d.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
        </label>
      </div>
      <div className="grid4">
        <label className="field">
          <span>{t("sv.f.marketLow")}</span>
          <input className="input mono" type="number" min={0} value={d.market?.low ?? ""} onChange={(e) => set("market", { low: +e.target.value, high: d.market?.high ?? 0, per: d.market?.per ?? "hour", label: d.market?.label ?? "", sources: d.market?.sources ?? [] })} />
        </label>
        <label className="field">
          <span>{t("sv.f.marketHigh")}</span>
          <input className="input mono" type="number" min={0} value={d.market?.high ?? ""} onChange={(e) => set("market", { low: d.market?.low ?? 0, high: +e.target.value, per: d.market?.per ?? "hour", label: d.market?.label ?? "", sources: d.market?.sources ?? [] })} />
        </label>
        <label className="field">
          <span>{t("sv.f.marketPer")}</span>
          <Select className="select" value={d.market?.per ?? "hour"} onChange={(e) => d.market && set("market", { ...d.market, per: e.target.value as "hour" })}>
            {(["hour", "day", "item", "month"] as const).map((p) => (
              <option key={p} value={p}>
                {t(`sv.mk.per.${p}` as Key)}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span>{t("sv.f.marketLabel")}</span>
          <input className="input" value={d.market?.label ?? ""} onChange={(e) => d.market && set("market", { ...d.market, label: e.target.value })} />
        </label>
      </div>
      <label className="field">
        <span>{t("sv.f.sources")}</span>
        <textarea className="textarea small" rows={2} value={lines(d.market?.sources ?? [])} onChange={(e) => d.market && set("market", { ...d.market, sources: unlines(e.target.value) })} />
      </label>
      <label className="field">
        <span>{t("sv.notes")}</span>
        <textarea className="textarea small" rows={3} value={d.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>
      <div className="row">
        <button className="btn accent" onClick={save} disabled={busy}>
          {t("sv.save")}
        </button>
        <button className="btn ghost" onClick={() => setD(service)}>
          {t("cancel")}
        </button>
      </div>
    </section>
  );
}
