"use client";

import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DotGrid, LangSwitch, SessionTimer, useNow } from "@/components/ui";
import { useT } from "@/lib/i18n";
import type { Scene } from "@/lib/types";
import { useProject } from "@/lib/useProject";
import { fmtDate, isoDay, pad, projectStats, range, sessionStats, videoHost } from "@/lib/util";

/** Checklist de gravação, pensado para telemóvel. */
export default function Shoot() {
  const { t, locale } = useT();
  const { id } = useParams<{ id: string }>();
  const { project, missing, save, update } = useProject(id, 300);
  const [open, setOpen] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const now = useNow(60_000);

  // abre automaticamente a sessão a decorrer hoje
  useEffect(() => {
    if (!project || open || !now) return;
    const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const today = isoDay(now);
    const live = project.data.sessions.find((s) => (s.date || project.data.shootDate) === today && s.start <= hm && hm < s.end);
    if (live) setOpen(live.id);
  }, [project, open, now]);

  if (missing)
    return (
      <main className="wrap">
        <p style={{ paddingTop: 40 }}>{t("notFound")}</p>
      </main>
    );
  if (!project) return <main className="wrap" />;

  const d = project.data;
  const st = projectStats(d);
  const reel = (rid?: string) => d.reels.find((r) => r.id === rid);
  const loc = (lid?: string) => d.locations.find((l) => l.id === lid);

  function toggle(sid: string, bid: string, cid: string) {
    update((dd) => {
      const c = dd.sessions.find((s) => s.id === sid)!.blocks.find((b) => b.id === bid)!.scenes.find((x) => x.id === cid)!;
      c.done = !c.done;
    }, true);
  }

  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <div className="bar">
        <Link href={`/p/${id}?tab=cenas`} className="label">
          <Icon name="back" size={14} /> {t("sh.edit")}
        </Link>
        <div className="row" style={{ gap: 12 }}>
          <span className={`label ${save === "error" ? "tone-danger" : "muted"}`}>
            {save === "saving" ? t("saving") : save === "error" ? t("sh.offline") : t("sh.production")}
          </span>
          <LangSwitch />
        </div>
      </div>

      <section className="w" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "end" }}>
        <div className="stack">
          <span className="label muted">{[d.client, fmtDate(d.shootDate, locale)].filter(Boolean).join(" · ") || t("sh.production")}</span>
          <h1 className="h1" style={{ fontSize: "clamp(28px, 8vw, 48px)" }}>
            {project.title}
          </h1>
          <div className="row" style={{ gap: 8 }}>
            <span className="dot" style={{ background: st.done === st.scenes && st.scenes ? "var(--ok)" : "var(--accent)" }} />
            <span className="label">{st.done === st.scenes && st.scenes > 0 ? t("sh.allDone") : t("sh.shooting")}</span>
          </div>
          <DotGrid total={st.scenes} filled={st.done} cols={16} size={6} gap={5} color="var(--accent)" />
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="display" style={{ fontSize: "clamp(72px, 20vw, 140px)" }}>
            {pad(st.scenes - st.done)}
          </div>
          <div className="label muted" style={{ marginTop: 8 }}>
            {t("sh.left")}
          </div>
        </div>
      </section>

      <div className="row between" style={{ padding: "18px 0 6px" }}>
        <span className="label muted">{t("sh.sessions")}</span>
        <button className={`chip ${hideDone ? "on" : ""}`} onClick={() => setHideDone(!hideDone)}>
          {t("sh.hideDone")}
        </button>
      </div>

      {d.sessions.length === 0 && <p className="muted">{t("sh.noSessions")}</p>}

      {d.sessions.map((s, si) => {
        const ss = sessionStats(s);
        const isOpen = open === s.id;
        const l = loc(s.locationId);
        return (
          <section key={s.id} style={{ borderTop: "1px solid var(--line)" }}>
            <button className="sessionbtn" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
              <span className="num" style={{ fontSize: 44, color: isOpen ? "var(--accent)" : undefined }}>
                {pad(si + 1)}
              </span>
              <span>
                <span className="h2" style={{ display: "block" }}>
                  {s.label || t("sc.session")}
                </span>
                <span className="mono muted" style={{ fontSize: 12 }}>
                  {[range(s.start, s.end), l?.name].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span style={{ textAlign: "right" }}>
                <span className="num" style={{ fontSize: 28 }}>
                  {pad(ss.done)}
                  <span className="muted">/{pad(ss.total)}</span>
                </span>
                <span className="label muted" style={{ display: "block", marginTop: 4 }}>
                  {isOpen ? t("sh.close") : t("sh.open")}
                </span>
              </span>
            </button>

            {isOpen && (
              <div style={{ paddingBottom: 28 }}>
                {/* tempo disponível para encerrar a sessão */}
                <div className="w" style={{ marginBottom: 16, padding: 16 }}>
                  <SessionTimer
                    id={s.id}
                    label={t("w.timer")}
                    date={s.date || d.shootDate}
                    start={s.start}
                    end={s.end}
                    blocks={s.blocks}
                    allDone={ss.total > 0 && ss.done === ss.total}
                    size={150}
                  />
                </div>
                {(s.notes || l?.mapsUrl) && (
                  <div className="card row between" style={{ marginBottom: 16, padding: 14, borderRadius: 14 }}>
                    <span style={{ fontSize: 14 }}>{s.notes}</span>
                    {l?.mapsUrl && (
                      <a href={l.mapsUrl} target="_blank" rel="noreferrer" className="label arrow">
                        {t("sh.map")}
                      </a>
                    )}
                  </div>
                )}
                {s.blocks.map((b) => {
                  const scenes = hideDone ? b.scenes.filter((c) => !c.done) : b.scenes;
                  const bd = b.scenes.filter((c) => c.done).length;
                  return (
                    <div key={b.id} style={{ marginTop: 22 }}>
                      <div className="row between" style={{ paddingBottom: 8 }}>
                        <span className="label">{b.title || t("bl.label")}</span>
                        <span className="label muted">
                          {range(b.start, b.end)} · {bd}/{b.scenes.length}
                        </span>
                      </div>
                      {scenes.map((c) => (
                        <SceneRow key={c.id} scene={c} reelTitle={reel(c.reelId)?.title} onToggle={() => toggle(s.id, b.id, c.id)} onZoom={setZoom} />
                      ))}
                      {scenes.length === 0 && (
                        <p className="muted" style={{ fontSize: 13, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                          {b.scenes.length ? t("sh.blockDone") : t("sh.noScenes")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {d.definitions.some((x) => x.value) && (
        <section className="w" style={{ marginTop: 16 }}>
          <span className="label muted">{t("sh.defs")}</span>
          {d.definitions
            .filter((x) => x.value)
            .map((x) => (
              <div key={x.id} className="statrow">
                <span className="label" style={{ flex: 1 }}>
                  {x.label}
                </span>
                <span style={{ textAlign: "right" }}>{x.value}</span>
              </div>
            ))}
        </section>
      )}

      {zoom && (
        <div className="overlay" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" />
        </div>
      )}
    </main>
  );
}

function SceneRow({ scene: c, reelTitle, onToggle, onZoom }: { scene: Scene; reelTitle?: string; onToggle: () => void; onZoom: (url: string) => void }) {
  const { t } = useT();
  return (
    <div className={`scene ${c.done ? "done" : ""}`}>
      <button className="check" role="checkbox" aria-checked={c.done} aria-label={c.title} onClick={onToggle} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="scene-title" style={{ fontSize: 17, lineHeight: 1.25, cursor: "pointer" }} onClick={onToggle}>
          {c.title || t("cn.label")}
        </div>
        {c.description && (
          <div className="muted" style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap" }}>
            {c.description}
          </div>
        )}
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          {reelTitle && <span className="chip accent">{reelTitle}</span>}
          {c.videoUrl && (
            <a className="chip" href={c.videoUrl} target="_blank" rel="noreferrer">
              <Icon name="play" size={14} /> {videoHost(c.videoUrl)}
            </a>
          )}
          {c.links.map((l, i) => (
            <a key={i} className="chip" href={l.url} target="_blank" rel="noreferrer">
              {l.label} <Icon name="arrow" size={14} />
            </a>
          ))}
        </div>
      </div>
      {c.imageUrl && (
        <button style={{ padding: 0, border: 0, background: "none" }} onClick={() => onZoom(c.imageUrl!)} aria-label={t("sh.viewRef")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.imageUrl} alt="" className="thumb" />
        </button>
      )}
    </div>
  );
}
