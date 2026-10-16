"use client";

// Moodboards (estilo Milanote): lista de quadros e um quadro livre onde se arrastam imagens (carregar, colar um print
// com ⌘V, largar ficheiros), links (Pinterest ou qualquer site → imagem + título), notas coloridas e títulos.
// Imagens que não abrem mostram "imagem indisponível" com o link. Grava sozinho (ao fim de ~1 s sem mexer).
import { checkFiles } from "@/lib/uploadRules";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n";
import { BOARD_H, BOARD_W, newBoard, newItem, type Moodboard, type MoodItem, type NoteColor } from "@/lib/moodboard";
import { isImageUrl, parseRef } from "@/lib/references";
import type { LinkPreview } from "@/lib/inspirationClient";

export type InspirationIO = {
  upload: (f: File) => Promise<string>;
  preview: (url: string) => Promise<LinkPreview>;
};

const COLORS: NoteColor[] = ["green", "yellow", "orange", "grey", "white"];

export function MoodboardEditor({ boards, readOnly, me, io, onSave }: { boards: Moodboard[]; readOnly?: boolean; me: string; io: InspirationIO; onSave: (changed: Moodboard[]) => Promise<unknown> }) {
  const { t, locale } = useT();
  const list = boards.filter((b) => !b.deleted);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = list.find((b) => b.id === openId) ?? null;

  const create = async () => {
    const b = newBoard(`${t("mb.board")} ${list.length + 1}`, me);
    await onSave([b]);
    setOpenId(b.id);
  };

  if (open) return <Board key={open.id} board={open} readOnly={readOnly} io={io} onSave={(b) => onSave([b])} onBack={() => setOpenId(null)} />;
  return (
    <section className="widgets" style={{ padding: 0 }}>
      <div className="w span-12 row between">
        <div>
          <span className="tile-t">{t("mb.title")}</span>
          <p className="muted small" style={{ margin: "6px 0 0" }}>
            {t("mb.sub")}
          </p>
        </div>
        {!readOnly && (
          <button className="btn accent" data-testid="mb-new" onClick={create}>
            + {t("mb.new")}
          </button>
        )}
      </div>
      {readOnly && !list.length && <p className="muted w span-12">{t("mb.empty")}</p>}
      {list.map((b) => {
        const imgs = b.items.filter((i) => i.src).slice(0, 4);
        return (
          <button key={b.id} className="w tile click span-4 mb-card" onClick={() => setOpenId(b.id)} data-testid="mb-card">
            <div className="mb-thumbs">
              {imgs.length ? imgs.map((i) => <SafeImg key={i.id} src={i.src!} />) : <span className="mb-thumb-ph" />}
            </div>
            <div className="tile-head">
              <span>
                <b className="mb-name">{b.title}</b>
                <span className="muted small" style={{ display: "block" }}>
                  {b.items.length} · {new Date(b.updated).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                </span>
              </span>
              <span className="tile-go" aria-hidden>
                <Icon name="arrow" size={18} />
              </span>
            </div>
          </button>
        );
      })}
      {/* cartão fantasma: criar já um moodboard (o primeiro, ou mais um) */}
      {!readOnly && (
        <button className="w tile click span-4 mb-card mb-ghost" onClick={create} data-testid="mb-ghost">
          <div className="mb-thumbs" aria-hidden>
            <span className="gh" />
            <span className="gh" />
            <span className="gh" />
            <span className="gh" />
            <span className="mb-plus">
              <Icon name="plus" size={26} />
            </span>
          </div>
          <div className="tile-head">
            <span>
              <b className="mb-name">{list.length ? t("mb.new") : t("mb.first")}</b>
              <span className="muted small" style={{ display: "block" }}>
                {t("mb.firstSub")}
              </span>
            </span>
          </div>
        </button>
      )}
    </section>
  );
}

function SafeImg({ src, alt = "" }: { src: string; alt?: string }) {
  const [err, setErr] = useState(false);
  // eslint-disable-next-line @next/next/no-img-element
  return err ? <span className="mb-err small"><Icon name="alert" size={14} /></span> : <img src={src} alt={alt} loading="lazy" onError={() => setErr(true)} draggable={false} />;
}

function Board({ board, readOnly, io, onSave, onBack }: { board: Moodboard; readOnly?: boolean; io: InspirationIO; onSave: (b: Moodboard) => Promise<unknown>; onBack: () => void }) {
  const { t } = useT();
  const [b, setB] = useState<Moodboard>(board);
  const [sel, setSel] = useState<string | null>(null);
  // como no Milanote: clicar e arrastar move; duplo clique entra na edição do texto
  const [editing, setEditing] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const area = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inner = useRef<HTMLDivElement>(null);
  const bRef = useRef(b);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  /** Ponto do ecrã → coordenadas do quadro (tendo em conta o zoom e o scroll). */
  const toBoard = (cx: number, cy: number) => {
    const r = inner.current?.getBoundingClientRect();
    if (!r) return null;
    const x = (cx - r.left) / zoom;
    const y = (cy - r.top) / zoom;
    return x >= 0 && y >= 0 && x <= BOARD_W && y <= BOARD_H ? { x, y } : null;
  };
  const place = (at: { x: number; y: number } | null, w: number, i = 0) => (at ? { x: Math.max(0, Math.round(at.x - w / 2 + i * 28)), y: Math.max(0, Math.round(at.y - 40 + i * 28)) } : {});

  const commit = useCallback(
    (next: Moodboard) => {
      const n = { ...next, updated: new Date().toISOString() };
      bRef.current = n;
      setB(n);
      setSaved(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        await onSave(n);
        setSaved(true);
      }, 900);
    },
    [onSave]
  );
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const upd = (id: string, p: Partial<MoodItem>) => commit({ ...bRef.current, items: bRef.current.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const add = (kind: MoodItem["kind"], p: Partial<MoodItem> = {}) => {
    const cur = bRef.current;
    const it = newItem(kind, cur.items, p);
    commit({ ...cur, items: [...cur.items, it] });
    setSel(it.id);
    if (kind === "note" || kind === "heading") setEditing(it.id);
    return it;
  };

  async function addFiles(files: File[], at: { x: number; y: number } | null = null) {
    const { ok } = checkFiles("moodboard", files, bRef.current.items.length);
    if (!ok.length) return;
    setBusy(true);
    const up = await Promise.all(ok.map((f) => io.upload(f).then((src) => ({ src, title: f.name })).catch(() => null)));
    const cur = bRef.current;
    let items = cur.items;
    up.forEach((x, i) => {
      if (x) items = [...items, newItem("image", items, { ...x, ...place(at, 240, i) })];
    });
    commit({ ...cur, items });
    setBusy(false);
  }
  async function addLink(url: string, at: { x: number; y: number } | null = null) {
    const u = url.trim().split(/\s+/)[0];
    if (!/^https?:\/\//.test(u)) return;
    if (isImageUrl(u)) return void add("image", { src: u, url: u, ...place(at, 240) });
    // vídeo (YouTube, TikTok, Instagram, Vimeo): cartão com o vídeo a tocar dentro
    const ref = parseRef(u);
    if (ref?.embed) {
      const w = ref.vertical ? 260 : 380;
      return void add("link", { url: u, embed: ref.embed, vertical: ref.vertical, src: ref.thumb, title: ref.platform, w, ...place(at, w) });
    }
    setBusy(true);
    const p = await io.preview(u).catch(() => null);
    add("link", { url: u, src: p?.image || "", title: p?.title || "", text: p?.site || "", ...place(at, 240) });
    setBusy(false);
  }

  // colar: print (imagem) ou link
  useEffect(() => {
    if (readOnly) return;
    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const files = [...(e.clipboardData?.files ?? [])];
      const at = lastPt.current ? toBoard(lastPt.current.x, lastPt.current.y) : null;
      if (files.length) {
        e.preventDefault();
        addFiles(files, at);
        return;
      }
      const txt = e.clipboardData?.getData("text") ?? "";
      if (/^https?:\/\//.test(txt.trim())) {
        e.preventDefault();
        addLink(txt, at);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (sel && (e.key === "Delete" || e.key === "Backspace") && !(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA"))) {
        commit({ ...b, items: b.items.filter((i) => i.id !== sel) });
        setSel(null);
      }
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // arrastar / redimensionar
  const drag = useRef<{ id: string; mode: "move" | "size"; sx: number; sy: number; x: number; y: number; w: number } | null>(null);
  const onDown = (e: React.PointerEvent, it: MoodItem, mode: "move" | "size") => {
    if (readOnly) return;
    const tag = (e.target as HTMLElement).tagName;
    if (mode === "move" && (tag === "A" || (editing === it.id && (tag === "TEXTAREA" || tag === "INPUT")))) return;
    if (editing && editing !== it.id) setEditing(null);
    e.stopPropagation();
    setSel(it.id);
    drag.current = { id: it.id, mode, sx: e.clientX, sy: e.clientY, x: it.x, y: it.y, w: it.w };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / zoom;
    const dy = (e.clientY - d.sy) / zoom;
    setB((x) => ({ ...x, items: x.items.map((i) => (i.id !== d.id ? i : d.mode === "move" ? { ...i, x: Math.max(0, Math.min(BOARD_W - 80, Math.round(d.x + dx))), y: Math.max(0, Math.min(BOARD_H - 40, Math.round(d.y + dy))) } : { ...i, w: Math.max(120, Math.min(900, Math.round(d.w + dx))) })) }));
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    commit(b);
  };
  const selected = useMemo(() => b.items.find((i) => i.id === sel), [b.items, sel]);

  return (
    <section className="mb">
      <header className="mb-bar">
        <button className="btn ghost" onClick={onBack}>
          <Icon name="back" size={14} /> {t("mb.title")}
        </button>
        <input className="input mb-title" value={b.title} onChange={(e) => commit({ ...b, title: e.target.value })} disabled={readOnly} aria-label={t("mb.board")} />
        <span className={`small ${saved ? "muted" : "tone-warn"}`}>{busy ? "…" : saved ? <><Icon name="check" size={13} /> {t("mb.saved")}</> : t("mb.saving")}</span>
        <span className="mb-zoom">
          <button className="btn small" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(1)))} aria-label="−">
            −
          </button>
          <span className="mono small">{Math.round(zoom * 100)}%</span>
          <button className="btn small" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(1)))} aria-label="+">
            +
          </button>
        </span>
      </header>
      {!readOnly && (
        <div className="mb-tools">
          <button className="btn small" onClick={() => fileRef.current?.click()} data-testid="mb-add-image">
            <Icon name="grid" size={14} /> {t("mb.image")}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (addFiles([...(e.target.files ?? [])]), (e.target.value = ""))} />
          <span className="mb-link">
            <input className="input" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (addLink(link), setLink(""))} placeholder={t("mb.linkPh")} data-testid="mb-link" />
            <button
              className="btn small accent"
              onClick={() => {
                addLink(link);
                setLink("");
              }}
              disabled={!link.trim()}
              data-testid="mb-link-add"
            >
              + {t("mb.link")}
            </button>
          </span>
          {COLORS.slice(0, 3).map((c) => (
            <button key={c} className={`btn small mb-addnote n-${c}`} onClick={() => add("note", { color: c, text: "" })} data-testid={`mb-note-${c}`}>
              + {t("mb.note")}
            </button>
          ))}
          <button className="btn small" onClick={() => add("heading", { text: t("mb.heading") })}>
            + {t("mb.heading")}
          </button>
          {selected && (
            <>
              {selected.kind === "note" && (
                <span className="row" style={{ gap: 4 }}>
                  {COLORS.map((c) => (
                    <button key={c} className={`mb-swatch n-${c} ${selected.color === c ? "on" : ""}`} onClick={() => upd(selected.id, { color: c })} aria-label={c} />
                  ))}
                </span>
              )}
              <button
                className="btn small danger"
                onClick={() => {
                  commit({ ...b, items: b.items.filter((i) => i.id !== selected.id) });
                  setSel(null);
                }}
              >
                <Icon name="trash" size={14} /> {t("ra.delete")}
              </button>
            </>
          )}
          <span className="muted small hide-sm">{t("mb.hint")}</span>
        </div>
      )}
      <div
        className="mb-area"
        ref={area}
        onPointerDown={() => {
          setSel(null);
          setEditing(null);
        }}
        onPointerMove={(e) => (lastPt.current = { x: e.clientX, y: e.clientY })}
        onPointerLeave={() => (lastPt.current = null)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          // solta exatamente onde está o rato e grava logo (sem confirmação)
          e.preventDefault();
          if (readOnly) return;
          const at = toBoard(e.clientX, e.clientY);
          if (e.dataTransfer.files.length) return void addFiles([...e.dataTransfer.files], at);
          const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
          if (url) addLink(url, at);
        }}
      >
        <div className="mb-canvas" style={{ width: BOARD_W * zoom, height: BOARD_H * zoom }}>
          <div className="mb-inner" ref={inner} style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${zoom})` }} onPointerMove={onMove} onPointerUp={onUp}>
            {b.items.map((it) => (
              <div
                key={it.id}
                className={`mb-item k-${it.kind} ${it.kind === "note" ? `n-${it.color ?? "green"}` : ""} ${sel === it.id ? "sel" : ""} ${editing === it.id ? "editing" : ""}`}
                style={{ left: it.x, top: it.y, width: it.w }}
                onPointerDown={(e) => onDown(e, it, "move")}
                onDoubleClick={() => (it.embed ? setEditing(it.id) : !readOnly && (it.kind === "note" || it.kind === "heading") && setEditing(it.id))}
                data-testid="mb-item"
              >
                <ItemBody it={it} readOnly={readOnly || editing !== it.id} playing={editing === it.id} onText={(text) => upd(it.id, { text })} />
                {!readOnly && <span className="mb-size" onPointerDown={(e) => onDown(e, it, "size")} aria-hidden />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ItemBody({ it, readOnly, playing, onText }: { it: MoodItem; readOnly?: boolean; playing?: boolean; onText: (s: string) => void }) {
  const { t } = useT();
  const [err, setErr] = useState(false);
  if (it.kind === "link" && it.embed)
    return (
      <>
        <div className={`mb-video ${it.vertical ? "v" : ""} ${playing ? "on" : ""}`}>
          {playing || !it.src ? (
            <iframe src={playing && it.embed.includes("youtube") ? `${it.embed}?autoplay=1` : it.embed} title={it.title || "video"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.src} alt="" draggable={false} />
          )}
          {!playing && (
            <span className="mb-play">
              <Icon name="play" size={18} /> {t("mb.playHint")}
            </span>
          )}
        </div>
        {it.url && (
          <a className="mb-cap" href={it.url} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()}>
            <b style={{ textTransform: "capitalize" }}>{it.title || "video"}</b>
            <span className="muted">{new URL(it.url).hostname.replace(/^www\./, "")} <Icon name="arrow" size={14} /></span>
          </a>
        )}
      </>
    );
  if (it.kind === "image" || it.kind === "link") {
    const broken = err || !it.src;
    return (
      <>
        {broken ? (
          <span className="mb-broken" data-testid="mb-broken">
            <Icon name="alert" size={14} /> {t("mb.broken")}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.src} alt={it.title ?? ""} draggable={false} onError={() => setErr(true)} />
        )}
        {(it.kind === "link" || broken) && it.url && (
          <a className="mb-cap" href={it.url} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()}>
            <b>{it.title || it.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}</b>
            <span className="muted">{it.text || new URL(it.url).hostname.replace(/^www\./, "")} <Icon name="arrow" size={14} /></span>
          </a>
        )}
      </>
    );
  }
  if (it.kind === "heading")
    return <input className="mb-h" value={it.text ?? ""} onChange={(e) => onText(e.target.value)} readOnly={readOnly} tabIndex={readOnly ? -1 : 0} autoFocus={!readOnly} aria-label={t("mb.heading")} />;
  return (
    <textarea
      className="mb-note"
      value={it.text ?? ""}
      onChange={(e) => onText(e.target.value)}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : 0}
      autoFocus={!readOnly}
      placeholder={t("mb.notePh")}
      rows={Math.max(2, (it.text ?? "").split("\n").length + Math.floor((it.text ?? "").length / 28))}
    />
  );
}
