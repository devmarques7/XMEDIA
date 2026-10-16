"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/ui";
import { RecentChanges } from "@/components/RecentChanges";
import { useT } from "@/lib/i18n";
import { store } from "@/lib/store";
import type { VersionMeta } from "@/lib/types";
import { useProjects } from "@/lib/useProjects";
import { pad } from "@/lib/util";

export default function HistoryPage() {
  const { t, locale } = useT();
  const { projects } = useProjects();
  const [versions, setVersions] = useState<VersionMeta[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    store.allVersions().then(setVersions).catch((e) => setErr(e.message));
  }, []);

  const exists = (id: string) => projects?.some((p) => p.id === id);
  const byDay = new Map<string, VersionMeta[]>();
  for (const v of versions ?? []) {
    const d = new Date(v.created_at);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    byDay.set(key, [...(byDay.get(key) ?? []), v]);
  }

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("hs.sub")}</span>
          <h1 className="h1">{t("nav.history")}</h1>
        </div>
        <div className="display">{versions ? pad(versions.length) : "··"}</div>
      </section>
      <RecentChanges />
      {err && <p className="tone-danger">{err}</p>}
      {versions?.length === 0 && <p className="muted">{t("hs.empty")}</p>}

      <div className="daylist">
        {[...byDay.entries()].map(([day, list]) => {
          const d = new Date(day + "T12:00:00");
          return (
            <section key={day} className="dayrow">
              <div className="daynum">
                <span className="big">{pad(d.getDate())}</span>
                <span className="label muted">{d.toLocaleDateString(locale, { month: "short", year: "numeric" })}</span>
              </div>
              <div className="events">
                {list.map((v) => (
                  <div key={v.id} className="event">
                    <span className="num" style={{ fontSize: 18, minWidth: 44 }}>
                      v{v.version}
                    </span>
                    <span className="ev-title">
                      <span>{v.note || "—"}</span>
                      <span className="muted small">
                        {exists(v.project_id) ? (
                          <Link href={`/p/${v.project_id}?tab=versoes`} className="arrow">
                            {v.title}
                          </Link>
                        ) : (
                          `${v.title} · ${t("hs.deleted")}`
                        )}
                      </span>
                    </span>
                    <span className="mono small">{new Date(v.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
