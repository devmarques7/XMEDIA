"use client";

// Peças partilhadas do catálogo: hook de dados, formatação, selo de margem, barra de mercado e cartão de serviço.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useT, type Key } from "@/lib/i18n";
import { SERVICES_SAVED, serviceStore, type Catalog, type SavedQuote } from "@/lib/serviceStore";
import { SEGMENTS, hourlyOf, marginOf, marketPosition, verdict, type MarginVerdict, type PricingRules, type Service, type ServiceFolder } from "@/lib/services";

export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      const [c, q] = await Promise.all([serviceStore.load(), serviceStore.quotes().catch(() => [])]);
      setCatalog(c);
      setQuotes(q);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener(SERVICES_SAVED, reload);
    return () => window.removeEventListener(SERVICES_SAVED, reload);
  }, [reload]);
  return { catalog, quotes, error, reload };
}

export function useMoney() {
  const { locale } = useT();
  return useCallback(
    (v: number, digits = 0) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v),
    [locale]
  );
}

export const VERDICT_COLOR: Record<MarginVerdict, string> = {
  blocked: "var(--danger)",
  below_floor: "#ff8a3d",
  tight: "#f2c94a",
  healthy: "var(--ok)",
  premium: "#4d7cff",
  passthrough: "var(--muted)",
};

export function VerdictBadge({ s, rules, withMargin = true }: { s: Service; rules: PricingRules; withMargin?: boolean }) {
  const { t } = useT();
  const v = verdict(s, rules);
  return (
    <span className="sv-badge" style={{ ["--c" as string]: VERDICT_COLOR[v] }} title={t(`sv.vh.${v}` as Key, { a: rules.healthy[0], b: rules.healthy[1] })}>
      <i />
      {t(`sv.v.${v}` as Key)}
      {withMargin && !s.pass_through && <b>{Math.round(marginOf(s.price, s.crp))}%</b>}
    </span>
  );
}

/** Barra da banda de mercado com os 4 segmentos e o marcador do nosso valor. */
export function MarketBar({ s, compact = false }: { s: Service; compact?: boolean }) {
  const { t } = useT();
  const money = useMoney();
  const p = marketPosition(s);
  if (!s.market || !p) return compact ? null : <p className="muted small">{t("sv.mk.none")}</p>;
  const x = Math.max(0, Math.min(100, p.pct));
  return (
    <div className={`sv-mbar${compact ? " compact" : ""}`}>
      <div className="sv-mbar-track">
        {SEGMENTS.map((g) => (
          <span key={g.id} className={`seg-${g.id}`} style={{ width: `${g.to - g.from}%` }} title={t(`sv.seg.${g.id}` as Key)} />
        ))}
        <em style={{ left: `${x}%` }} data-out={p.pct < 0 || p.pct > 100 ? "1" : undefined} />
      </div>
      {!compact && (
        <div className="sv-mbar-legend mono small">
          <span>{money(s.market.low)}</span>
          <span className="sv-mbar-us">
            {t("sv.mk.ours")} {money(p.value)} · {t(`sv.seg.${p.segment}` as Key)}
          </span>
          <span>{money(s.market.high)}</span>
        </div>
      )}
    </div>
  );
}

export function ServiceCard({ s, folder, rules }: { s: Service; folder?: ServiceFolder; rules: PricingRules }) {
  const { t } = useT();
  const money = useMoney();
  const h = hourlyOf(s);
  return (
    <Link href={`/servicos/${encodeURIComponent(s.id)}`} className={`sv-card${s.archived ? " archived" : ""}`} style={{ ["--fc" as string]: folder?.color ?? "var(--accent)" }}>
      <div className="sv-card-top">
        <span className="sv-fdot" />
        <span className="label muted sv-card-folder">{folder?.label ?? s.folder}</span>
        {s.plan && <span className="sv-chip">{t(`sv.plan.${s.plan}` as Key)}</span>}
        {s.tier && <span className={`sv-chip${s.tier === "pro" ? " pro" : ""}`}>{t(`sv.tier.${s.tier}` as Key)}</span>}
      </div>
      <b className="sv-card-name">{s.name}</b>
      <span className="muted small sv-card-desc">{s.deliverable}</span>
      <div className="sv-card-price">
        <span className="sv-price">{money(s.price, s.price % 1 ? 2 : 0)}</span>
        <span className="muted small">{t("sv.perUnit", { unit: t(`sv.unit.${s.unit}` as Key) })}</span>
        {h != null && s.unit !== "hour" && <span className="muted small mono">· {t("sv.hourly", { v: money(h) })}</span>}
      </div>
      <MarketBar s={s} compact />
      <div className="sv-card-foot">
        <VerdictBadge s={s} rules={rules} />
        {s.uses > 0 && <span className="muted small mono">{t("sv.uses", { n: s.uses })}</span>}
      </div>
    </Link>
  );
}

/** Barra empilhada (estilo Paid/Credits/Balance) com a distribuição dos vereditos de margem. */
export function HealthBar({ counts }: { counts: Record<MarginVerdict, number> }) {
  const { t } = useT();
  const order: MarginVerdict[] = ["healthy", "premium", "tight", "below_floor", "blocked", "passthrough"];
  const total = order.reduce((n, k) => n + (counts[k] ?? 0), 0) || 1;
  return (
    <div className="sv-health">
      <div className="sv-health-bar">
        {order.map((k) =>
          counts[k] ? <span key={k} style={{ flex: counts[k], background: VERDICT_COLOR[k] }} title={`${t(`sv.v.${k}` as Key)}: ${counts[k]}`} /> : null
        )}
      </div>
      <div className="sv-health-legend">
        {order
          .filter((k) => counts[k])
          .map((k) => (
            <span key={k}>
              <i style={{ background: VERDICT_COLOR[k] }} />
              <b>{counts[k]}</b> {t(`sv.v.${k}` as Key)} <span className="muted mono">{Math.round(((counts[k] ?? 0) / total) * 100)}%</span>
            </span>
          ))}
      </div>
    </div>
  );
}

export function downloadText(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
