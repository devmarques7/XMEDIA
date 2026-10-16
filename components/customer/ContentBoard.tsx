"use client";

// Quadro de conteúdos (estilo Trello) agrupado pelas fases do processo: cartões com pré-visualização do vídeo
// (toca ao passar o rato), etiqueta de tipo bem visível, estado, ronda e comentários. Filtro por tipo e pesquisa.
// Portal e admin: arrastar um cartão para outra etapa (onMove) atualiza o estado; canMove limita os destinos.
import { Avatar } from "@/components/team/Avatar";
import { useTeamDirectory } from "@/components/team/useTeamDirectory";
import { mmss } from "@/lib/music";
import { StreamVideo } from "@/components/StreamVideo";
import { Icon } from "@/components/Icon";
import { useMemo, useRef, useState } from "react";
import { useBoardDrag } from "@/lib/useBoardDrag";
import { DEFAULT_CLIENT_PROCESS, groupName, normalizeProcessDef, stageName, stageOf, type ClientProcess, type ProcessStage } from "@/lib/clientProcess";
import { thumbOf, POST_TYPES, liveNotes, openNotes, phaseOf, type ContentPost, type Phase, type PostType } from "@/lib/customer";
import { validationState } from "@/lib/validation";
import { useT, type Key } from "@/lib/i18n";
import { useMediaSrc } from "@/lib/media";
import { useVideoPoster } from "@/lib/videoPoster";
import { Cover, StatusLabel, TypeIcon } from "./parts";
import { WithMenu, type MenuAction } from "@/components/ContextMenu";
import { QuickTask } from "@/components/QuickTask";

export const BOARD_COLS: Exclude<Phase, "blocked">[] = ["idea", "editing", "client_review", "changes", "approved", "scheduled", "published"];

/** Fase do quadro (bloqueados ficam na coluna "em edição" com etiqueta). */
export const boardPhase = (p: ContentPost) => {
  const ph = phaseOf(p);
  return ph === "blocked" ? "editing" : ph;
};

/**
 * Quadro com as etapas do processo DESTE cliente (nomes, grupos e prazos ajustáveis). onMove recebe a etapa de destino.
 */
