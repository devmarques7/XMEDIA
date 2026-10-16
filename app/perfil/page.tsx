"use client";

import { Icon } from "@/components/Icon";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProjectsTable } from "@/components/ProjectsTable";
import { AppShell, Avatar, LangSwitch, Toast, useToast, useUser } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { download } from "@/lib/io";
import { isLocalMode, store } from "@/lib/store";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import { emptyProfile, type Profile } from "@/lib/types";
import { useProjects } from "@/lib/useProjects";
import { pad, projectStats } from "@/lib/util";

const TABS = ["info", "edit", "projects", "account"] as const;
type Tab = (typeof TABS)[number];

export default function Page() {
  return (
    <Suspense>
      <ProfilePage />
    </Suspense>
  );
}

function ProfilePage() {
  const { t, locale } = useT();
  const router = useRouter();
  const tab = (useSearchParams().get("tab") as Tab) || "info";
  const account = useUser();
  const { projects, reload } = useProjects();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [form, setForm] = useState<Profile>(emptyProfile());
  const [interests, setInterests] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const [versions, setVersions] = useState(0);

  useEffect(() => {
    store
      .profile()
      .then((p) => {
        setProfile(p);
        setForm(p ?? emptyProfile());
        setInterests((p?.interests ?? []).join(", "));
      })
      .catch((e) => setToast(e.message));
    store.allVersions(1000).then((v) => setVersions(v.length)).catch(() => {});
  }, [setToast]);

  // pré-preenche o formulário com a conta Google quando ainda não há perfil
  useEffect(() => {
    if (profile === null && account) setForm((f) => ({ ...f, display_name: f.display_name || account.name, avatar_url: f.avatar_url || account.avatar || "" }));
  }, [profile, account]);

  const go = (k: Tab) => router.replace(`/perfil?tab=${k}`, { scroll: false });
  const stats = (projects ?? []).reduce((a, p) => {
    const s = projectStats(p.data);
    return { scenes: a.scenes + s.scenes, done: a.done + s.done };
  }, { scenes: 0, done: 0 });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const next = { ...form, interests: interests.split(",").map((s) => s.trim()).filter(Boolean) };
    try {
      await store.saveProfile(next);
      setProfile(next);
      setToast(t("pf.saved"));
      go("info");
    } catch (err) {
      setToast((err as Error).message);
    }
    setBusy(false);
  }

  async function exportAll() {
    const all = { profile, projects, versions: await store.allVersions(1000), exportedAt: new Date().toISOString() };
    download(`xmedia-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(all, null, 2), "application/json");
  }

  async function deleteProfile() {
    if (!confirm(t("pf.deleteProfileConfirm"))) return;
    await store.removeProfile();
    setProfile(null);
    setForm(emptyProfile());
    setInterests("");
    setToast(t("pf.deleted"));
  }

  async function deleteAll() {
    if (!confirm(t("pf.deleteAllConfirm"))) return;
    for (const p of projects ?? []) await store.remove(p.id);
    await store.removeProfile();
    await reload();
    setProfile(null);
    setToast(t("pf.deleted"));
  }

  async function logout() {
    await supabase().auth.signOut();
    location.href = "/login";
  }

  const name = profile?.display_name || account?.name || "—";
  const view = { ...account, name, email: account?.email ?? "", avatar: profile?.avatar_url || account?.avatar };

  return (
    <AppShell>
      {/* cartão de perfil (ref. "Anna K.") */}
      <section className="profilecard">
        <div className="pc-photo">
          {view.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.avatar} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="dots" style={{ width: "100%", height: "100%" }} />
          )}
        </div>
        <div className="pc-count">
          <span className="display">{projects ? pad(projects.length) : "··"}</span>
          <span className="row" style={{ gap: 8 }}>
            <span className="dot" style={{ background: "var(--live)" }} />
            <span className="label">{t("nav.projects")}</span>
          </span>
          {profile?.created_at && (
            <span className="muted small">{t("pf.since", { date: new Date(profile.created_at).toLocaleDateString(locale, { month: "short", year: "numeric" }) })}</span>
          )}
        </div>
        <div className="pc-name">
          <h1 className="h1">{name}</h1>
          <div className="label" style={{ marginTop: 10 }}>
            {profile?.role || "—"}
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            {[profile?.city, view.email].filter(Boolean).join(" · ")}
          </div>
        </div>
      </section>

      <nav className="tabs" role="tablist">
        {TABS.map((k, i) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(k)}>
            <b>{pad(i + 1)}</b>
            {t(`pf.tab.${k}` as "pf.tab.info")}
          </button>
        ))}
      </nav>

      {tab === "info" &&
        (profile === null ? (
          <div className="w" style={{ marginTop: 18 }}>
            <p style={{ marginTop: 0 }}>{t("pf.empty")}</p>
            <button className="btn accent" onClick={() => go("edit")}>
              {t("pf.tab.edit")} <Icon name="arrow" size={14} />
            </button>
          </div>
        ) : (
          <div style={{ paddingTop: 18 }}>
            {profile?.bio && (
              <div className="section" style={{ paddingTop: 0 }}>
                <div className="label muted">{t("pf.bio")}</div>
                <p style={{ fontSize: 18, maxWidth: 560, marginBottom: 0 }}>{profile.bio}</p>
              </div>
            )}
            {!!profile?.interests.length && (
              <div className="section">
                <div className="label muted" style={{ marginBottom: 10 }}>
                  {t("pf.interests")}
                </div>
                <div className="row">
                  {profile.interests.map((x) => (
                    <span key={x} className="chip">
                      {x}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="widgets" style={{ paddingTop: 18 }}>
              {[
                [t("nav.projects"), projects?.length ?? 0, "/projetos"],
                [t("pf.scenesDone"), `${stats.done}/${stats.scenes}`, "/calendario"],
                [t("pf.versions"), versions, "/historico"],
              ].map(([label, value, href]) => (
                <Link key={label as string} href={href as string} className="w span-4">
                  <div className="label muted">{label}</div>
                  <div className="num arrow" style={{ fontSize: 40, marginTop: 12 }}>
                    {value}
                  </div>
                </Link>
              ))}
            </div>
            {(profile?.website || profile?.phone) && (
              <div className="row" style={{ gap: 18 }}>
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noreferrer" className="arrow">
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {profile.phone && <a href={`tel:${profile.phone}`}>{profile.phone}</a>}
              </div>
            )}
          </div>
        ))}

      {tab === "edit" && (
        <form className="w stack" style={{ marginTop: 18 }} onSubmit={save}>
          <div className="row" style={{ gap: 16 }}>
            <Avatar user={{ name: form.display_name, email: "", avatar: form.avatar_url }} />
            <label className="field" style={{ flex: 1 }}>
              <span>{t("pf.name")}</span>
              <input className="input big" required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </label>
          </div>
          <div className="grid2">
            <label className="field">
              <span>{t("pf.role")}</span>
              <input className="input" placeholder={t("pf.rolePh")} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("pf.city")}</span>
              <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>{t("pf.bio")}</span>
            <textarea className="textarea" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </label>
          <label className="field">
            <span>
              {t("pf.interests")} · {t("pf.interestsHint")}
            </span>
            <input className="input" value={interests} placeholder="Reels, Fotografia, Branding" onChange={(e) => setInterests(e.target.value)} />
          </label>
          <div className="grid2">
            <label className="field">
              <span>{t("pf.website")}</span>
              <input className="input" type="url" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("pf.phone")}</span>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>{t("pf.avatar")}</span>
            <input className="input" type="url" placeholder="https://" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} />
          </label>
          <div className="row">
            <button className="btn accent" type="submit" disabled={busy}>
              {t("pf.save")}
            </button>
            <button className="btn ghost" type="button" onClick={() => go("info")}>
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      {tab === "projects" && (
        <section className="w" style={{ marginTop: 18 }}>
          <div className="w-head">
            <span className="label">
              <b>{pad(projects?.length ?? 0)}</b>
              {t("nav.projects")}
            </span>
            <span className="pill">{t("pf.owner")}</span>
          </div>
          {projects?.length === 0 ? <p className="muted">{t("pf.noProjects")}</p> : <ProjectsTable projects={projects ?? []} actions />}
        </section>
      )}

      {tab === "account" && (
        <div className="stack" style={{ marginTop: 18 }}>
          <div className="w row between">
            <span className="label">Language / Idioma / Taal</span>
            <LangSwitch />
          </div>
          <div className="w row between">
            <span>{t("pf.export")}</span>
            <button className="btn" onClick={exportAll}>
              JSON <Icon name="download" size={14} />
            </button>
          </div>
          {supabaseEnabled && !isLocalMode && (
            <div className="w row between">
              <span className="muted">{view.email}</span>
              <button className="btn" onClick={logout}>
                {t("logout")}
              </button>
            </div>
          )}
          <div className="w stack" style={{ border: "1px solid rgba(255,74,61,.35)" }}>
            <span className="label tone-danger">{t("pf.dangerZone")}</span>
            <div className="row">
              <button className="btn danger" onClick={deleteProfile} disabled={!profile}>
                {t("pf.deleteProfile")}
              </button>
              <button className="btn danger" onClick={deleteAll}>
                {t("pf.deleteAll")}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast msg={toast} />
    </AppShell>
  );
}
