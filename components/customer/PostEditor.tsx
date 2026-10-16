"use client";

// Editor de um conteúdo (admin): tipo, capa, vídeo/imagens, legenda, data (ou "Adicionar à fila"
// como no Buffer), publicação automática, envio para aprovação e conversa com o cliente.
import { MusicRef } from "./MusicRef";
import { Select } from "@/components/Select";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { hasCover, applyCoverRule, CAPTION_MAX, HASHTAG_MAX, POST_STATUSES, POST_TYPES, addNote, cleanRefs, hashtags, liveNotes, moveToPhase, nextSlots, openNotes, patchNote, type ContentPost, type PortalSettings, type PostStatus } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { kindOf, mergeMedia } from "@/lib/uploadRules";
import { DropZone } from "@/components/DropZone";
import { UploadJobRow, uploadErrorText } from "@/components/UploadTray";
import { applyUploads, dropOrphans, dropPending, hasPending, isPending, startUpload, useUploadJobs, type UploadDone, type UploadFailed } from "@/lib/uploadQueue";
import { Cover, StatusLabel, TypeIcon, Video, useWhen } from "./parts";
import { Review } from "./Review";
import { IgPreview } from "./IgPreview";
import { ReviewRequest } from "./ReviewRequest";
import { VersionHistory } from "@/components/VersionHistory";

const toInput = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromInput = (v: string) => (v ? new Date(v).toISOString() : "");

/** Estado coerente com a data: aprovado + data = agendado; agendado sem data = aprovado. */
export function settle(p: ContentPost): ContentPost {
  if (p.status === "approved" && p.scheduled_at) return { ...p, status: "scheduled" };
  if (p.status === "scheduled" && !p.scheduled_at) return { ...p, status: "approved" };
  return p;
}

