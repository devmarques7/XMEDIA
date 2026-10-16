"use client";

// Início do portal do cliente: mosaico de pré-visualizações — cada tile abre a página daquele dado.
// Processo (resumo por etapa) · Seguidores · Consistência · Tarefas · Marca · Perfil · Próximos 14 dias ·
// Melhores momentos · Publicação automática. Em colunas no telemóvel.
import { useMemo } from "react";
import { Bars, GoArrow, Tile } from "@/components/bento";
import { brandProgress, normalizeBrand } from "@/lib/brand";
import { consistency, publishDates } from "@/lib/consistency";
import { canManageInstagram, engagementRate, type ContentPost } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import type { PortalData } from "@/lib/portalApi";
import { AutoPublishTile, BestTimesTile, PostTimeline, ProcessSummary, ProfilePreview, clickProps } from "./PortalHome";

export function PortalDashboard({ data, onOpen, go, connectHref = "/api/portal/instagram/connect" }: { data: PortalData; onOpen: (p: ContentPost) => void; go?: (to: string) => void; connectHref?: string }) {
  const { t, locale } = useT();
  const c = data.customer;
  const ig = c.instagram;
  const posts = data.posts;
  const nav = (to: string) => (go ? () => go(to) : undefined);
  const n = (v?: number) => (v === undefined ? "—" : new Intl.NumberFormat(locale, { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v));
  const cs = useMemo(() => consistency(publishDates(ig, posts), posts), [ig, posts]);
  const er = engagementRate(ig);
  const hist = ig.history ?? [];
  const growth = hist.length > 1 ? hist[hist.length - 1].followers - hist[0].followers : null;
  const wk = (s: string) => new Date(s + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "short" });
  const canConnect = canManageInstagram(data.me.role) && data.info.igConnect;
  const tasks = (c.tasks ?? []).filter((x) => !x.deleted);
  const open = tasks.filter((x) => !x.done);
  const mine = open.filter((x) => x.mentions.includes(data.me.email.toLowerCase())).length;
  const brand = brandProgress(normalizeBrand(c.brand, c.name));

  return (
    <section className="widgets bento" style={{ paddingTop: 0 }}>
      <ProcessSummary className="span-8" posts={posts} process={c.process} onClick={nav("production")} />
      <Tile
        span={4}
        tone="blue"
        title={t("pd.followers")}
        value={ig.connected ? n(ig.followers) : "—"}
        of={growth !== null ? `${growth >= 0 ? "+" : ""}${n(growth)} · 28d` : ig.handle ? `@${ig.handle}` : undefined}
        testid="pd-followers"
        onClick={nav("account:profile")}
        foot={
          <>
            <span>
              {t("pd.reach")} {n(ig.insights?.reach)}
            </span>
            <span>
              {t("pd.engagement")} {er === null ? "—" : `${er}%`}
            </span>
          </>
        }
      >
        {!ig.connected && <span className="tile-text">{t("pp.connectHint")}</span>}
      </Tile>

      <div className={`w tile span-6 ${go ? "click" : ""}`} data-testid="pd-consistency" data-tour="tiles" {...clickProps(nav("calendar"))}>
        <div className="tile-head">
          <span className="tile-t">{t("pd.consistency")}</span>
          <GoArrow extra={<span className={`label ${cs.level === "great" ? "tone-ok" : cs.level === "ok" ? "tone-warn" : "tone-danger"}`}>{t(`pd.score.${cs.level}` as Key)}</span>} />
        </div>
        <div className="rev">
          <div>
            <span className="tile-num">{cs.score}%</span>
            <div className="tile-of muted" style={{ marginTop: 8 }}>
              {t("pd.weeks", { n: cs.active, total: cs.weeks.length })}
            </div>
          </div>
          <Bars values={cs.weeks.map((w) => w.n)} labels={cs.weeks.map((w, i) => (i % 3 === 0 ? wk(w.start) : ""))} on={cs.weeks.length - 1} />
        </div>
        <div className="tile-sep">
          <span>
            {t("pd.streak")} {t("pd.streakN", { n: cs.streak })}
          </span>
          <span>
            {t("pd.perWeek")} {cs.perWeek.toLocaleString(locale)}
          </span>
          <span>
            {t("pd.gap")} {t("pd.gapN", { n: cs.gapDays })}
          </span>
        </div>
      </div>
      <Tile span={3} title={t("hm2.tasks")} value={open.length} of={mine ? t("hm2.mine", { n: mine }) : `/ ${tasks.length}`} onClick={nav("tasks")} testid="pd-tasks" />
      <Tile span={3} tone="sand" title={t("hm2.brand")} value={`${brand.total}%`} of={t("hm2.brandSub")} onClick={nav("brand:view")} testid="pd-brand">
        <div className="meter" aria-hidden>
          <i style={{ width: `${brand.total}%` }} />
        </div>
      </Tile>

      <PostTimeline className="span-12" posts={posts} ig={ig} onOpen={onOpen} onClick={nav("calendar")} />

      <ProfilePreview className="span-4" customer={c} ig={ig} posts={posts} connectHref={connectHref} canConnect={canConnect} onOpen={onOpen} onClick={nav("account:profile")} />
      <BestTimesTile className="span-4" ig={ig} onClick={nav("calendar")} />
      <AutoPublishTile className="span-4" posts={posts} connected={ig.connected} onClick={nav("production")} onOpen={onOpen} />
    </section>
  );
}
