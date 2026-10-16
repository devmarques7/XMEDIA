"use client";

// Peças partilhadas entre a ficha do cliente (admin) e o portal do cliente:
// capa, etiquetas, calendário, grid do Instagram, métricas, jornada e teclado do código.
import { StreamVideo } from "@/components/StreamVideo";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { thumbOf, IG_METRICS, JOURNEY, engagementRate, gridItems, journeyState, monthGrid, postsByDay, type ContentPost, type Customer, type GridItem, type Instagram, type PostStatus, type PostType } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { useMediaSrc } from "@/lib/media";
import { useVideoPoster } from "@/lib/videoPoster";

export const STATUS_TONE: Record<PostStatus, string> = {
  idea: "muted",
  draft: "muted",
  review: "tone-warn",
  approved: "tone-ok",
  scheduled: "tone-ok",
  published: "",
  failed: "tone-danger",
};

export function Cover({ src, alt = "", className = "" }: { src?: string; alt?: string; className?: string }) {
  const url = useMediaSrc(src);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={alt} className={className} loading="lazy" /> : <span className={`cv-empty ${className}`} aria-hidden />;
}

/** Vídeo com capa: a `poster` dada (capa do reel) ou, se não houver, o frame do meio do vídeo. */
export function Video({ src, className = "", poster }: { src: string; className?: string; poster?: string }) {
  const url = useMediaSrc(src);
  const posterUrl = useMediaSrc(poster);
  const shown = useVideoPoster(url, posterUrl);
  return url ? <StreamVideo className={className} src={url} poster={shown} controls muted playsInline preload="metadata" /> : null;
}

/** Miniatura de um conteúdo: capa/imagem (thumbOf) ou, num vídeo sem capa, o frame do meio. */
export function PostThumb({ p, className = "" }: { p: Pick<ContentPost, "type" | "cover" | "media">; className?: string }) {
  const thumb = thumbOf(p);
  const video = thumb ? undefined : p.media.find((m) => m.kind === "video")?.src;
  const videoUrl = useMediaSrc(video);
  const frame = useVideoPoster(videoUrl);
  if (thumb) return <Cover src={thumb} className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return frame ? <img src={frame} alt="" className={className} loading="lazy" /> : <span className={`cv-empty ${className}`} aria-hidden />;
}

export function TypeIcon({ type }: { type: PostType | "ig" }) {
  return <Icon name={type === "reel" ? "play" : type === "carousel" ? "layers" : type === "story" ? "clock" : "grid"} size={14} />;
}

export function StatusLabel({ status }: { status: PostStatus }) {
  const { t } = useT();
  return <span className={`label ${STATUS_TONE[status]}`}>{t(`ct.status.${status}` as Key)}</span>;
}

/** Quando: dia + hora na língua da interface. */
export function useWhen() {
  const { locale } = useT();
  return (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) =>
    iso ? new Date(iso).toLocaleString(locale, opts) : "";
}

export function PostRow({ p, onOpen, onDelete }: { p: ContentPost; onOpen: (p: ContentPost) => void; onDelete?: (p: ContentPost) => void }) {
  const { t } = useT();
  const when = useWhen();
  return (
    <button className="ct-row" data-post-card={p.id} onClick={() => onOpen(p)} onKeyDown={(e) => onDelete && (e.key === "Delete" || e.key === "Backspace") && (e.preventDefault(), onDelete(p))}>
      <span className="ct-thumb">
        <PostThumb p={p} />
        <span className="ct-type">
          <TypeIcon type={p.type} />
        </span>
      </span>
      <span className="ct-main">
        <b>{p.title || p.caption.split("\n")[0] || t(`ct.type.${p.type}` as Key)}</b>
        <span className="muted small">
          {t(`ct.type.${p.type}` as Key)} · {p.status === "published" ? when(p.published_at || p.scheduled_at) : p.scheduled_at ? when(p.scheduled_at) : t("ct.noDate")}
        </span>
      </span>
      <StatusLabel status={p.status} />
    </button>
  );
}