export function ContentBoard({ posts, process, onOpen, onMove, canMove, hideEmpty, onCreate, canCreate, onDelete, clientOf, showOwner }: { posts: ContentPost[]; process?: ClientProcess; onOpen: (p: ContentPost) => void; onDelete?: (p: ContentPost) => void; /** Cliente de cada cartão (nome e foto). */ clientOf?: (id: string) => { name: string; photo?: string } | undefined; /** Mostrar o responsável no estúdio. */ showOwner?: boolean; onMove?: (id: string, stage: ProcessStage) => void; canMove?: (p: ContentPost, to: ProcessStage) => boolean; hideEmpty?: boolean; onCreate?: (stage: ProcessStage, title: string, type: PostType) => unknown; canCreate?: (stage: ProcessStage) => boolean }) {
  const { t, locale } = useT();
  const [view, setView] = useState<"kanban" | "table">(() => {
    try {
      return (localStorage.getItem("xmedia:board:view") as "kanban" | "table") || "kanban";
    } catch {
      return "kanban";
    }
  });
  const pickView = (v: "kanban" | "table") => {
    setView(v);
    try {
      localStorage.setItem("xmedia:board:view", v);
    } catch {}
  };
  // "+" em cada coluna: cartão rápido (título + tipo) criado nessa etapa
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", type: "reel" as PostType });
  const may = (st: ProcessStage) => !!onCreate && (canCreate?.(st) ?? true);
  async function create(st: ProcessStage) {
    if (!draft.title.trim()) return;
    await onCreate?.(st, draft.title.trim(), draft.type);
    setDraft({ title: "", type: draft.type });
    setAdding(null);
  }
  const proc = useMemo(() => (process ? normalizeProcessDef(process) : DEFAULT_CLIENT_PROCESS), [process]);
  const [type, setType] = useState<PostType | "all">("all");
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return posts.filter((p) => (type === "all" || p.type === type) && (!n || `${p.title} ${p.caption}`.toLowerCase().includes(n)));
  }, [posts, type, q]);
  const dnd = useBoardDrag({
    disabled: !onMove,
    onDrop: (id, to) => {
      const st = proc.stages.find((x) => x.id === to);
      if (st) onMove?.(id, st);
    },
    canDrop: (id, to) => {
      const p = posts.find((x) => x.id === id);
      const st = proc.stages.find((x) => x.id === to);
      return !!p && !!st && (canMove?.(p, st) ?? true);
    },
  });
  const cols = proc.stages.filter((st) => !hideEmpty || st.client || shown.some((p) => stageOf(p, proc).id === st.id));

  return (
    <section className="cb">
      <div className="cb-bar">
        <div className="row" style={{ gap: 6 }}>
          {(["all", ...POST_TYPES] as const).map((k) => {
            const n = k === "all" ? posts.length : posts.filter((p) => p.type === k).length;
            if (k !== "all" && !n) return null;
            return (
              <button key={k} className={`cb-chip ${k !== "all" ? `ty-${k}` : ""} ${type === k ? "on" : ""}`} onClick={() => setType(k)} aria-pressed={type === k}>
                {k !== "all" && <TypeIcon type={k} />} {k === "all" ? t("bd.all") : t(`ct.type.${k}` as Key)} <span className="muted">{n}</span>
              </button>
            );
          })}
        </div>
        <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <input className="input cb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("bd.search")} aria-label={t("bd.search")} />
          <div className="seg" role="group" aria-label={t("cb.view")}>
            <button aria-pressed={view === "kanban"} onClick={() => pickView("kanban")} title={t("pr.kanban")} data-testid="cb-view-kanban">
              <Icon name="board" size={13} />
            </button>
            <button aria-pressed={view === "table"} onClick={() => pickView("table")} title={t("pr.table")} data-testid="cb-view-table">
              <Icon name="menu" size={13} />
            </button>
          </div>
        </span>
      </div>
      <p className="muted small" style={{ margin: "0 2px 10px" }}>
        {onMove ? (canMove ? t("kb.clientHint") : t("kb.hint")) : t("bd.hint")}
      </p>
      {view === "kanban" && (
      <div className={`cb-board ${dnd.board}`} data-kb-scroll>
        {cols.map((col) => {
          const items = shown.filter((p) => stageOf(p, proc).id === col.id).sort((a, b) => (a.scheduled_at || "9").localeCompare(b.scheduled_at || "9"));
          return (
            <section key={col.id} {...dnd.col(col.id)} className={`cb-col ${col.client ? "cb-client" : ""} ${dnd.col(col.id).className}`}>
              <header className="cb-head">
                <span style={{ minWidth: 0 }}>
                  <span className="tile-t">{stageName(col, t)}</span>
                  <span className="cb-group">
                    {groupName(col.group, t)}
                    {col.days > 0 && ` · ${col.days}d`}
                    {col.auto && " · auto"}
                  </span>
                </span>
                <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                  <span className="mono small muted">{String(items.length).padStart(2, "0")}</span>
                  {may(col) && (
                    <button className="cb-plus" onClick={() => setAdding(adding === col.id ? null : col.id)} aria-label={t("cb.add")} title={t("cb.add")} data-testid="cb-plus">
                      <Icon name={adding === col.id ? "close" : "plus"} size={14} />
                    </button>
                  )}
                </span>
              </header>
              {adding === col.id && (
                <form className="cb-quick" onSubmit={(e) => (e.preventDefault(), create(col))}>
                  <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={t("cb.titlePh")} autoFocus data-testid="cb-quick-title" />
                  <div className="row between" style={{ gap: 6 }}>
                    <div className="seg" role="group">
                      {POST_TYPES.map((ty) => (
                        <button type="button" key={ty} aria-pressed={draft.type === ty} onClick={() => setDraft({ ...draft, type: ty })} title={t(`ct.type.${ty}` as Key)}>
                          <TypeIcon type={ty} />
                        </button>
                      ))}
                    </div>
                    <button className="btn small accent" disabled={!draft.title.trim()} data-testid="cb-quick-add">
                      {t("cb.create")}
                    </button>
                  </div>
                </form>
              )}
              {dnd.over === col.id && dnd.canDropHere(col.id) && <div className="kb-slot">{t("kb.dropHere")}</div>}
              {items.map((p) => (
                <BoardCard key={p.id} p={p} onOpen={onOpen} onDelete={onDelete} clientInfo={clientOf?.(p.customer_id)} showOwner={showOwner} drag={onMove ? dnd.card(p.id, col.id) : undefined} />
              ))}
              {!items.length && adding !== col.id && (may(col) ? (
                <button className="cb-ghost" onClick={() => setAdding(col.id)}>
                  <Icon name="plus" size={14} /> {t("cb.add")}
                </button>
              ) : (
                <span className="cb-empty">{t("bd.empty")}</span>
              ))}
            </section>
          );
        })}
      </div>
      )}

      {view === "table" && (
        <div className="cb-table">
          {cols.map((col) => {
            const items = shown.filter((p) => stageOf(p, proc).id === col.id);
            return (
              <section key={col.id} className="cb-tsec">
                <header className="cb-thead">
                  <b>{stageName(col, t)}</b>
                  <span className="mono small muted">{String(items.length).padStart(2, "0")}</span>
                  {may(col) && (
                    <button className="cb-plus" onClick={() => setAdding(adding === col.id ? null : col.id)} aria-label={t("cb.add")}>
                      <Icon name={adding === col.id ? "close" : "plus"} size={14} />
                    </button>
                  )}
                </header>
                {adding === col.id && (
                  <form className="cb-quick row" onSubmit={(e) => (e.preventDefault(), create(col))}>
                    <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={t("cb.titlePh")} autoFocus />
                    <button className="btn small accent" disabled={!draft.title.trim()}>
                      {t("cb.create")}
                    </button>
                  </form>
                )}
                {items.map((p) => {
                  const all = liveNotes(p).length;
                  const open = openNotes(p).length;
                  return (
                    <button key={p.id} className="cb-trow" data-post-card={p.id} onClick={() => onOpen(p)} onKeyDown={(e) => onDelete && (e.key === "Delete" || e.key === "Backspace") && (e.preventDefault(), onDelete(p))} data-testid="cb-trow">
                      <span className={`cb-tty ty-${p.type}`}>
                        <TypeIcon type={p.type} /> <span className="hide-sm">{t(`ct.type.${p.type}` as Key)}</span>
                      </span>
                      <b className="cb-ttitle">{p.title || p.caption.split("\n")[0] || t(`ct.type.${p.type}` as Key)}</b>
                      <span>{p.client_draft && p.status === "idea" ? <span className="label accent">{t("dp.clientDraft")}</span> : <StatusLabel status={p.status} />}</span>
                      <span className="mono small muted">{p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : "—"}</span>
                      <span className="mono small muted hide-sm">{all ? <><Icon name="chat" size={12} /> {all - open}/{all}</> : ""}</span>
                    </button>
                  );
                })}
                {!items.length && <span className="cb-empty">{t("bd.empty")}</span>}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

export type CardDrag = { "data-kb-card": string; onPointerDown: (e: React.PointerEvent<HTMLElement>) => void; className: string };

export function BoardCard({ p, onOpen, onDelete, drag, client, extra, className = "", clientInfo, showOwner }: { p: ContentPost; onOpen: (p: ContentPost) => void; onDelete?: (p: ContentPost) => void; clientInfo?: { name: string; photo?: string }; showOwner?: boolean; drag?: CardDrag; client?: string; extra?: React.ReactNode; className?: string }) {
  const { t, locale } = useT();
  const video = p.media.find((m) => m.kind === "video");
  const cover = thumbOf(p) || undefined;
  const all = liveNotes(p).length;
  const open = openNotes(p).length;
  const when = p.status === "published" ? p.published_at || p.scheduled_at : p.scheduled_at;
  // prazo de produção mais próximo (até ser enviado ao cliente)
  const prod = ["idea", "draft"].includes(p.status) || p.blocked;
  const dues = prod ? ([["finish", p.due_finish], ["deliver", p.due_deliver]] as const).filter((x): x is readonly ["finish" | "deliver", string] => !!x[1]) : [];
  const today = new Date().toISOString().slice(0, 10);
  const [taskOpen, setTaskOpen] = useState(false);
  const href = `/clientes/${p.customer_id}?tab=content&post=${p.id}`;
  const actions: MenuAction[] = [
    { title: p.title || t(`ct.type.${p.type}` as Key) },
    { label: t("cm.open"), icon: <Icon name="edit" size={13} />, onSelect: () => onOpen(p) },
    { label: t("cm.newTask"), icon: <Icon name="task" size={13} />, onSelect: () => setTaskOpen(true) },
    "sep",
    { label: t("cm.copyLink"), icon: <Icon name="link" size={13} />, onSelect: () => navigator.clipboard.writeText(location.origin + href).catch(() => {}) },
    { label: t("cm.openNew"), icon: <Icon name="next" size={13} />, onSelect: () => window.open(href, "_blank", "noopener") },
    ...(onDelete ? (["sep", { label: t("cm.delete"), icon: <Icon name="trash" size={13} />, danger: true, onSelect: () => onDelete(p) }] as MenuAction[]) : []),
  ];
  return (
    <>
    {taskOpen && <QuickTask customer={{ id: p.customer_id, name: clientInfo?.name ?? client ?? "" }} post={{ id: p.id, title: p.title || t(`ct.type.${p.type}` as Key) }} onClose={() => setTaskOpen(false)} onDone={() => {}} />}
    <WithMenu actions={actions}>
    <article
      className={`cb-card ty-${p.type} ${drag ? "kb-card" : ""} ${drag?.className ?? ""} ${className}`}
      draggable={false}
      data-kb-card={drag?.["data-kb-card"]}
      onPointerDown={drag?.onPointerDown}
      onClick={() => onOpen(p)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(p);
        // Delete / Backspace no cartão focado: apagar (vazio = de vez; com conteúdo = confirmar e ir para o lixo)
        else if (onDelete && (e.key === "Delete" || e.key === "Backspace")) (e.preventDefault(), onDelete(p));
      }}
      data-testid="board-card"
      data-post-card={p.id}
    >
      <div className="cb-media">
        {video ? <HoverVideo src={video.src} poster={cover} /> : <Cover src={cover} />}
        <span className="cb-type">
          <TypeIcon type={p.type} /> {t(`ct.type.${p.type}` as Key)}
        </span>
        {video && <span className="cb-play" aria-hidden><Icon name="play" size={14} /></span>}
        {p.media.length > 1 && <span className="cb-count mono">1/{p.media.length}</span>}
        {onDelete && (
          <button
            className="cb-del"
            onClick={(e) => (e.stopPropagation(), onDelete(p))}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t("bin.delete")}
            title={t("bin.deleteHint")}
            data-testid="cb-del"
          >
            <Icon name="trash" size={13} />
          </button>
        )}
      </div>
      <div className="cb-info">
        {client && !clientInfo && <span className="label muted">{client}</span>}
        <b className="cb-title">{p.title || p.caption.split("\n")[0] || t(`ct.type.${p.type}` as Key)}</b>
        <div className="cb-tags">
          {p.client_draft && p.status === "idea" ? <span className="label accent">{t("dp.clientDraft")}</span> : <StatusLabel status={p.status} />}
          {p.blocked && <span className="label tone-danger"><Icon name="ban" size={14} /> {t("pl.phase.blocked")}</span>}
          {p.internal && <span className="label muted" title={t("pe.internalHint")}><Icon name="lock" size={12} /> {t("pe.internal")}</span>}
          {dues.map(([k, d]) => (
            <span key={k} className={`label ${d < today ? "tone-danger" : d <= new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10) ? "tone-warn" : "muted"}`} title={t(k === "finish" ? "pe.dueFinish" : "pe.dueDeliver")} data-testid={`cb-due-${k}`}>
              <Icon name={k === "finish" ? "flag" : "send"} size={12} /> {new Date(d + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "short" })}
            </span>
          ))}
          {p.round > 0 && <span className="label muted">R{p.round}</span>}
          {p.refs?.music && (
            <span className="label muted" title={p.refs.music_title || p.refs.music}>
              <Icon name="music" size={12} />
              {p.refs.music_end ? ` ${mmss(p.refs.music_start ?? 0)}–${mmss(p.refs.music_end)}` : ""}
            </span>
          )}
          {p.refs?.moodboard && <span className="label muted"><Icon name="layers" size={12} /></span>}
          {p.refs?.instagram && <span className="label muted"><Icon name="instagram" size={12} /></span>}
          {p.status === "review" && (() => {
            const v = validationState(p);
            return v.ok + v.fix > 0 ? <span className={`label ${v.fix ? "tone-warn" : "tone-ok"}`}><Icon name="check" size={14} /> {v.ok}/{v.list.length}</span> : null;
          })()}
        </div>
        <div className="row between mono small muted" style={{ gap: 6 }}>
          <span>{when ? new Date(when).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : t("ct.noDate")}</span>
          {all > 0 && <span className={open ? "tone-warn" : ""}><Icon name="chat" size={14} /> {all - open}/{all}</span>}
        </div>
        {(clientInfo || showOwner) && (
          <div className="cb-people" data-testid="cb-people">
            {clientInfo && (
              <span className="cb-who" title={clientInfo.name}>
                <Avatar name={clientInfo.name} photo={clientInfo.photo} size={18} />
                <span className="cb-who-n">{clientInfo.name}</span>
              </span>
            )}
            {showOwner && <OwnerChip email={p.assignee} />}
          </div>
        )}
        {extra}
      </div>
    </article>
    </WithMenu>
    </>
  );
}

/** Responsável no estúdio (nome e função) — ou "Sem responsável". */
function OwnerChip({ email }: { email?: string }) {
  const { t } = useT();
  const { who } = useTeamDirectory();
  const w = who(email);
  if (!w)
    return (
      <span className="cb-who none" data-testid="cb-owner">
        <Icon name="user" size={13} /> <span className="cb-who-n">{t("st.nobody")}</span>
      </span>
    );
  return (
    <span className="cb-who owner" title={`${w.name}${w.role ? ` · ${w.role}` : ""}`} data-testid="cb-owner">
      <Avatar name={w.name} photo={w.photo} size={18} />
      <span className="cb-who-n">
        {w.name.split(" ")[0]}
        {w.role && <span className="muted"> · {w.role}</span>}
      </span>
    </span>
  );
}

/** Vídeo silencioso que toca ao passar o rato (ou ao tocar, no telemóvel). */
function HoverVideo({ src, poster }: { src: string; poster?: string }) {
  const url = useMediaSrc(src);
  const posterUrl = useMediaSrc(poster);
  const shown = useVideoPoster(url, posterUrl); // sem capa: frame do meio do vídeo
  const ref = useRef<HTMLVideoElement>(null);
  if (!url) return <Cover src={poster} />;
  return (
    <StreamVideo
      ref={ref}
      src={url}
      poster={shown}
      muted
      loop
      playsInline
      preload="metadata"
      onMouseEnter={() => ref.current?.play().catch(() => {})}
      onMouseLeave={() => {
        ref.current?.pause();
      }}
    />
  );
}
