"use client";

import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DataIO, Locations, Overview, Reels, Schedule, Versions } from "@/components/sections";
import { AppShell, DotGrid, Toast, useToast } from "@/components/ui";
import { useT, type Key } from "@/lib/i18n";
import { store } from "@/lib/store";
import { useProject } from "@/lib/useProject";
import { pad, projectStats } from "@/lib/util";

const TABS = ["geral", "reels", "locais", "cenas", "versoes", "dados"] as const;
type Tab = (typeof TABS)[number];

export default function Page() {
  return (
    <Suspense>
      <Editor />
    </Suspense>
  );
}

function Editor() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get("tab") as Tab) || "geral";
  const { project, missing, save, update, setTitle, replace, flush } = useProject(id);
  const [toast, setToast] = useToast();

  if (missing)
    return (
      <AppShell>
        <p style={{ paddingTop: 40 }}>
          {t("notFound")}{" "}
          <Link href="/home" className="arrow">
            {t("back")}
          </Link>
        </p>
      </AppShell>
    );
  if (!project) return <AppShell>{null}</AppShell>;

  const s = projectStats(project.data);
  const saveText = { idle: "", saving: t("saving"), saved: t("saved"), error: t("saveError") }[save];

  async function remove() {
    if (!confirm(t("ed.deleteConfirm", { t: project!.title }))) return;
    await store.remove(project!.id);
    router.push("/home");
  }

  return (
    <AppShell
      left={<span className="label muted hide-sm">{project.data.client || t("col.project")}</span>}
      right={<span className={`label ${save === "error" ? "tone-danger" : "muted"}`}>{saveText}</span>}
    >

      <section style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, padding: "28px 0 20px", alignItems: "start" }}>
        <div>
          <span className="label muted">
            {project.data.client || t("ed.client")} · v{project.version}
          </span>
          <textarea
            className="input title"
            rows={1}
            aria-label={t("col.name")}
            style={{ resize: "none", overflow: "hidden", fieldSizing: "content" } as React.CSSProperties}
            value={project.title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="row" style={{ marginTop: 16 }}>
            <Link href={`/p/${project.id}/shoot`} className="btn accent">
              <Icon name="play" size={14} /> {t("ed.production")}
            </Link>
          </div>
        </div>
        <div className="w" style={{ textAlign: "right", minWidth: 220 }}>
          <div className="row between">
            <span className="label">{t("col.reels")}</span>
            <span className="dot" />
          </div>
          <div className="display" style={{ fontSize: "clamp(64px, 10vw, 120px)", margin: "6px 0" }}>
            {pad(s.reels)}
          </div>
          <div className="row between" style={{ alignItems: "end" }}>
            <DotGrid total={s.scenes} filled={s.done} cols={10} size={5} gap={4} />
            <span className="mono muted" style={{ fontSize: 12 }}>
              {s.scenes} {t("ed.planned")}
            </span>
          </div>
        </div>
      </section>

      <nav className="tabs" role="tablist">
        {TABS.map((key, i) => (
          <button
            key={key}
            role="tab"
            className="tab"
            aria-selected={tab === key}
            onClick={() => router.replace(`/p/${id}?tab=${key}`, { scroll: false })}
          >
            <b>{pad(i + 1)}</b>
            {t(`tab.${key}` as Key)}
          </button>
        ))}
      </nav>

      {tab === "geral" && <Overview data={project.data} update={update} />}
      {tab === "reels" && <Reels data={project.data} update={update} />}
      {tab === "locais" && <Locations data={project.data} update={update} />}
      {tab === "cenas" && <Schedule data={project.data} update={update} />}
      {tab === "versoes" && <Versions project={project} flush={flush} onRestored={replace} toast={setToast} />}
      {tab === "dados" && (
        <>
          <DataIO project={project} update={update} setTitle={setTitle} flush={flush} toast={setToast} />
          <div style={{ paddingTop: 48 }}>
            <button className="btn danger" onClick={remove}>
              {t("ed.delete")}
            </button>
          </div>
        </>
      )}
      <Toast msg={toast} />
    </AppShell>
  );
}
