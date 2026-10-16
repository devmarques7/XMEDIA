"use client";

// Serviços: dashboard do catálogo (valor médio, saúde das margens, mercado), pesquisa global,
// mais requisitados, pastas em separadores e grelha de cartões; painel de atividade e orçamentos recentes.
import { Select } from "@/components/Select";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { ImportPanel, RulesPanel } from "@/components/services/Admin";
import { HealthBar, ServiceCard, downloadText, useCatalog, useMoney } from "@/components/services/parts";
import { AppShell, Toast, useToast } from "@/components/ui";
import { useAccess } from "@/lib/access";
import { useT, type Key } from "@/lib/i18n";
import { can } from "@/lib/roles";
import { serviceStore } from "@/lib/serviceStore";
import { catalogStats, exportCatalog, folderStats, marginOf, normalizeService, popular, searchServices, verdict, type Service } from "@/lib/services";

type Sort = "popular" | "priceAsc" | "priceDesc" | "margin" | "name";
const LS_SORT = "xmedia:services:sort";

function ServicesInner() {
  const { t, locale } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const money = useMoney();
  const access = useAccess();
  const edit = can(access, "proposals.edit");
  const [toast, setToast] = useToast();
  const { catalog, quotes, error } = useCatalog();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [folder, setFolder] = useState(params.get("pasta") ?? "all");
  const [plan, setPlan] = useState("");
  const [tier, setTier] = useState("");
  const [onlyReview, setOnlyReview] = useState(false);
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState<Sort>("popular");
  const [panel, setPanel] = useState<"" | "import" | "rules">("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_SORT) as Sort | null;
      if (s) setSort(s);
    } catch {}
    const k = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    if (error) setToast(error);
  }, [error, setToast]);

  const services = useMemo(() => catalog?.services ?? [], [catalog]);
  const folders = useMemo(() => catalog?.folders ?? [], [catalog]);
  const rules = catalog?.rules;
  const stats = useMemo(() => (rules ? catalogStats(services, rules) : null), [services, rules]);
  const fstats = useMemo(() => folderStats(services, folders), [services, folders]);
  const top = useMemo(() => popular(services, 6), [services]);
  const folderOf = (id: string) => folders.find((f) => f.id === id);
  const folderOrder = (id: string) => folders.find((f) => f.id === id)?.order ?? 99;

  const list = useMemo(() => {
    let l = searchServices(archived ? services.map((s) => ({ ...s, archived: false })) : services, q, folders).map((s) => services.find((x) => x.id === s.id)!);
    if (folder !== "all") l = l.filter((s) => s.folder === folder);
    if (plan) l = l.filter((s) => (plan === "none" ? !s.plan : s.plan === plan));
    if (tier) l = l.filter((s) => s.tier === tier);
    if (onlyReview && rules) l = l.filter((s) => s.potential === "review" || ["blocked", "below_floor"].includes(verdict(s, rules)));
    if (!q.trim() || sort !== "popular") {
      const by: Record<Sort, (a: Service, b: Service) => number> = {
        popular: (a, b) => b.uses - a.uses || (folderOrder(a.folder) - folderOrder(b.folder)) || a.price - b.price,
        priceAsc: (a, b) => a.price - b.price,
        priceDesc: (a, b) => b.price - a.price,
        margin: (a, b) => marginOf(b.price, b.crp) - marginOf(a.price, a.crp),
        name: (a, b) => a.name.localeCompare(b.name, locale),
      };
      l = l.slice().sort(by[sort]);
    }
    return l;
  }, [services, q, folder, plan, tier, onlyReview, archived, sort, folders, rules, locale]);

  const activity = useMemo(
    () =>
      services
        .flatMap((s) => s.history.filter((h) => h.field !== "created" || h.by !== "Notion").map((h) => ({ ...h, s })))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 10),
    [services]
  );

  function pickSort(s: Sort) {
    setSort(s);
    try {
      localStorage.setItem(LS_SORT, s);
    } catch {}
  }
  async function create() {
    const f = folder !== "all" ? folder : folders[0]?.id ?? "capture";
    const base = normalizeService({ id: `novo-${Date.now().toString(36)}`, name: t("sv.new"), folder: f }, folders);
    await serviceStore.saveService(base, "admin").catch((e) => setToast(e.message));
    router.push(`/servicos/${base.id}?editar=1`);
  }
  const exportJson = () => catalog && downloadText(`xmedia-services-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportCatalog(services, folders, catalog.rules), null, 2));
  async function exportPdf() {
    if (!catalog) return;
    const { downloadCatalogPdf } = await import("@/lib/servicePdf");
    await downloadCatalogPdf(folder === "all" ? services : services.filter((s) => s.folder === folder), folders, catalog.rules, folder === "all" ? undefined : folderOf(folder)?.label.toUpperCase()).catch((e) => setToast(e.message));
  }
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short" });

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("sv.sub")}</span>
          <h1 className="h1">{t("nav.services")}</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={exportPdf} disabled={!catalog}>
            <Icon name="download" size={14} /> {t("sv.exportPdf")}
          </button>
          <button className="btn" onClick={exportJson} disabled={!catalog}>
            {"{ }"} {t("sv.exportJson")}
          </button>
          {edit && (
            <>
              <button className="btn" onClick={() => setPanel((p) => (p === "import" ? "" : "import"))} aria-expanded={panel === "import"}>
                {"{ }"} {t("sv.import")}
              </button>
              <button className="btn" onClick={() => setPanel((p) => (p === "rules" ? "" : "rules"))} aria-expanded={panel === "rules"}>
                % {t("sv.rules")}
              </button>
              <button className="btn" onClick={create}>
                + {t("sv.new")}
              </button>
            </>
          )}
          <Link href="/servicos/calculadora" className="btn accent">
            <Icon name="calc" size={16} /> {t("sv.calculator")}
          </Link>
        </div>
      </section>

      {catalog && panel === "import" && <ImportPanel catalog={catalog} onDone={(m) => (setToast(m), setPanel(""))} onError={setToast} />}
      {catalog && panel === "rules" && <RulesPanel catalog={catalog} onDone={(m) => setToast(m)} onError={setToast} />}

      <label className="search sv-search">
        <Icon name="search" />
        <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("sv.search")} aria-label={t("sv.search")} data-testid="sv-search" />
        {q ? (
          <button className="btn ghost small" onClick={() => setQ("")} aria-label={t("cancel")}>
            <Icon name="close" size={14} />
          </button>
        ) : (
          <kbd>/</kbd>
        )}
      </label>

      {stats && rules && (
        <div className="widgets sv-top">
          <div className="w span-8 sv-hero">
            <div className="label muted">{t("sv.avgHourly")}</div>
            <div className="sv-amount">
              {money(stats.avg_hourly)}
              <span className="muted">/h</span>
            </div>
            <div className="row sv-hero-kpis">
              <span>
                <b>{stats.count}</b> <span className="muted">{t("sv.count", { n: "" }).trim()}</span>
              </span>
              <span>
                <b>{money(stats.avg_price)}</b> <span className="muted">{t("sv.avgPrice")}</span>
              </span>
              <span>
                <b>{Math.round(stats.avg_margin)}%</b> <span className="muted">{t("sv.avgMargin")}</span>
              </span>
              {!!stats.review && (
                <button className={`chip${onlyReview ? " on" : ""}`} onClick={() => setOnlyReview((v) => !v)}>
                  <Icon name="alert" size={14} /> {t("sv.reviewN", { n: services.filter((s) => !s.archived && (s.potential === "review" || ["blocked", "below_floor"].includes(verdict(s, rules)))).length })}
                </button>
              )}
            </div>
            <div className="label muted" style={{ marginTop: 18 }}>
              {t("sv.health")}
            </div>
            <HealthBar counts={stats.verdicts} />
            <div className="label muted" style={{ marginTop: 16 }}>
              {t("sv.market")}
            </div>
            <div className="sv-mkt-sum">
              <div className="sv-mbar-track">
                <span className="seg-entry" style={{ width: "25%" }} />
                <span className="seg-mid" style={{ width: "35%" }} />
                <span className="seg-premium" style={{ width: "25%" }} />
                <span className="seg-luxury" style={{ width: "15%" }} />
                <em style={{ left: `${Math.max(0, Math.min(100, stats.market.avg_pct))}%` }} />
              </div>
              <span className="muted small">{t("sv.marketAvg", { pct: Math.round(stats.market.avg_pct), n: stats.market.compared })}</span>
            </div>
          </div>

          <aside className="w span-4 sv-activity">
            <div className="w-head">
              <span className="label">{t("sv.activity")}</span>
            </div>
            {activity.length === 0 && <p className="muted small">{t("sv.noActivity")}</p>}
            <ul className="sv-feed">
              {activity.map((a, i) => (
                <li key={i}>
                  <Link href={`/servicos/${encodeURIComponent(a.s.id)}`}>
                    <b>{a.s.name}</b>
                  </Link>
                  <span className="muted small">
                    {a.field === "created" ? t("sv.h.created") : `${a.field}: ${a.from || "—"} → ${a.to || "—"}`}
                    {a.by ? ` · ${t("sv.h.by", { who: a.by })}` : ""} · {date(a.at)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="w-head" style={{ marginTop: 16 }}>
              <span className="label">{t("sv.recentQuotes")}</span>
              <Link href="/servicos/calculadora" className="btn ghost small">
                +
              </Link>
            </div>
            {quotes.length === 0 && <p className="muted small">{t("sv.noQuotes")}</p>}
            <ul className="sv-feed">
              {quotes.slice(0, 5).map((qq) => (
                <li key={qq.id}>
                  <Link href={`/servicos/calculadora?q=${qq.id}`}>
                    <b>{qq.title || qq.input.client.company || qq.input.client.name || t("sv.calc.untitled")}</b>
                  </Link>
                  <span className="muted small mono">
                    {money(qq.subtotal)} · {t(`sv.status.${qq.status}` as Key)} · {qq.updated_at ? date(qq.updated_at) : ""}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}

      {!q && top.length > 0 && rules && (
        <section className="sv-popular">
          <div className="label muted">★ {t("sv.popular")}</div>
          <div className="sv-strip">
            {top.map((s) => (
              <ServiceCard key={s.id} s={s} folder={folderOf(s.folder)} rules={rules} />
            ))}
          </div>
        </section>
      )}

      <nav className="tabs sv-tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={folder === "all"} onClick={() => setFolder("all")}>
          <b>{String(services.filter((s) => !s.archived).length).padStart(2, "0")}</b>
          {t("sv.all")}
        </button>
        {fstats.map((f) => (
          <button key={f.folder.id} className="tab" role="tab" aria-selected={folder === f.folder.id} onClick={() => setFolder(f.folder.id)}>
            <b style={{ color: folder === f.folder.id ? f.folder.color : undefined }}>{String(f.count).padStart(2, "0")}</b>
            {f.folder.label}
          </button>
        ))}
      </nav>

      <div className="row sv-filters">
        {folder !== "all" &&
          (() => {
            const f = fstats.find((x) => x.folder.id === folder);
            return f ? (
              <span className="small sv-fsum">
                <span className="muted">{f.folder.hint}</span> · {t("sv.avgPrice")} <b>{money(f.avg_price)}</b> · {t("sv.range")} <b>{money(f.min)}–{money(f.max)}</b>
                {f.avg_hourly ? (
                  <>
                    {" "}
                    · <b>{money(f.avg_hourly)}/h</b>
                  </>
                ) : null}{" "}
                · {t("sv.avgMargin")} <b>{Math.round(f.avg_margin)}%</b>
              </span>
            ) : null;
          })()}
        <span style={{ flex: 1 }} />
        <Select className="select statussel" value={plan} onChange={(e) => setPlan(e.target.value)} aria-label={t("sv.filter.plan")}>
          <option value="">{t("sv.filter.plan")}</option>
          {(["on_demand", "frequency", "day", "extra", "package", "none"] as const).map((p) => (
            <option key={p} value={p}>
              {t(`sv.plan.${p}` as Key)}
            </option>
          ))}
        </Select>
        <Select className="select statussel" value={tier} onChange={(e) => setTier(e.target.value)} aria-label={t("sv.filter.tier")}>
          <option value="">{t("sv.filter.tier")}</option>
          <option value="simple">{t("sv.tier.simple")}</option>
          <option value="pro">{t("sv.tier.pro")}</option>
        </Select>
        <Select className="select statussel" value={sort} onChange={(e) => pickSort(e.target.value as Sort)} aria-label={t("sv.sort")}>
          {(["popular", "priceAsc", "priceDesc", "margin", "name"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`sv.sort.${s}` as Key)}
            </option>
          ))}
        </Select>
        <label className="small row" style={{ gap: 6 }}>
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> {t("sv.showArchived")}
        </label>
      </div>

      {!catalog && <p className="muted">…</p>}
      {catalog && list.length === 0 && <p className="muted w">{t("sv.empty", { q })}</p>}
      {rules && (
        <div className="sv-grid" data-testid="sv-grid">
          {list.map((s) => (
            <ServiceCard key={s.id} s={s} folder={folderOf(s.folder)} rules={rules} />
          ))}
        </div>
      )}
      <Toast msg={toast} />
    </AppShell>
  );
}

export default function ServicesPage() {
  return (
    <Suspense>
      <ServicesInner />
    </Suspense>
  );
}
