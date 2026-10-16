"use client";

// Conteúdo aberto na pré-visualização do portal (admin / demonstração): reproduzir o vídeo e comentar no frame,
// abrir o post e comentar no ponto, editar cada slide do carrossel, validar, aprovar / pedir alterações e agendar a
// publicação automática (data + hora → aparece em "Automático" e no calendário). Mesmas regras do portal real.
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { bestTimes, SLOTS } from "@/lib/bestTimes";
import { applyCoverRule, addNote, hasCover, clientReview, moveToPhase, patchNote, type ContentPost, type Instagram } from "@/lib/customer";
import type { Media } from "@/lib/proposal";
import { useT, type Key } from "@/lib/i18n";
import { fileToDataUrl } from "@/lib/inspirationClient";
import { uploadMedia } from "@/lib/media";
import { mergeMedia } from "@/lib/uploadRules";
import { DropZone } from "@/components/DropZone";
import { Review } from "./Review";
import { Cover, StatusLabel, TypeIcon, Video } from "./parts";
import { ValidationPanel } from "./Validation";

const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Próximo melhor momento (a partir de amanhã) segundo os melhores horários. */
function suggest(ig: Instagram) {
  const bt = bestTimes(ig.media ?? []);
  const d = new Date();
  for (let i = 1; i <= 7; i++) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    const row = bt.grid[(day.getDay() + 6) % 7];
    if (Math.max(...row) >= (bt.top[0]?.score ?? 0) * 0.8) {
      const [h, m] = SLOTS[row.indexOf(Math.max(...row))].at.split(":").map(Number);
      day.setHours(h, m, 0, 0);
      return day;
    }
  }
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 19, 30);
  return x;
}