export function PostEditor({
  post,
  others,
  settings,
  canPublish,
  onSave,
  onDelete,
  onPublish,
  onClose,
  account,
  moodboards = [],
}: {
  post: ContentPost;
  others: ContentPost[];
  settings: PortalSettings;
  canPublish: boolean;
  /** Pode devolver o conteúdo gravado (ex.: com o responsável posto por uma regra de automação). */
  onSave: (p: ContentPost) => Promise<void | ContentPost>;
  onDelete: (p: ContentPost) => void;
  onPublish: (p: ContentPost) => Promise<void>;
  onClose: () => void;
  /** Perfil do Instagram do cliente (pré-visualização). */
  account?: { handle?: string; picture?: string };
  /** Moodboards do cliente (referência do conteúdo). */
  moodboards?: { id: string; title: string; deleted?: boolean }[];
}) {
  const { t } = useT();
  const when = useWhen();
  // envio interrompido noutra sessão (aba fechada a meio): o ficheiro não existe — retira-o e pede para carregar de novo
  const [p, setP] = useState(() => dropOrphans(post));
  const [busy, setBusy] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState(() => (dropOrphans(post) !== post ? t("pe.orphanUpload") : ""));
  const [notice, setNotice] = useState("");
  const [overAll, setOverAll] = useState(false);
  const overTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [drag, setDrag] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);
  const [view, setView] = useState<"details" | "review">(openNotes(post).length ? "review" : "details");
  useEffect(() => {
    const clean = dropOrphans(post);
    setP(clean);
    if (clean !== post) setErr(t("pe.orphanUpload"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post]);
  const set = (patch: Partial<ContentPost>) => setP((x) => ({ ...x, ...patch }));

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  // várias imagens → carrossel automaticamente (pode voltar ao tipo anterior)
  const [autoCarousel, setAutoCarousel] = useState<ContentPost["type"] | null>(null);
  /** Envio em segundo plano: o ficheiro aparece já (pré-visualização) e pode guardar/fechar enquanto sobe. */
  function upload(files: File[] | FileList | null, as: "cover" | "media") {
    if (!files?.length) return;
    setErr("");
    const arr = [...files];
    const { temps } = startUpload({ files: arr, folder: `customers/${p.customer_id}`, label: p.title || t(`ct.type.${p.type}` as Key), kindOf: (f) => (kindOf(f) === "video" ? "video" : "image"), postId: p.id, customerId: p.customer_id });
    if (as === "cover") return set({ cover: temps[0].src });
    const imgs = temps.filter((m) => m.kind === "image").length;
    const hasVideo = temps.some((m) => m.kind === "video") || p.media.some((m) => m.kind === "video");
    const total = imgs + p.media.filter((m) => m.kind === "image").length;
    const toCarousel = p.type !== "carousel" && total >= 2 && (p.type === "post" || !hasVideo);
    const type = toCarousel ? "carousel" : p.type;
    if (toCarousel) setAutoCarousel(p.type);
    setP((x) => ({ ...x, type, media: mergeMedia(type, x.media, temps) }));
  }
  // fim dos envios (mesmo depois de guardar): troca pelos ficheiros definitivos no editor aberto
  useEffect(() => {
    const done = (e: Event) => {
      const d = (e as CustomEvent<UploadDone>).detail;
      setP((x) => applyUploads(x, d.map)); // a capa só existe nos reels e é escolhida à mão
    };
    const failed = (e: Event) => {
      const d = (e as CustomEvent<UploadFailed>).detail;
      setP((x) => dropPending(x, d.pending));
      if (d.postId === post.id) setErr(uploadErrorText(t, d.error));
    };
    window.addEventListener("xmedia:upload-done", done);
    window.addEventListener("xmedia:upload-failed", failed);
    return () => {
      window.removeEventListener("xmedia:upload-done", done);
      window.removeEventListener("xmedia:upload-failed", failed);
    };
  }, [post.id, t]);
  const myJobs = useUploadJobs().filter((j) => j.postId === p.id && j.status === "running");
  const pending = hasPending(p);
  /** Largar em qualquer parte do editor: vídeo e imagens vão para o conteúdo (2+ imagens = carrossel); uma imagem num reel vai para a capa. */
  function dropAnywhere(files: File[]) {
    if (!files.length) return;
    const vids = files.filter((f) => kindOf(f) === "video");
    const imgs = files.filter((f) => kindOf(f) === "image");
    if (p.type === "reel" && !vids.length && imgs.length === 1) return upload(imgs, "cover");
    upload([...vids, ...imgs], "media");
  }

  const queue = () => {
    const taken = others.filter((o) => o.id !== p.id && o.status !== "published").map((o) => o.scheduled_at);
    const [slot] = nextSlots(settings.slots, taken, new Date());
    if (!slot) return setErr(t("ct.queueNone"));
    set({ scheduled_at: slot, status: p.status === "draft" || p.status === "idea" ? p.status : "scheduled" });
  };

  async function save(patch: Partial<ContentPost> = {}, close = false) {
    setBusy("save");
    setErr("");
    try {
      const next = settle(applyCoverRule({ ...p, ...patch, refs: cleanRefs({ ...p.refs, ...patch.refs }) }));
      const saved = await onSave(next);
      // só o responsável (automação) vem do que foi gravado; o resto fica como está no editor
      setP(saved ? { ...next, assignee: saved.assignee } : next);
      if (close) onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(null);
  }

  async function sendReply() {
    if (!reply.trim()) return;
    const fb = { id: crypto.randomUUID(), at: new Date().toISOString(), by: "studio" as const, text: reply.trim() };
    await save({ feedback: [...p.feedback, fb] });
    setReply("");
  }

  const chars = p.caption.length;
  const tags = hashtags(p.caption);
  const video = p.media.find((m) => m.kind === "video");
  const firstImage = p.media.find((m) => m.kind === "image");

  return (
    <div
      className="overlay ov-top"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setOverAll(true);
        // sem "dragover" durante um instante = o ficheiro saiu da janela → esconder a camada
        clearTimeout(overTimer.current);
        overTimer.current = setTimeout(() => setOverAll(false), 400);
      }}
    >
      {overAll && (
        <div
          className="pe-drop-all"
          data-testid="pe-drop-all"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            clearTimeout(overTimer.current);
            setOverAll(false);
            dropAnywhere([...e.dataTransfer.files]);
          }}
        >
          <Icon name="upload" size={22} /> {t("pe.dropAny")}
        </div>
      )}
      <div className="dialog pe" role="dialog" aria-modal="true" aria-label={p.title || t("ct.new")} style={{ position: "relative" }} data-post-card={p.id}>
        <header className="row between pe-head">
          <div className="pe-types" role="radiogroup" aria-label={t("dp.type")}>
            <Icon name="instagram" size={18} />
            {POST_TYPES.map((x) => (
              <button key={x} role="radio" aria-checked={p.type === x} className={`pe-type ${p.type === x ? "on" : ""}`} onClick={() => (set({ type: x }), setAutoCarousel(null))} data-testid={`pe-type-${x}`}>
                <i /> {t(`ct.type.${x}` as Key)}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className={`pe-vis ${p.internal ? "int" : "ext"}`} onClick={() => set({ internal: !p.internal })} title={p.internal ? t("pe.internalHint") : t("pe.visibleHint")} data-testid="pe-visibility">
              <Icon name={p.internal ? "lock" : "eye"} size={13} /> {p.internal ? t("pe.internal") : t("pe.visible")}
            </button>
            <StatusLabel status={p.status} />
            <VersionHistory entity="post" id={p.id} />
            <button className="btn ghost" onClick={onClose} aria-label={t("ct.close")}>
              <Icon name="close" />
            </button>
          </div>
        </header>
        {myJobs.map((j) => (
          <UploadJobRow key={j.id} j={j} />
        ))}
        {myJobs.length > 0 && <p className="note small" style={{ margin: 0 }}>{t("pe.uploadingSaved")}</p>}
        <div className="seg" role="tablist" style={{ alignSelf: "flex-start" }}>
          <button aria-pressed={view === "details"} onClick={() => setView("details")}>
            {t("rv.details")}
          </button>
          <button aria-pressed={view === "review"} onClick={() => setView("review")}>
            {t("rv.review")} · {openNotes(p).length}/{liveNotes(p).length}
          </button>
        </div>

        {view === "review" && (
          <div className="stack">
            {p.round > settings.process.max_rounds && <p className="note">{t("rv.overRounds", { n: p.round, max: settings.process.max_rounds })}</p>}
            {p.status === "draft" && liveNotes(p).length > 0 && openNotes(p).length === 0 && (
              <div className="note row between">
                <span><Icon name="check" size={14} /> {t("rv.allDone")}</span>
                <button className="btn small accent" disabled={!!busy || pending} title={pending ? t("pe.uploadingSaved") : undefined} onClick={() => save(moveToPhase(p, "client_review"))}>
                  {t("rv.resend", { n: p.round + 1 })} <Icon name="next" size={14} />
                </button>
              </div>
            )}
            <Review
              post={p}
              mode="admin"
              canAdd
              fps={settings.process.fps}
              onAdd={async (n) => {
                const next = addNote(p, { ...n, by: "studio" });
                await save(next);
              }}
              onToggle={(id, done) => save(patchNote(p, id, { done }))}
              onRemove={(n) => save(patchNote(p, n.id, { deleted: true }))}
              onMove={(n, to) => save(patchNote(p, n.id, to))}
            />
          </div>
        )}

        {view === "details" && (
          <div className="pe2">
            <div className="pe2-edit">
              <input className="pe2-title" value={p.title} onChange={(e) => set({ title: e.target.value })} placeholder={t("ct.title")} aria-label={t("ct.title")} />
              <div className="pe2-caption">
                <textarea value={p.caption} onChange={(e) => set({ caption: e.target.value })} placeholder={t("pe.captionPh")} aria-label={t("ct.caption")} rows={7} />
                <span className="pe2-count mono">
                  <span className={chars > CAPTION_MAX ? "tone-danger" : ""}>{chars}</span>
                  <span className={tags > HASHTAG_MAX ? "tone-danger" : ""}># {t("pe.tagsLeft", { n: Math.max(0, HASHTAG_MAX - tags) })}</span>
                </span>
              </div>

              {/* ficheiros: grelha com reordenar e um bloco para adicionar (várias imagens = carrossel) */}
              <div className={`pe2-grid ${p.type === "reel" || p.type === "story" ? "tall" : ""}`}>
                {p.media.map((m, i) => (
                  <div
                    key={m.src + i}
                    className={`pe2-tile ${drag === i ? "drag-src" : ""} ${dragTo === i && drag !== i ? "drag-to" : ""}`}
                    draggable={p.media.length > 1}
                    title={p.media.length > 1 ? t("dz.reorder") : m.caption}
                    onDragStart={(e) => (setDrag(i), e.dataTransfer.setData("text/x-media", String(i)))}
                    onDragOver={(e) => drag !== null && (e.preventDefault(), setDragTo(i))}
                    onDragEnd={() => (setDrag(null), setDragTo(null))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (drag === null || drag === i) return;
                      const next = [...p.media];
                      next.splice(i, 0, ...next.splice(drag, 1));
                      set({ media: next });
                      setDrag(null);
                      setDragTo(null);
                    }}
                    data-testid="pe-tile"
                  >
                    {m.kind === "video" ? <Video src={m.src} className="pe2-fill" poster={hasCover(p.type) ? p.cover : undefined} loop /> : <Cover src={m.src} />}
                    {isPending(m.src) && <span className="pe2-up mono">…</span>}
                    {p.media.length > 1 && <span className="pe2-n mono">{i + 1}</span>}
                    <button className="pe2-x" onClick={(e) => (e.stopPropagation(), set({ media: p.media.filter((_, j) => j !== i), notes: p.notes.map((n) => (n.media === i ? { ...n, deleted: true } : n.media > i ? { ...n, media: n.media - 1 } : n)) }))} aria-label={t("pe.removeFile")} title={t("pe.removeFile")} data-testid="pe-remove">
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                ))}
                {(p.type === "carousel" ? p.media.length < 10 : true) && (
                  <DropZone target="carousel" existing={p.type === "carousel" ? p.media.length : 0} onFiles={(f) => dropAnywhere(f)} className="pe2-add" testId="pe-drop">
                    <span className="pe2-add-in">
                      <Icon name="image" size={20} />
                      <span className="small">{p.media.length ? t("pe.addMore") : t("pe.addFirst")}</span>
                    </span>
                  </DropZone>
                )}
              </div>
              {autoCarousel && p.type === "carousel" && (
                <p className="note small pe2-auto" data-testid="pe-auto-carousel">
                  <Icon name="layers" size={13} /> {t("pe.autoCarousel", { n: p.media.length })}
                  <button className="btn ghost small" onClick={() => (set({ type: autoCarousel }), setAutoCarousel(null))}>
                    {t("pe.backTo", { type: t(`ct.type.${autoCarousel}` as Key) })}
                  </button>
                </p>
              )}
              {p.type === "post" && p.media.length > 1 && (
                <p className="note small">
                  {t("pe.postOnlyFirst")}{" "}
                  <button className="btn ghost small" onClick={() => set({ type: "carousel" })}>
                    {t("pe.makeCarousel")}
                  </button>
                </p>
              )}
              {/* capa: só nos reels (Instagram cover_url) — pequena e no fim, opcional */}
              {hasCover(p.type) && (
              <DropZone target="cover" onFiles={(f) => upload(f, "cover")} noPick className="pe-cover-row">
                <label className="pe-cover-sm" title={t("ct.coverHint")}>
                  <span className="pe-cover-th">
                    <Cover src={p.cover} />
                  </span>
                  <span className="pe-cover-txt">
                    <b>{t("ct.cover")}</b>
                    <span className="muted small">{p.cover ? t("pe.coverChange") : t("pe.coverOptional")}</span>
                  </span>
                  <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files, "cover")} />
                </label>
                {p.cover && (
                  <button className="btn ghost small pe-cover-del" onClick={() => set({ cover: "" })} aria-label={t("pe.removeCover")} title={t("pe.removeCover")} data-testid="pe-cover-remove">
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </DropZone>
              )}
              {!hasCover(p.type) && <p className="muted small pe2-coverrule">{t(`pe.coverRule.${p.type}` as Key)}</p>}

              {/* planeamento: prazos e publicação */}
              <section className="pe2-sec">
                <span className="tile-t">{t("pe.planning")}</span>
                <div className="pe2-dates">
                  <label className="field">
                    <span>{t("pe.dueFinish")}</span>
                    <input className="input" type="date" value={p.due_finish ?? ""} onChange={(e) => set({ due_finish: e.target.value || undefined })} data-testid="pe-due-finish" />
                  </label>
                  <label className="field">
                    <span>{t("pe.dueDeliver")}</span>
                    <input className="input" type="date" value={p.due_deliver ?? ""} onChange={(e) => set({ due_deliver: e.target.value || undefined })} data-testid="pe-due-deliver" />
                  </label>
                  <label className="field">
                    <span>{t("ct.when")}</span>
                    <input className="input" type="datetime-local" value={toInput(p.scheduled_at)} onChange={(e) => set({ scheduled_at: fromInput(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>{t("ct.state")}</span>
                    <Select className="select" value={p.status} onChange={(e) => set({ status: e.target.value as PostStatus })}>
                      {POST_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`ct.status.${s}` as Key)}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
                <div className="row">
                  <button className="btn small" onClick={queue}>
                    <Icon name="clock" size={14} /> {t("ct.queue")}
                  </button>
                  {p.scheduled_at && <span className="muted small">{when(p.scheduled_at)}</span>}
                </div>
                <label className="row" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <button className="check sm" role="checkbox" aria-checked={p.auto} onClick={() => set({ auto: !p.auto })} />
                  <span>
                    {t("ct.auto")}
                    <span className="muted small" style={{ display: "block" }}>
                      {t("ct.autoHint")}
                    </span>
                  </span>
                </label>
                <label className="row" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <button className="check sm" role="checkbox" aria-checked={p.blocked} onClick={() => set({ blocked: !p.blocked })} />
                  <span style={{ flex: 1 }}>
                    {t("pl.blocked")}
                    {p.blocked && <input className="input" placeholder={t("pl.blockedWhy")} value={p.blocked_reason} onChange={(e) => set({ blocked_reason: e.target.value })} />}
                  </span>
                </label>
              </section>

              {/* referências para a produção (também nos rascunhos) */}
              <section className="pe2-sec">
                <span className="tile-t">{t("dp.refs")}</span>
                <MusicRef refs={p.refs ?? {}} onChange={(refs) => set({ refs })} endpoint="/api/music/info" />
                <label className="dp-ref">
                  <Icon name="layers" size={14} />
                  <Select className="select" value={p.refs?.moodboard ?? ""} onChange={(e) => set({ refs: { ...p.refs, moodboard: e.target.value || undefined } })} disabled={!moodboards.filter((b) => !b.deleted).length} aria-label={t("dp.ref.moodboard")}>
                    <option value="">{moodboards.filter((b) => !b.deleted).length ? t("dp.noMoodboard") : t("dp.noMoodboards")}</option>
                    {moodboards
                      .filter((b) => !b.deleted)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                  </Select>
                </label>
                <label className="dp-ref">
                  <Icon name="instagram" size={14} />
                  <input className="input" value={p.refs?.instagram ?? ""} onChange={(e) => set({ refs: { ...p.refs, instagram: e.target.value } })} placeholder={t("dp.igPh")} data-testid="pe-ig" />
                </label>
              </section>

              <label className="field">
                <span>{t("ct.firstComment")}</span>
                <input className="input" value={p.first_comment} onChange={(e) => set({ first_comment: e.target.value })} />
              </label>
              {p.error && <p className="note tone-danger">{p.error}</p>}
              {p.permalink && (
                <a className="btn ghost" href={p.permalink} target="_blank" rel="noreferrer">
                  {t("ct.viewOnIg")} <Icon name="arrow" size={14} />
                </a>
              )}

              <section className="pe2-sec">
                <span className="tile-t">{t("ct.feedback")}</span>
                {p.feedback.map((f) => (
                  <div key={f.id} className={`fb ${f.by}`}>
                    <span className="label muted">
                      {f.by === "client" ? f.author || t("ct.client") : t("ct.studio")} · {when(f.at)}
                      {f.action === "approve" && <> · <Icon name="check" size={13} /></>}
                    </span>
                    {f.text && <p>{f.text}</p>}
                  </div>
                ))}
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <input className="input" placeholder={t("ct.reply")} value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply()} />
                  <button className="btn small" onClick={sendReply} disabled={!reply.trim()}>
                    ↵
                  </button>
                </div>
              </section>
            </div>

            <aside className="pe2-preview">
              <span className="pe2-ptitle">
                {t("igp.title")} <Icon name="instagram" size={14} />
              </span>
              <IgPreview post={p} handle={account?.handle} picture={account?.picture} />
            </aside>
          </div>
        )}

        {err && <p className="note tone-danger">{t("ct.error", { e: err })}</p>}
        {notice && <p className="note tone-ok" data-testid="pe-notice">{notice}</p>}
        <footer className="row between pe-foot">
          <button className="btn ghost danger" onClick={() => onDelete(p)}>
            {t("fin.delete")}
          </button>
          <div className="row">
            {p.internal && p.status !== "published" && (
              <button className="btn" disabled={!!busy || pending} onClick={() => save({ internal: false })} title={t("pe.visibleHint")} data-testid="pe-ready">
                <Icon name="eye" size={14} /> {t("pe.readyForClient")}
              </button>
            )}
            {canPublish && p.status !== "published" && (
              <button
                className="btn"
                disabled={!!busy || pending}
                onClick={async () => {
                  setBusy("publish");
                  await onPublish(settle(p));
                  setBusy(null);
                }}
              >
                {busy === "publish" ? "…" : t("ct.publishNow")}
              </button>
            )}
            {p.status !== "published" && (
              <span className="rr-wrap">
                <ReviewRequest
                  post={p}
                  disabled={!!busy || pending}
                  beforeSend={async () => {
                    // grava primeiro: o link do email abre a versão atual
                    await onSave(settle(applyCoverRule({ ...p, refs: cleanRefs({ ...p.refs }) })));
                  }}
                  onDone={(m) => (setErr(""), setNotice(m))}
                />
              </span>
            )}
            {(p.status === "draft" || p.status === "idea") && (
              <button className="btn" disabled={!!busy || pending} title={pending ? t("pe.uploadingSaved") : undefined} onClick={() => save(moveToPhase(p, "client_review"))}>
                {t("ct.sendReview")}
              </button>
            )}
            <button className="btn accent" disabled={!!busy} onClick={() => save({}, true)}>
              {busy === "save" ? "…" : t("ct.save")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
