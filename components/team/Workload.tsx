"use client";

// Carga de trabalho da equipa: um cartão por pessoa (avatar → ficha), o que tem em mãos e como vai a semana.
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { fmtHours } from "@/lib/team";
import { workload, type Person, type StudioTask } from "@/lib/studio";
import type { ContentPost } from "@/lib/customer";
import type { TimeEntry } from "@/lib/team";
import { Avatar } from "./Avatar";
import { useStudio } from "./useStudio";
import { Icon } from "@/components/Icon";

export const memberHref = (p: Person) => `/equipa/${p.member ? p.member.id : "me"}`;

export function WorkloadGrid({ people, posts, tasks, entries, week, max = 99 }: { people: Person[]; posts: ContentPost[]; tasks: StudioTask[]; entries: TimeEntry[]; week: string; max?: number }) {
  const { t } = useT();
  const rows = people.map((p) => ({ p, w: workload(p.email, week, posts, tasks, entries, p.member?.id) })).sort((a, b) => b.w.load - a.w.load);
  const top = Math.max(1, ...rows.map((r) => r.w.load));
  if (!rows.length) return <p className="muted small">{t("st.noTeam")}</p>;
  return (
    <div className="wl-grid">
      {rows.slice(0, max).map(({ p, w }) => {
        const now = [...w.openPosts.map((x) => x.title || x.caption.split("\n")[0]), ...w.openTasks.map((x) => x.title)].filter(Boolean);
        return (
          <Link key={p.email} href={memberHref(p)} className="wl-card" data-testid="wl-card">
            <div className="row" style={{ gap: 10, flexWrap: "nowrap", minWidth: 0 }}>
              <Avatar name={p.name} photo={p.photo} size={40} ring={w.lateTasks > 0} />
              <span style={{ minWidth: 0 }}>
                <b className="wl-name">{p.name}</b>
                <span className="muted small wl-role">{p.role || "—"}</span>
              </span>
              <span className="wl-pct mono">{w.progress}%</span>
            </div>
            <div className="wl-bar" title={t("st.load", { n: w.load })}>
              <i style={{ width: `${(w.load / top) * 100}%` }} />
            </div>
            <div className="row between mono small muted">
              <span>
                {w.openPosts.length} {t("st.videos")} · {w.openTasks.length} {t("st.tasks")}
              </span>
              <span>{p.member ? fmtHours(w.minutes) : "—"}</span>
            </div>
            <ul className="wl-now">
              {now.slice(0, 3).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
              {!now.length && <li className="muted">{t("st.free")}</li>}
            </ul>
            {w.lateTasks > 0 && <span className="label tone-danger">{t("st.lateN", { n: w.lateTasks })}</span>}
          </Link>
        );
      })}
    </div>
  );
}

/** Bloco pronto para a página da Equipa: carrega os dados e mostra a carga da semana. */
export function TeamWorkload() {
  const { t } = useT();
  const S = useStudio();
  if (!S.customers) return null;
  return (
    <section className="w stack" style={{ marginBottom: 14 }}>
      <div className="row between">
        <span className="tile-t">{t("st.workload")}</span>
        <Link href="/estudio" className="btn ghost small">
          {t("st.openStudio")} <Icon name="arrow" size={14} />
        </Link>
      </div>
      <WorkloadGrid people={S.people} posts={S.posts} tasks={S.tasks} entries={S.entries} week={S.week} />
    </section>
  );
}
