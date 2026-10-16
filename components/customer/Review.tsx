"use client";

// Revisão do material, como no Figma / Frame.io: o cliente (ou o estúdio) clica no ponto exato da
// imagem ou pausa o vídeo num frame e deixa um comentário. Para o editor, cada comentário é um item
// da checklist, com o frame/ponto onde foi pedido.
import { StreamVideo } from "@/components/StreamVideo";
import { useEffect, useMemo, useRef, useState } from "react";
import { liveNotes, timecode, type ContentPost, type Note, type NoteMove } from "@/lib/customer";
import { Select } from "@/components/Select";
import { useT } from "@/lib/i18n";
import { splitChecklist } from "@/lib/validation";
import { useMediaSrc } from "@/lib/media";
import { useVideoPoster } from "@/lib/videoPoster";
import type { NoteInput } from "@/lib/portalApi";
import { Icon } from "../Icon";
import { Cover } from "./parts";

type Item = { index: number; src: string; kind: "image" | "video" };
type Draft = { media: number; t?: number; x?: number; y?: number };

/** Ficheiros revisáveis: cada imagem/vídeo do post e a capa (índice -1) se for diferente. */
export function reviewItems(p: Pick<ContentPost, "cover" | "media">): Item[] {
  const items: Item[] = p.media.map((m, i) => ({ index: i, src: m.src, kind: m.kind }));
  // a capa só é um ficheiro à parte nos reels (dados antigos de outros tipos mantêm-na se tiver comentários)
  if (p.cover && !p.media.some((m) => m.src === p.cover)) items.push({ index: -1, src: p.cover, kind: "image" });
  return items;
}

