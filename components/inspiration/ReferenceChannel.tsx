"use client";

// Canal de referências de marca: colar links do Instagram, YouTube, TikTok, Pinterest, Vimeo (ou qualquer site),
// agrupá-los por tema e ver os conteúdos dentro da plataforma (embed). Grupos criados à mão.
import { Select } from "@/components/Select";
import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useT, type Key } from "@/lib/i18n";
import { parseRef, type Platform, type RefGroup, type RefItem, type References } from "@/lib/references";
import type { Moodboard } from "@/lib/moodboard";
import { MoodboardEditor, type InspirationIO } from "./MoodboardEditor";

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const PLATFORMS: Platform[] = ["instagram", "youtube", "tiktok", "pinterest", "vimeo", "web"];

export function ReferenceChannel({ refs, readOnly, me, io, onSave }: { refs: References; readOnly?: boolean; me: string; io: InspirationIO; onSave: (patch: References) => Promise<unknown> }) {
  const { t } = useT();
  const groups = refs.groups.filter((g) => !g.deleted);
  const items = refs.items.filter((i) => !i.deleted);
  const [group, setGroup] = useState<string>("all");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [target, setTarget] = useState<string>(groups[0]?.id ?? "");
  const [newGroup, setNewGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const urlRef = useRef<HTMLInputElement>(null);
  /** Cartão "+": foca o campo e, se houver um link na área de transferência, já o cola. */
  async function startAdd() {
    urlRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    urlRef.current?.focus();
    try {
      const clip = (await navigator.clipboard?.readText?.())?.trim() ?? "";
      if (/^https?:\/\/\S+$/.test(clip) && !url) setUrl(clip);
    } catch {}
  }
  const now = () => new Date().toISOString();
  const shown = useMemo(() => items.filter((i) => (group === "all" || (group === "none" ? !groups.some((g) => g.id === i.group) : i.group === group)) && (platform === "all" || i.platform === platform)), [items, group, platform, groups]);
  const p = parseRef(url);

  async function addGroup() {
    const name = newGroup.trim();
    if (!name) return;
    const g: RefGroup = { id: uid(), name, updated: now() };
    await onSave({ groups: [g], items: [] });
    setNewGroup("");
    setTarget(g.id);
    setGroup(g.id);
  }
  async function add() {
    if (!p) return setErr(t("rf.bad"));
    setBusy(true);
    setErr("");
    let title = "";
    let thumb = p.thumb;
    if (p.platform === "web" || p.platform === "pinterest") {
      const pv = await io.preview(p.url).catch(() => null);
      title = pv?.title ?? "";
      thumb = pv?.image || thumb;
    }
    const at = now();
    const it: RefItem = { id: uid(), url: p.url, platform: p.platform, group: target, title, note: note.trim(), thumb, by: me, at, updated: at };
    await onSave({ groups: [], items: [it] });
    setUrl("");
    setNote("");
    setBusy(false);
  }
  const patchItem = (i: RefItem, x: Partial<RefItem>) => onSave({ groups: [], items: [{ ...i, ...x, updated: now() }] });
  const count = (id: string) => items.filter((i) => i.group === id).length;

  return (
    <section className="widgets" style={{ padding: 0 }}>
      <div className="w span-12 stack">
        <div className="row between">
          <div>
            <span className="tile-t">{t("rf.title")}</span>
            <p className="muted small" style={{ margin: "6px 0 0" }}>
              {t("rf.sub")}
            </p>
          </div>
        </div>
        {!readOnly && (
          <div className="rf-add">
            <input ref={urlRef} className="input" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={t("rf.urlPh")} data-testid="rf-url" />
            {p && <span className={`rf-plat p-${p.platform}`}>{t(`rf.p.${p.platform}` as Key)}</span>}
            <Select className="select" value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t("rf.group")} style={{ width: 180 }}>
              <option value="">{t("rf.noGroup")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("rf.notePh")} style={{ maxWidth: 260 }} />
            <button className="btn accent" onClick={add} disabled={busy || !url.trim()} data-testid="rf-add">
              {busy ? "…" : `+ ${t("rf.add")}`}
            </button>
          </div>
        )}
        {err && <p className="note tone-danger small">{err}</p>}
        <div className="row" style={{ gap: 6 }}>
          <button className={`cb-chip ${group === "all" ? "on" : ""}`} onClick={() => setGroup("all")}>
            {t("bd.all")} <span className="muted">{items.length}</span>
          </button>
          {groups.map((g) => (
            <span key={g.id} className={`cb-chip rf-g ${group === g.id ? "on" : ""}`} role="button" tabIndex={0} onClick={() => setGroup(g.id)}>
              {g.name} <span className="muted">{count(g.id)}</span>
              {!readOnly && group === g.id && (
                <>
                  <button
                    className="rf-gx"
                    title={t("ra.edit")}
                    onClick={(e) => {
                      e.stopPropagation();
                      const name = prompt(t("rf.rename"), g.name)?.trim();
                      if (name) onSave({ groups: [{ ...g, name, updated: now() }], items: [] });
                    }}
                  >
                    <Icon name="edit" size={12} />
                  </button>
                  <button
                    className="rf-gx"
                    title={t("ra.delete")}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t("ra.confirmDelete", { name: g.name }))) {
                        onSave({ groups: [{ ...g, deleted: true, updated: now() }], items: [] });
                        setGroup("all");
                      }
                    }}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </>
              )}
            </span>
          ))}
          {!readOnly && (
            <span className="row" style={{ gap: 4 }}>
              <input className="input small" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGroup()} placeholder={t("rf.newGroup")} style={{ width: 160 }} data-testid="rf-group" />
              <button className="btn small" onClick={addGroup} disabled={!newGroup.trim()} data-testid="rf-group-add">
                +
              </button>
            </span>
          )}
          <Select className="select" value={platform} onChange={(e) => setPlatform(e.target.value as Platform | "all")} style={{ width: "auto", marginLeft: "auto" }} aria-label="platform">
            <option value="all">{t("bd.all")}</option>
            {PLATFORMS.map((x) => (
              <option key={x} value={x}>
                {t(`rf.p.${x}` as Key)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {readOnly && !shown.length && <p className="muted w span-12">{t("rf.empty")}</p>}
      <div className="span-12 rf-grid">
        {/* cartão fantasma: abre a adição (e cola o link copiado, se houver) */}
        {!readOnly && (
          <button className="rf-ghost" onClick={startAdd} data-testid="rf-ghost">
            <span className="rf-ghost-media" aria-hidden>
              <span className="mb-plus">
                <Icon name="plus" size={26} />
              </span>
            </span>
            <b>{items.length ? t("rf.addOne") : t("rf.first")}</b>
            <span className="muted small">{t("rf.firstSub")}</span>
          </button>
        )}
        {shown.map((i) => (
          <RefCard key={i.id} i={i} groups={groups} readOnly={readOnly} onMove={(g) => patchItem(i, { group: g })} onDelete={() => confirm(t("ra.confirmDelete", { name: i.title || i.url })) && patchItem(i, { deleted: true })} />
        ))}
      </div>
    </section>
  );
}

function RefCard({ i, groups, readOnly, onMove, onDelete }: { i: RefItem; groups: RefGroup[]; readOnly?: boolean; onMove: (g: string) => void; onDelete: () => void }) {
  const { t, locale } = useT();
  const p = parseRef(i.url);
  const [play, setPlay] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const embed = p?.embed;
  // vídeos com miniatura carregam o leitor só ao clicar (página leve); Instagram/TikTok/Pinterest embebidos com lazy
  const lazyThumb = !!(p?.thumb && (p.platform === "youtube" || p.platform === "vimeo"));
  return (
    <article className={`rf-card ${p?.vertical ? "v" : "h"}`} data-testid="rf-card">
      <div className="rf-media">
        {embed && (!lazyThumb || play) ? (
          <iframe src={`${embed}${play && p?.platform === "youtube" ? "?autoplay=1" : ""}`} title={i.title || i.url} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        ) : i.thumb && !imgErr ? (
          <button className="rf-thumb" onClick={() => (embed ? setPlay(true) : window.open(i.url, "_blank", "noopener"))}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.thumb} alt="" loading="lazy" onError={() => setImgErr(true)} />
            {embed && <span className="cb-play"><Icon name="play" size={14} /></span>}
          </button>
        ) : (
          <a className="rf-none" href={i.url} target="_blank" rel="noreferrer">
            <Icon name="alert" size={14} /> {t("mb.broken")} <Icon name="arrow" size={14} />
          </a>
        )}
      </div>
      <div className="rf-info">
        <span className="row between" style={{ gap: 6 }}>
          <span className={`rf-plat p-${i.platform}`}>{t(`rf.p.${i.platform}` as Key)}</span>
          <span className="mono small muted">{new Date(i.at).toLocaleDateString(locale, { day: "2-digit", month: "short" })}</span>
        </span>
        {i.title && <b className="rf-title">{i.title}</b>}
        {i.note && <span className="small">{i.note}</span>}
        <span className="row between" style={{ gap: 6 }}>
          <a className="small muted" href={i.url} target="_blank" rel="noreferrer">
            {t("rf.open")} <Icon name="arrow" size={14} />
          </a>
          {!readOnly && (
            <span className="row" style={{ gap: 4 }}>
              <Select className="select small" value={i.group} onChange={(e) => onMove(e.target.value)} aria-label={t("rf.group")} style={{ width: 120 }}>
                <option value="">{t("rf.noGroup")}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
              <button className="btn ghost small" onClick={onDelete} aria-label={t("ra.delete")}>
                <Icon name="trash" size={14} />
              </button>
            </span>
          )}
        </span>
      </div>
    </article>
  );
}

/** Moodboards + referências num só lugar (separadores). */
export function Inspiration({ boards, refs, readOnly, me, io, onSaveBoards, onSaveRefs }: { boards: Moodboard[]; refs: References; readOnly?: boolean; me: string; io: InspirationIO; onSaveBoards: (b: Moodboard[]) => Promise<unknown>; onSaveRefs: (r: References) => Promise<unknown> }) {
  const { t } = useT();
  const [tab, setTab] = useState<"boards" | "refs">("boards");
  return (
    <div className="stack" style={{ gap: "var(--gap)" }}>
      <nav className="acc-nav">
        <button aria-current={tab === "boards" ? "page" : undefined} onClick={() => setTab("boards")} data-testid="insp-boards">
          {t("mb.title")}
        </button>
        <button aria-current={tab === "refs" ? "page" : undefined} onClick={() => setTab("refs")} data-testid="insp-refs">
          {t("rf.title")}
        </button>
      </nav>
      {tab === "boards" ? <MoodboardEditor boards={boards} readOnly={readOnly} me={me} io={io} onSave={onSaveBoards} /> : <ReferenceChannel refs={refs} readOnly={readOnly} me={me} io={io} onSave={onSaveRefs} />}
    </div>
  );
}
