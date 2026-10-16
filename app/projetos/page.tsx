"use client";

import { Icon } from "@/components/Icon";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Pipeline } from "@/components/customer/Pipeline";
import { ImportDialog } from "@/components/ImportDialog";
import { ProjectsTable } from "@/components/ProjectsTable";
import { AppShell } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { store } from "@/lib/store";
import { emptyData } from "@/lib/types";
import { useProjects } from "@/lib/useProjects";
import { pad, projectStats } from "@/lib/util";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Page() {
  return (
    <Suspense>
      <ProjectsPage />
    </Suspense>
  );
}

/** Projetos de pré-produção e, no separador Conteúdos, o pipeline de todos os conteúdos dos clientes. */
function ProjectsPage() {
  const { t } = useT();
  const router = useRouter();
  const tab = useSearchParams().get("view") === "conteudos" ? "content" : "projects";
  const { projects, error, reload } = useProjects();
  const [q, setQ] = useState("");
  const [importing, setImporting] = useState(false);

  const list = useMemo(
    () => (projects ?? []).filter((p) => !q || norm(`${p.title} ${p.data.client}`).includes(norm(q))),
    [projects, q]
  );
  const totals = list.reduce(
    (a, p) => {
      const s = projectStats(p.data);
      return { s: a.s + s.scenes, d: a.d + s.done };
    },
    { s: 0, d: 0 }
  );

  async function create() {
    const p = await store.create(t("newProjectTitle"), emptyData({ format: t("def.format"), look: t("def.look"), gear: t("def.gear") }));
    router.push(`/p/${p.id}`);
  }

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("pj.sub", { n: list.length, s: totals.s, d: totals.d })}</span>
          <h1 className="h1">{t("nav.projects")}</h1>
        </div>
        <div className="display">{projects ? pad(list.length) : "··"}</div>
      </section>

      <nav className="tabs" role="tablist" style={{ marginBottom: 14 }}>
        <button className="tab" role="tab" aria-selected={tab === "projects"} onClick={() => router.replace("/projetos", { scroll: false })}>
          {t("pl.tabProjects")}
        </button>
        <button className="tab" role="tab" aria-selected={tab === "content"} onClick={() => router.replace("/projetos?view=conteudos", { scroll: false })}>
          {t("pl.tabContent")}
        </button>
      </nav>

      {tab === "content" && <Pipeline />}
      {tab === "projects" && (
        <>

      <div className="row" style={{ marginBottom: 14 }}>
        <label className="search" style={{ flex: 1, minWidth: 220 }}>
          <span className="muted" aria-hidden>
            ⌕
          </span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("home.search")} aria-label={t("home.search")} />
        </label>
        <button className="btn" onClick={() => setImporting(true)}>
          <Icon name="upload" size={14} /> {t("home.import")}
        </button>
        <button className="btn solid" onClick={create}>
          + {t("home.new")}
        </button>
      </div>

      {error && <p className="tone-danger">{error}</p>}
      <section className="w">
        {projects && list.length === 0 ? (
          <p className="muted">{q ? t("home.noResults", { q }) : t("home.empty")}</p>
        ) : (
          <ProjectsTable projects={list} actions onChanged={reload} />
        )}
      </section>
        </>
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </AppShell>
  );
}