export function Review({
  post,
  mode,
  canAdd,
  fps = 30,
  onAdd,
  onToggle,
  onRemove,
  onMove,
}: {
  post: ContentPost;
  mode: "client" | "admin";
  canAdd: boolean;
  fps?: number;
  onAdd: (n: NoteInput) => Promise<void>;
  onToggle?: (id: string, done: boolean) => void;
  onRemove?: (n: Note) => void;
  /** Reposicionar um comentário: arrastar o pin (no mesmo ficheiro ou para a miniatura de outro slide) ou escolher o slide. */
  onMove?: (n: Note, to: NoteMove) => void;
}) {
  const { t } = useT();
  const items = useMemo(() => reviewItems(post), [post]);
  const notes = useMemo(() => liveNotes(post).sort((a, b) => a.at.localeCompare(b.at)), [post]);
  const num = (n: Note) => notes.indexOf(n) + 1;
  const [sel, setSel] = useState<number>(() => items.find((i) => i.kind === "video")?.index ?? items[0]?.index ?? 0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const [dragPin, setDragPin] = useState<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const movable = (n: Note) => !!onMove && !n.done && (mode === "admin" || n.by === "client");
  const item = items.find((i) => i.index === sel) ?? items[0];
  const pos = items.findIndex((i) => i.index === item?.index);
  const go = (d: number) => items.length > 1 && setSel(items[(pos + d + items.length) % items.length].index);
  // setas do teclado mudam de slide (fora dos campos de texto)
  useEffect(() => {
    if (items.length < 2) return;
    const k = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable], [role=listbox]")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  /** Arrastar um pin: dentro da imagem muda o ponto; largado na miniatura de outro slide muda de slide. */
  function pinDown(e: React.PointerEvent<HTMLButtonElement>, n: Note) {
    e.stopPropagation();
    if (!movable(n)) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragPin({ id: n.id, x: n.x ?? 0.5, y: n.y ?? 0.5, moved: false });
  }
  function pinMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragPin || !media.current) return;
    const r = media.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setDragPin((d) => (d ? { ...d, x, y, moved: d.moved || Math.abs(x - d.x) * r.width > 3 || Math.abs(y - d.y) * r.height > 3 } : d));
  }
  function pinUp(e: React.PointerEvent<HTMLButtonElement>, n: Note) {
    const d = dragPin;
    setDragPin(null);
    if (!d) return;
    if (!d.moved) return setFocus(n.id);
    const thumb = document.elementsFromPoint(e.clientX, e.clientY).find((el) => (el as HTMLElement).dataset?.slide !== undefined) as HTMLElement | undefined;
    const to = thumb ? Number(thumb.dataset.slide) : item!.index;
    if (to !== item!.index) {
      onMove!(n, { media: to, x: n.x, y: n.y });
      setSel(to);
    } else onMove!(n, { media: to, x: d.x, y: d.y });
    setFocus(n.id);
  }
  const here = notes.filter((n) => n.media === item?.index);
  const done = notes.filter((n) => n.done).length;

  useEffect(() => setDraft(null), [sel]);

  const where = (n: Note) => {
    const parts: string[] = [];
    const it = items.find((i) => i.index === n.media);
    if (n.media === -1) parts.push(t("rv.cover"));
    else if (it?.kind === "video") parts.push(t("rv.video"));
    else if (items.length > 1) parts.push(t("rv.slide", { n: n.media + 1 }));
    if (typeof n.t === "number") {
      const c = timecode(n.t, fps);
      parts.push(`${c.tc} · f${c.frame}`);
    }
    if (typeof n.x === "number" && typeof n.t !== "number") parts.push(t("rv.point"));
    return parts.join(" · ") || t("rv.general");
  };

  function seek(s: number) {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(s, v.duration || s));
  }
  function open(n: Note) {
    setFocus(n.id);
    if (n.media !== sel) setSel(n.media);
    if (typeof n.t === "number") setTimeout(() => seek(n.t!), n.media !== sel ? 300 : 0);
  }

  /** Clique na imagem / no vídeo pausado → pin no ponto exato. */
  function place(e: React.MouseEvent<HTMLDivElement>) {
    if (!canAdd || !item) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (item.kind === "video") {
      const v = video.current;
      if (v && !v.paused) {
        v.pause();
        return;
      }
      setDraft({ media: item.index, t: v?.currentTime ?? 0, x, y });
    } else setDraft({ media: item.index, x, y });
    setText("");
  }

  // um comentário com vários pedidos pode virar vários itens da checklist (pergunta antes)
  const [split, setSplit] = useState<string[] | null>(null);
  async function submit(asList?: boolean) {
    if (!draft || !text.trim()) return;
    const parts = splitChecklist(text);
    if (asList === undefined && parts.length >= 2) return setSplit(parts);
    setBusy(true);
    try {
      if (asList && split) for (const x of split) await onAdd({ ...draft, text: x });
      else await onAdd({ ...draft, text });
      setDraft(null);
      setText("");
      setSplit(null);
    } finally {
      setBusy(false);
    }
  }

  // pins visíveis: imagem → todos; vídeo → os deste frame (±3 frames) ou o rascunho
  const near = (n: Note) => typeof n.t === "number" && Math.abs(n.t - time) <= 3 / fps;
  const pins = here.filter((n) => typeof n.x === "number" && (item?.kind !== "video" || near(n)));

  if (!item) return <p className="muted small">{t("rv.noMedia")}</p>;

  return (
    <div className="rv">
      <div className="rv-main">
        {items.length > 1 && (
          <div className="rv-thumbs">
            {items.map((it) => {
              const c = notes.filter((n) => n.media === it.index && !n.done).length;
              return (
                <button key={it.index} data-slide={it.index} className={`rv-thumb ${it.index === sel ? "on" : ""} ${dragPin?.moved && it.index !== sel ? "drop" : ""}`} onClick={() => setSel(it.index)} title={it.index === -1 ? t("rv.cover") : t("rv.slide", { n: it.index + 1 })}>
                  {it.kind === "video" ? <span className="rv-vid"><Icon name="play" size={14} /></span> : <Cover src={it.src} />}
                  {c > 0 && <i>{c}</i>}
                </button>
              );
            })}
          </div>
        )}

        <div className={`rv-stage ${canAdd ? "can" : ""}`}>
          <div className="rv-media" onClick={place} data-tour="rv-media" ref={media}>
            {item.kind === "video" ? (
              <StageVideo
                src={item.src}
                ref={video}
                onTime={setTime}
                onDur={setDur}
                onPlay={setPlaying}
              />
            ) : (
              <StageImage src={item.src} />
            )}
            {pins.map((n) => {
              const d = dragPin?.id === n.id ? dragPin : null;
              return (
                <button
                  key={n.id}
                  className={`rv-pin ${n.done ? "done" : ""} ${focus === n.id ? "focus" : ""} ${n.by} ${movable(n) ? "movable" : ""} ${d?.moved ? "dragging" : ""}`}
                  style={{ left: `${(d ? d.x : n.x!) * 100}%`, top: `${(d ? d.y : n.y!) * 100}%` }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => pinDown(e, n)}
                  onPointerMove={pinMove}
                  onPointerUp={(e) => pinUp(e, n)}
                  onPointerCancel={() => setDragPin(null)}
                  title={movable(n) ? `${n.text} — ${t("rv.dragPin")}` : n.text}
                  data-testid="rv-pin"
                >
                  {num(n)}
                </button>
              );
            })}
            {draft && typeof draft.x === "number" && (
              <div className="rv-pin draft" style={{ left: `${draft.x * 100}%`, top: `${draft.y! * 100}%` }}>
                +
              </div>
            )}
            {items.length > 1 && (
              <>
                <button className="rv-nav prev" onClick={(e) => (e.stopPropagation(), go(-1))} aria-label={t("cal.prev")} data-testid="rv-prev">
                  <Icon name="chevronLeft" size={18} />
                </button>
                <button className="rv-nav next" onClick={(e) => (e.stopPropagation(), go(1))} aria-label={t("cal.next")} data-testid="rv-next">
                  <Icon name="chevron" size={18} />
                </button>
                <span className="rv-dots" aria-hidden>
                  {items.map((it) => (
                    <i key={it.index} className={it.index === item.index ? "on" : ""} />
                  ))}
                </span>
              </>
            )}
          </div>

          {item.kind === "video" && (
            <div className="rv-controls">
              <button className="btn small" onClick={() => (video.current?.paused ? video.current.play() : video.current?.pause())} aria-label={playing ? "pause" : "play"}>
                {playing ? <Icon name="pause" size={15} /> : <Icon name="play" size={15} />}
              </button>
              <button className="btn small ghost" onClick={() => seek(time - 1 / fps)} title={t("rv.prevFrame")}>
                ‹ f
              </button>
              <button className="btn small ghost" onClick={() => seek(time + 1 / fps)} title={t("rv.nextFrame")}>
                f ›
              </button>
              <span className="mono small">
                {timecode(time, fps).tc} · f{timecode(time, fps).frame}
              </span>
              {canAdd && (
                <button
                  className="btn small accent"
                  onClick={() => {
                    video.current?.pause();
                    setDraft({ media: item.index, t: video.current?.currentTime ?? 0 });
                    setText("");
                  }}
                >
                  + {t("rv.atFrame")}
                </button>
              )}
              <div className="rv-track">
                <input type="range" min={0} max={dur || 0} step={1 / fps} value={time} onChange={(e) => seek(Number(e.target.value))} aria-label="timeline" />
                {dur > 0 &&
                  here
                    .filter((n) => typeof n.t === "number")
                    .map((n) => (
                      <button key={n.id} className={`rv-mark ${n.done ? "done" : ""}`} style={{ left: `${(n.t! / dur) * 100}%` }} onClick={() => open(n)} title={`${num(n)} · ${n.text}`}>
                        {num(n)}
                      </button>
                    ))}
              </div>
            </div>
          )}

          {draft && (
            <div className="rv-draft">
              <span className="label muted">{where({ ...draft, id: "", by: "client", text: "", round: 0, done: false, at: "", updated: "" } as Note)}</span>
              <textarea className="textarea" rows={2} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t("rv.placeholder")} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && submit()} />
              {split ? (
                <div className="rv-split" data-testid="rv-split">
                  <span className="small">{t("ck.suggest", { n: split.length })}</span>
                  <ol>
                    {split.map((x, i) => (
                      <li key={i}>☐ {x}</li>
                    ))}
                  </ol>
                  <div className="row">
                    <button className="btn small accent" onClick={() => submit(true)} disabled={busy} data-testid="rv-split-yes">
                      {t("ck.yes")}
                    </button>
                    <button className="btn small" onClick={() => submit(false)} disabled={busy}>
                      {t("ck.no")}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="row">
                <button className="btn small accent" onClick={() => submit()} disabled={busy || !text.trim()} data-testid="rv-add">
                  {t("rv.add")}
                </button>
                <button className="btn small ghost" onClick={() => setDraft(null)}>
                  {t("ct.close")}
                </button>
              </div>
            </div>
          )}
          {canAdd && !draft && <p className="muted small">{item.kind === "video" ? t("rv.hintVideo") : t("rv.hintImage")}</p>}
        </div>
      </div>

      <aside className="rv-list">
        <div className="row between">
          <span className="label muted">{mode === "admin" ? t("rv.checklist") : t("rv.comments")}</span>
          {notes.length > 0 && (
            <span className="mono small">
              {done}/{notes.length}
            </span>
          )}
        </div>
        {notes.length > 0 && (
          <span className="cu-bar">
            <i style={{ width: `${(done / notes.length) * 100}%` }} />
          </span>
        )}
        {notes.length === 0 && <p className="muted small">{canAdd ? t("rv.empty") : t("rv.none")}</p>}
        <ol className="rv-items">
          {notes.map((n) => (
            <li key={n.id} className={`${n.done ? "done" : ""} ${focus === n.id ? "focus" : ""}`} onClick={() => open(n)}>
              {mode === "admin" && onToggle ? (
                <button
                  className="check sm"
                  role="checkbox"
                  aria-checked={n.done}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(n.id, !n.done);
                  }}
                  aria-label={n.text}
                />
              ) : (
                <span className={`rv-n ${n.by}`}>{num(n)}</span>
              )}
              <span className="rv-body">
                <span className="label muted">
                  {mode === "admin" && <b className={`rv-n ${n.by}`}>{num(n)}</b>} {where(n)}
                  {mode === "admin" && ` · ${n.by === "client" ? n.author || t("ct.client") : t("ct.studio")}`}
                  {n.round > 0 && ` · R${n.round}`}
                </span>
                <span className="rv-text">{n.text}</span>
                {movable(n) && items.length > 1 && (
                  <span className="rv-move" onClick={(e) => e.stopPropagation()}>
                    <Select className="select" value={String(n.media)} onChange={(e) => (onMove!(n, { media: Number(e.target.value), x: n.x, y: n.y }), setSel(Number(e.target.value)))} aria-label={t("rv.moveTo")} data-testid="rv-move">
                      {items.map((it) => (
                        <option key={it.index} value={String(it.index)}>
                          {it.index === -1 ? t("rv.cover") : it.kind === "video" && items.length === 1 ? t("rv.video") : t("rv.slide", { n: it.index + 1 })}
                        </option>
                      ))}
                    </Select>
                  </span>
                )}
                {n.done && mode === "client" && <span className="small tone-ok"><Icon name="check" size={14} /> {t("rv.resolved")}</span>}
              </span>
              {onRemove && !n.done && (mode === "admin" || n.by === "client") && (
                <button
                  className="btn ghost small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(n);
                  }}
                  aria-label={t("remove")}
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

function StageImage({ src }: { src: string }) {
  const url = useMediaSrc(src);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" draggable={false} /> : <span className="cv-empty" style={{ aspectRatio: "3/4" }} />;
}

function StageVideo({
  src,
  ref,
  onTime,
  onDur,
  onPlay,
}: {
  src: string;
  ref: React.RefObject<HTMLVideoElement | null>;
  onTime: (t: number) => void;
  onDur: (d: number) => void;
  onPlay: (p: boolean) => void;
}) {
  const url = useMediaSrc(src);
  const poster = useVideoPoster(url); // frame do meio enquanto não toca
  if (!url) return <span className="cv-empty" style={{ aspectRatio: "9/16" }} />;
  return (
    <StreamVideo
      ref={ref}
      src={url}
      poster={poster}
      playsInline
      preload="metadata"
      onTimeUpdate={(e) => onTime(e.currentTarget.currentTime)}
      onSeeked={(e) => onTime(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => onDur(e.currentTarget.duration)}
      onPlay={() => onPlay(true)}
      onPause={() => onPlay(false)}
    />
  );
}