/** Calendário mensal (seg→dom) com as publicações de cada dia. */
export function ContentCalendar({ posts, onOpen, onDay }: { posts: ContentPost[]; onOpen: (p: ContentPost) => void; onDay?: (day: string) => void }) {
  const { t, locale } = useT();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [month, setMonth] = useState(todayKey.slice(0, 7));
  const weeks = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => postsByDay(posts), [posts]);
  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const dayNames = weeks[0].map((d) => new Date(d + "T12:00:00").toLocaleDateString(locale, { weekday: "short" }));
  return (
    <section className="ccal">
      <header className="ccal-head">
        <button className="btn ghost" onClick={() => shift(-1)} aria-label={t("cal.prev")}>
          <Icon name="back" size={14} />
        </button>
        <b>{new Date(month + "-15T12:00:00").toLocaleDateString(locale, { month: "long", year: "numeric" })}</b>
        <button className="btn ghost" onClick={() => shift(1)} aria-label={t("cal.next")}>
          <Icon name="next" size={14} />
        </button>
        <button className="btn small" onClick={() => setMonth(todayKey.slice(0, 7))}>
          {t("ct.today")}
        </button>
      </header>
      <div className="ccal-grid" role="grid">
        {dayNames.map((d, i) => (
          <span key={i} className="ccal-dow label muted">
            {d}
          </span>
        ))}
        {weeks.flat().map((day) => {
          const items = byDay.get(day) ?? [];
          return (
            <div
              key={day}
              role="gridcell"
              className={`ccal-day ${day.slice(0, 7) !== month ? "out" : ""} ${day === todayKey ? "today" : ""} ${onDay ? "add" : ""}`}
              onClick={() => onDay?.(day)}
            >
              <span className="ccal-n mono">{Number(day.slice(8))}</span>
              {items.map((p) => (
                <button
                  key={p.id}
                  className={`ccal-post st-${p.status}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(p);
                  }}
                  title={p.title || p.caption.slice(0, 60)}
                >
                  <TypeIcon type={p.type} />
                  <span className="mono">{p.scheduled_at ? new Date(p.scheduled_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                  <span className="ccal-t">{p.title || t(`ct.type.${p.type}` as Key)}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Pré-visualização do perfil do Instagram com os planeados no topo (capas 3:4). */
export function GridPreview({ customer, posts, onOpen, onCover }: { customer: Pick<Customer, "name" | "instagram">; posts: ContentPost[]; onOpen?: (p: ContentPost) => void; /** Trocar a capa de um reel planeado (imagem escolhida). */ onCover?: (p: ContentPost, file: File) => Promise<void> }) {
  const { t, locale } = useT();
  const ig = customer.instagram;
  const items = useMemo(() => gridItems(posts, ig.media ?? []), [posts, ig.media]);
  const n = (v?: number) => (v === undefined ? "—" : new Intl.NumberFormat(locale, { notation: v >= 10000 ? "compact" : "standard" }).format(v));
  const planned = items.filter((i) => i.planned).length;
  return (
    <section className="igp">
      <header className="igp-head">
        <span className="igp-avatar">
          <Cover src={ig.picture} />
        </span>
        <div className="igp-counts">
          <span>
            <b>{n(ig.connected ? (ig.media_count ?? 0) + planned : items.length)}</b> {t("gr.posts")}
          </span>
          <span>
            <b>{n(ig.followers)}</b> {t("gr.followers")}
          </span>
          <span>
            <b>{n(ig.follows)}</b> {t("gr.following")}
          </span>
        </div>
      </header>
      <div className="igp-name">
        <b>{ig.name || customer.name}</b>
        {ig.handle && <span className="muted"> @{ig.handle}</span>}
        {ig.bio && <p className="small">{ig.bio}</p>}
      </div>
      <p className="muted small">{t("gr.hint")}</p>
      <div className="igp-grid">
        {items.map((it: GridItem) => (
          <GridCell key={it.key} it={it} onOpen={onOpen} onCover={onCover} />
        ))}
        {/* completa a última linha */}
        {Array.from({ length: (3 - (items.length % 3)) % 3 }, (_, i) => (
          <span key={`pad${i}`} className="igp-cell pad" />
        ))}
      </div>
    </section>
  );
}

/**
 * Célula do grid como no perfil do Instagram (3:4, sem bordas). Ao passar o rato: camada escura com "Abrir conteúdo" e,
 * nos reels planeados, "Alterar capa" (no Instagram só os reels têm capa própria; posts/carrosséis usam a 1.ª imagem).
 */
function GridCell({ it, onOpen, onCover }: { it: GridItem; onOpen?: (p: ContentPost) => void; onCover?: (p: ContentPost, file: File) => Promise<void> }) {
  const { t, locale } = useT();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const video = !it.cover && it.post ? it.post.media.find((m) => m.kind === "video")?.src : undefined;
  const videoUrl = useMediaSrc(video);
  const frame = useVideoPoster(videoUrl); // reel sem capa: frame do meio
  const canCover = !!(it.post && onCover && it.post.type === "reel" && it.post.status !== "published");
  const open = () => (it.post ? onOpen?.(it.post) : it.ig?.permalink && window.open(it.ig.permalink, "_blank", "noopener"));
  const kind = it.type === "ig" ? (it.ig?.product === "REELS" ? "reel" : it.ig?.media_type === "CAROUSEL_ALBUM" ? "carousel" : "post") : it.type;
  return (
    <div className={`igp-cell ${it.planned ? "planned" : ""} ${busy ? "busy" : ""}`} data-testid="igp-cell">
      <button className="igp-hit" onClick={open} title={it.post?.title || it.ig?.caption?.slice(0, 80) || ""} aria-label={it.post?.title || t("gr.open")}>
        {it.cover ? (
          <Cover src={it.cover} />
        ) : frame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={frame} alt="" />
        ) : (
          <span className="cv-empty" aria-hidden />
        )}
      </button>
      {kind !== "post" && (
        <span className="igp-icon" aria-hidden>
          <TypeIcon type={kind} />
        </span>
      )}
      {it.planned && (
        <span className="igp-badge">
          <Icon name="clock" size={11} /> {it.when ? new Date(it.when).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : t("gr.planned")}
        </span>
      )}
      <div className="igp-over">
        <button className="igp-act" onClick={open} data-testid="igp-open">
          <Icon name={it.post ? "edit" : "instagram"} size={14} /> {it.post ? t("gr.open") : t("gr.viewIg")}
        </button>
        {canCover && (
          <button className="igp-act" onClick={() => file.current?.click()} disabled={busy} data-testid="igp-cover">
            <Icon name="image" size={14} /> {busy ? "…" : t("gr.changeCover")}
          </button>
        )}
      </div>
      {canCover && (
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f || !it.post) return;
            setBusy(true);
            try {
              await onCover!(it.post, f);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

/** Métricas do Instagram (últimos 28 dias) + seguidores + melhores conteúdos. */
export function Metrics({ ig, connectHref, igConnect, onSync, busy }: { ig: Instagram; connectHref?: string; igConnect: boolean; onSync?: () => void; busy?: boolean }) {
  const { t, locale } = useT();
  const n = (v?: number) => (v === undefined ? "—" : new Intl.NumberFormat(locale).format(v));
  const er = engagementRate(ig);
  const top = [...(ig.media ?? [])].sort((a, b) => (b.reach ?? b.likes) - (a.reach ?? a.likes)).slice(0, 6);
  const hist = ig.history ?? [];
  const max = Math.max(1, ...hist.map((h) => h.followers));
  const min = Math.min(...hist.map((h) => h.followers), max);

  return (
    <section className="stack">
      <div className="row between">
        <div>
          <span className="label muted">{ig.connected ? t("mt.connected") : t("mt.notConnected")}</span>
          <h2 className="h2" style={{ margin: "6px 0 0" }}>
            {t("mt.title")}
          </h2>
          {ig.handle && <span className="muted">@{ig.handle}</span>}
        </div>
        <div className="row">
          {ig.connected && onSync && (
            <button className="btn" onClick={onSync} disabled={busy}>
              <Icon name="refresh" size={14} /> {t("mt.sync")}
            </button>
          )}
          {!ig.connected && igConnect && connectHref && (
            <a className="btn accent" href={connectHref}>
              <Icon name="instagram" size={16} /> {t("mt.connect")}
            </a>
          )}
        </div>
      </div>
      {!ig.connected && <p className="note">{igConnect ? t("mt.connectHint") : t("mt.notConfigured")}</p>}
      {ig.error && <p className="note tone-danger">{t("mt.errorMsg")} {ig.error}</p>}

      {ig.connected && (
        <>
          <span className="label muted">
            {t("mt.period")}
            {ig.synced_at && ` · ${t("mt.synced", { when: new Date(ig.synced_at).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) })}`}
          </span>
          <div className="widgets" style={{ paddingTop: 0 }}>
            <div className="w span-3">
              <div className="label muted">{t("mt.followers")}</div>
              <div className="num" style={{ marginTop: 12 }}>
                {n(ig.followers)}
              </div>
            </div>
            <div className="w span-3">
              <div className="label muted">{t("mt.engagement")}</div>
              <div className="num" style={{ marginTop: 12 }}>
                {er === null ? "—" : `${er}%`}
              </div>
            </div>
            {IG_METRICS.filter((m) => ig.insights?.[m] !== undefined).map((m) => (
              <div key={m} className="w span-3">
                <div className="label muted">{t(`mt.${m}` as Key)}</div>
                <div className="num" style={{ marginTop: 12 }}>
                  {n(ig.insights![m])}
                </div>
              </div>
            ))}
          </div>

          {hist.length > 1 && (
            <div className="w">
              <div className="label muted">{t("mt.growth")}</div>
              <svg className="mt-spark" viewBox={`0 0 ${hist.length - 1} 40`} preserveAspectRatio="none" aria-hidden>
                <polyline fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" points={hist.map((h, i) => `${i},${40 - ((h.followers - min) / Math.max(1, max - min)) * 36 - 2}`).join(" ")} />
              </svg>
            </div>
          )}

          {top.length > 0 && (
            <div className="stack">
              <span className="label muted">{t("mt.top")}</span>
              <div className="mt-top">
                {top.map((m) => (
                  <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer" className="mt-item">
                    <Cover src={m.url} />
                    <span className="small mono">
                      {m.reach !== undefined && <><Icon name="target" size={14} /> {n(m.reach)} </>}<Icon name="heart" size={14} /> {n(m.likes)} <Icon name="chat" size={14} /> {n(m.comments)}
                      {m.saves !== undefined && <> <Icon name="bookmark" size={14} /> {n(m.saves)}</>}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** "Nossa Jornada" (Notion): 4 fases com o que acontece e o que se pede ao cliente. */
export function Journey({ stage }: { stage: Customer["stage"] }) {
  const { t } = useT();
  return (
    <ol className="jr">
      {JOURNEY.map((p, i) => {
        const st = journeyState(stage, p);
        return (
          <li key={p} className={`jr-step ${st}`}>
            <div className="jr-head">
              <span className="jr-n mono">{String(i + 1).padStart(2, "0")}</span>
              <b>{t(`cu.phase.${p}` as Key)}</b>
              <span className={`label ${st === "now" ? "tone-warn" : st === "done" ? "tone-ok" : "muted"}`}>{t(st === "done" ? "po.done" : st === "now" ? "po.now" : "po.next")}</span>
            </div>
            <div className="jr-body">
              <p>
                <span className="label muted">{t("po.what")}</span>
                <br />
                {t(`cu.what.${p}` as Key)}
              </p>
              <p>
                <span className="label muted">{t("po.you")}</span>
                <br />
                {t(`cu.you.${p}` as Key)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Teclado numérico estilo iPhone com pontos do código. */
/**
 * Teclado do código. `length` conhecido (dispositivo que já entrou): entra sozinho ao completar.
 * Sem tamanho (0): aceita 4 a 6 dígitos sem perguntar quantos — os pontos crescem e entra-se com Enter/botão.
 */
export function Keypad({ length, value, onChange, error, disabled, onEnter }: { length: number; value: string; onChange: (v: string) => void; error?: boolean; disabled?: boolean; onEnter?: () => void }) {
  const max = length >= 4 && length <= 6 ? length : 6;
  const dots = length >= 4 && length <= 6 ? length : Math.max(4, value.length);
  // valor mais recente: toques rápidos (antes de re-renderizar) não perdem dígitos
  const cur = useRef(value);
  cur.current = value;
  const emit = (v: string) => {
    cur.current = v;
    onChange(v);
  };
  const press = (d: string) => !disabled && cur.current.length < max && emit(cur.current + d);
  const back = () => !disabled && emit(cur.current.slice(0, -1));
  const ref = useRef<HTMLDivElement>(null);
  // teclado físico: foca o teclado se nada mais estiver focado
  useEffect(() => {
    if (document.activeElement === document.body) ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      ref={ref}
      className="kp"
      tabIndex={0}
      onKeyDown={(e) => {
        if (/^\d$/.test(e.key)) press(e.key);
        else if (e.key === "Backspace") back();
        else if (e.key === "Enter" && cur.current.length >= 4) onEnter?.();
      }}
    >
      <div className={`kp-dots ${error ? "shake" : ""}`} aria-live="polite" aria-label={`${value.length}/${dots}`}>
        {Array.from({ length: dots }, (_, i) => (
          <i key={i} className={i < value.length ? "on" : ""} />
        ))}
      </div>
      <div className="kp-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} disabled={disabled}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press("0")} disabled={disabled}>
          0
        </button>
        <button type="button" className="kp-back" onClick={back} aria-label="⌫" disabled={disabled}>
          ⌫
        </button>
      </div>
    </div>
  );
}