export function PreviewPost({ post, ig, as, onChange, onClose }: { post: ContentPost; ig: Instagram; as: "client" | "studio"; onChange: (p: ContentPost) => Promise<unknown>; onClose: () => void }) {
  const { t, locale } = useT();
  const [p, setP] = useState(post);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [when, setWhen] = useState(() => localInput(post.scheduled_at ? new Date(post.scheduled_at) : suggest(ig)));
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLInputElement) && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const set = async (next: ContentPost, note?: string) => {
    setP(next);
    await onChange(next);
    if (note) {
      setMsg(note);
      setTimeout(() => setMsg(""), 3500);
    }
  };
  const multi = p.type === "carousel" || p.media.length > 1;
  const pins = useMemo(() => p.notes.filter((n) => !n.done && !n.deleted).length, [p.notes]);
  const [drag, setDrag] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);
  const [adding, setAdding] = useState(0);
  // no carrossel a "capa" é o 1.º slide: reordenar já muda a capa (o campo capa só existe nos reels)
  const setMedia = (media: Media[]) => set(applyCoverRule({ ...p, media }));

  return (
    <div className="overlay ov-top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog pv" role="dialog" aria-modal="true" data-testid="preview-post">
        <header className="row between">
          <span className="row" style={{ gap: 8 }}>
            <TypeIcon type={p.type} /> <b>{p.title || t(`ct.type.${p.type}` as Key)}</b> <StatusLabel status={p.status} />
          </span>
          <button className="btn ghost" onClick={onClose} aria-label={t("ct.close")}>
            <Icon name="close" />
          </button>
        </header>

        <Review
          post={p}
          mode="client"
          canAdd
          onAdd={async (n) => set(addNote(p, { by: as, author: as === "client" ? "Cliente" : "MediaMarques", ...n }))}
          onRemove={async (n) => set({ ...p, notes: p.notes.map((x) => (x.id === n.id ? { ...x, deleted: true } : x)) })}
          onMove={async (n, to) => set(patchNote(p, n.id, to))}
        />

        {multi && (
          <section className="pvp-slides" data-testid="carousel-editor">
            <span className="tile-t">{t("pvp.slides")}</span>
            <div className="pvp-list">
              {p.media.map((m, i) => (
                <div
                  key={i}
                  className={`pvp-slide ${drag === i ? "drag-src" : ""} ${dragTo === i && drag !== i ? "drag-to" : ""}`}
                  draggable
                  title={t("dz.reorder")}
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => drag !== null && (e.preventDefault(), setDragTo(i))}
                  onDragEnd={() => (setDrag(null), setDragTo(null))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag !== null && drag !== i) {
                      const next = [...p.media];
                      next.splice(i, 0, ...next.splice(drag, 1));
                      setMedia(next);
                    }
                    setDrag(null);
                    setDragTo(null);
                  }}
                >
                  <span className="pvp-img">
                    {m.kind === "video" ? (
                      <Video src={m.src} poster={hasCover(p.type) ? p.cover : undefined} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <Cover src={m.src} />
                    )}
                    <i className="mono">{i + 1}</i>
                  </span>
                  <input className="input small" value={m.caption ?? ""} placeholder={t("pvp.caption")} onChange={(e) => setP({ ...p, media: p.media.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) })} onBlur={() => onChange(p)} />
                  <span className="row" style={{ gap: 2 }}>
                    <button className="btn ghost small" disabled={i === 0} onClick={() => setMedia(p.media.map((x, j, a) => (j === i - 1 ? a[i] : j === i ? a[i - 1] : x)))} aria-label="←">
                      <Icon name="back" size={14} />
                    </button>
                    <button className="btn ghost small" disabled={i === p.media.length - 1} onClick={() => setMedia(p.media.map((x, j, a) => (j === i + 1 ? a[i] : j === i ? a[i + 1] : x)))} aria-label="→">
                      <Icon name="next" size={14} />
                    </button>
                    <label className="btn ghost small" title={t("pvp.replace")}>
                      <Icon name="edit" size={14} />
                      <input type="file" accept="image/*" hidden onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const src = await fileToDataUrl(f);
                        setMedia(p.media.map((x, j) => (j === i ? { ...x, src, kind: "image" } : x)));
                        e.target.value = "";
                      }} />
                    </label>
                    <button className="btn ghost small" disabled={p.media.length <= 1} onClick={() => setMedia(p.media.filter((_, j) => j !== i))} aria-label={t("ra.delete")}>
                      <Icon name="trash" size={14} />
                    </button>
                  </span>
                </div>
              ))}
              <DropZone
                target="carousel"
                existing={p.media.length}
                compact
                busy={adding || undefined}
                onFiles={async (files) => {
                  setAdding(files.length);
                  try {
                    const add = await Promise.all(files.map((f) => uploadMedia(f, `customers/${p.customer_id}`)));
                    setMedia(mergeMedia("carousel", p.media, add));
                  } finally {
                    setAdding(0);
                  }
                }}
                testId="pvp-drop"
              />
            </div>
          </section>
        )}

        {p.status === "review" && (
          <ValidationPanel
            post={p}
            canAct
            onValidate={async (key, value) => {
              const validation = { ...(p.validation ?? {}) };
              if (value) validation[key] = value;
              else delete validation[key];
              await set({ ...p, validation });
            }}
            onNote={async (txt) => set(addNote(p, { by: as, author: as === "client" ? "Cliente" : "MediaMarques", text: txt, media: 0 }))}
          />
        )}

        <section className="pvp-auto" data-testid="automation">
          <div className="row between">
            <span className="tile-t">{t("ap2.title")}</span>
            <span className={`label ${p.status === "scheduled" && p.auto ? "tone-ok" : "muted"}`}>
              {p.status === "scheduled" && p.auto ? <><Icon name="zap" size={13} /> {t("pvp.auto.on")}</> : p.scheduled_at ? <><Icon name="clock" size={13} /> {t("pvp.auto.pending")}</> : t("pvp.auto.none")}
            </span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ maxWidth: 240 }} aria-label={t("pvp.when")} data-testid="pvp-when" />
            <button
              className="btn accent"
              data-testid="pvp-schedule"
              onClick={() => {
                const iso = new Date(when).toISOString();
                const ready = p.status === "approved" || p.status === "scheduled";
                set({ ...p, scheduled_at: iso, auto: true, ...(ready ? { status: "scheduled" as const } : {}) }, ready ? t("pvp.auto.done", { when: new Date(iso).toLocaleString(locale, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) }) : t("pvp.auto.afterApprove"));
              }}
            >
              <Icon name="clock" size={14} /> {t("pvp.schedule")}
            </button>
            {p.auto && p.scheduled_at && (
              <button className="btn ghost small" onClick={() => set({ ...p, auto: false, ...(p.status === "scheduled" ? { status: "approved" as const } : {}) }, t("pvp.auto.off"))}>
                {t("pvp.cancelAuto")}
              </button>
            )}
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            {t("pvp.auto.hint")}
          </p>
        </section>

        <section className="stack pv-actions">
          {p.status === "review" ? (
            <>
              <textarea className="textarea" rows={2} placeholder={t("ct.changesPh")} value={text} onChange={(e) => setText(e.target.value)} />
              <div className="row">
                <button className="btn accent" onClick={() => set(clientReview(p, "approve", text, undefined, "Cliente"), t("ct.approvedMsg"))} data-testid="pvp-approve">
                  <Icon name="check" size={14} /> {t("ct.approve")}
                </button>
                <button className="btn" disabled={!text.trim() && pins === 0} onClick={() => set(clientReview(p, "changes", text || "—", undefined, "Cliente"), t("ct.changesMsg"))}>
                  {pins > 0 ? t("rv.sendChanges", { n: pins }) : t("ct.changes")} <Icon name="next" size={14} />
                </button>
              </div>
            </>
          ) : (
            p.status !== "published" && (
              <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => set(moveToPhase(p, "client_review"), t("pvp.sent"))} data-testid="pvp-to-review">
                <Icon name="next" size={14} /> {t("pvp.toReview")}
              </button>
            )
          )}
          {msg && <p className="note tone-ok small" style={{ margin: 0 }}>{msg}</p>}
        </section>
      </div>
    </div>
  );
}
