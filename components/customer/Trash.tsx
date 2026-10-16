"use client";

// Apagar conteúdos e lixo (15 dias).
// • useTrash: vazio → apaga de vez sem perguntar; com alguma coisa dentro → modal "Mover para o lixo?".
// • BinView: lixo geral (todos os clientes) ou de um cliente — restaurar, apagar de vez, esvaziar.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { BIN_DAYS, binDaysLeft, isEmptyPost, thumbOf, type ContentPost, type Customer } from "@/lib/customer";
import { customerStore } from "@/lib/customerStore";
import { useT, type Key } from "@/lib/i18n";
import { Avatar } from "@/components/team/Avatar";
import { Cover, TypeIcon } from "./parts";


// ---------- feedback de apagar: o cartão "voa" até ao Lixo e ouve-se um som curto ----------
const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
};
/** Som de "deitar ao lixo" (gerado no browser: ruído filtrado a descer + toque curto). */
export function playTrashSound() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.28);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(380, now + 0.26);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    noise.connect(bp).connect(g).connect(ctx.destination);
    // "toc" no fim, como a tampa a fechar
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, now + 0.3);
    o.frequency.exponentialRampToValueAtTime(110, now + 0.42);
    og.gain.setValueAtTime(0.0001, now + 0.3);
    og.gain.exponentialRampToValueAtTime(0.18, now + 0.31);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    o.connect(og).connect(ctx.destination);
    noise.start(now);
    o.start(now + 0.3);
    o.stop(now + 0.5);
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {}
}

/**
 * Animação: uma cópia do cartão encolhe e voa até ao Lixo (separador do cliente ou menu lateral); o Lixo "salta".
 * Sem Lixo visível (telemóvel / menu fechado), aparece um atalho "Lixo" no canto que leva lá.
 */
export function flyToBin(postId: string) {
  playTrashSound();
  if (typeof document === "undefined") return;
  const src = [...document.querySelectorAll<HTMLElement>(`[data-post-card="${CSS.escape(postId)}"]`)].filter(visible).pop();
  let target = [...document.querySelectorAll<HTMLElement>("[data-bin-target]")].filter(visible).pop() ?? null;
  let temp: HTMLAnchorElement | null = null;
  if (!target) {
    temp = document.createElement("a");
    temp.href = "/lixo";
    temp.className = "bin-fab";
    temp.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>Lixo</span>`;
    document.body.appendChild(temp);
    target = temp;
    setTimeout(() => temp?.classList.add("out"), 2600);
    setTimeout(() => temp?.remove(), 3000);
  }
  const bump = () => {
    target!.classList.remove("bin-bump");
    void target!.offsetWidth;
    target!.classList.add("bin-bump");
    setTimeout(() => target?.classList.remove("bin-bump"), 600);
  };
  if (!src || matchMedia("(prefers-reduced-motion: reduce)").matches) return bump();
  const a = src.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const ghost = src.cloneNode(true) as HTMLElement;
  ghost.classList.add("bin-ghost");
  Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  document.body.appendChild(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = ghost.animate(
    [
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 60}px) scale(.55) rotate(-8deg)`, opacity: 0.95, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(.06) rotate(12deg)`, opacity: 0.2 },
    ],
    { duration: 650, easing: "cubic-bezier(.5,0,.75,0)" }
  );
  anim.onfinish = () => (ghost.remove(), bump());
}

/** Pergunta (se for preciso) e apaga. `onDone(p, kind)` é chamado depois de gravar. */
export function useTrash(onDone: (p: ContentPost, kind: "trash" | "purge") => void) {
  const { t } = useT();
  const [ask, setAsk] = useState<ContentPost | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (p: ContentPost, kind: "trash" | "purge") => {
      setBusy(true);
      flyToBin(p.id);
      try {
        if (kind === "purge") await customerStore.removePost(p.id);
        else await customerStore.trashPost(p);
        onDone(p, kind);
      } finally {
        setBusy(false);
        setAsk(null);
      }
    },
    [onDone]
  );
  /** Apagar: vazio = de vez; com conteúdo = confirmar e mover para o lixo. */
  const remove = useCallback((p: ContentPost) => (isEmptyPost(p) ? run(p, "purge") : setAsk(p)), [run]);
  const modal = ask ? (
    <div className="overlay ov-top" onMouseDown={(e) => e.target === e.currentTarget && !busy && setAsk(null)}>
      <div className="dialog stack trash-ask" role="alertdialog" aria-modal="true" aria-labelledby="trash-title" data-testid="trash-ask">
        <span className="trash-ic">
          <Icon name="trash" size={20} />
        </span>
        <b id="trash-title" className="trash-title">{t("bin.askTitle", { name: ask.title || t(`ct.type.${ask.type}` as Key) })}</b>
        <p className="muted small" style={{ margin: 0 }}>
          {t("bin.askText", { n: BIN_DAYS })}
        </p>
        <ul className="trash-what small">
          {ask.media.length > 0 && <li><Icon name="image" size={13} /> {t("bin.hasMedia", { n: ask.media.length })}</li>}
          {ask.caption.trim() && <li><Icon name="edit" size={13} /> {t("bin.hasCaption")}</li>}
          {ask.notes.some((n) => !n.deleted) && <li><Icon name="chat" size={13} /> {t("bin.hasNotes", { n: ask.notes.filter((n) => !n.deleted).length })}</li>}
          {ask.feedback.length > 0 && <li><Icon name="chat" size={13} /> {t("bin.hasFeedback")}</li>}
        </ul>
        <div className="row between">
          <button className="btn ghost" onClick={() => setAsk(null)} disabled={busy} autoFocus>
            {t("cancel")}
          </button>
          <button className="btn accent" onClick={() => run(ask, "trash")} disabled={busy} data-testid="trash-confirm">
            <Icon name="trash" size={14} /> {t("bin.moveToBin")}
          </button>
        </div>
      </div>
    </div>
  ) : null;
  return { remove, modal };
}

/** Lixo: geral (sem `customerId`) ou de um cliente. */
export function BinView({ customerId, customers = [], onChange }: { customerId?: string; customers?: Customer[]; onChange?: () => void }) {
  const { t, locale } = useT();
  const [items, setItems] = useState<ContentPost[] | null>(null);
  const [busy, setBusy] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [client, setClient] = useState(customerId ?? "all");
  const load = useCallback(() => customerStore.bin(customerId).then(setItems).catch(() => setItems([])), [customerId]);
  useEffect(() => {
    load();
  }, [load]);
  const shown = (items ?? []).filter((p) => client === "all" || p.customer_id === client);
  const cname = (id: string) => customers.find((c) => c.id === id);
  async function act(k: string, fn: () => Promise<unknown>) {
    setBusy(k);
    try {
      await fn();
      await load();
      onChange?.();
    } finally {
      setBusy("");
    }
  }
  if (!items) return <p className="muted small">…</p>;
  const counts = new Map<string, number>();
  for (const p of items) counts.set(p.customer_id, (counts.get(p.customer_id) ?? 0) + 1);
  return (
    <section className="bin stack" data-testid="bin">
      <div className="row between bin-head">
        <p className="muted small" style={{ margin: 0 }}>
          {t("bin.hint", { n: BIN_DAYS })}
        </p>
        {shown.length > 0 && (
          <button className="btn small danger" onClick={() => setConfirmAll(true)} disabled={!!busy} data-testid="bin-empty">
            <Icon name="trash" size={13} /> {t("bin.emptyAll", { n: shown.length })}
          </button>
        )}
      </div>
      {!customerId && counts.size > 1 && (
        <nav className="bin-clients">
          <button className={`cb-chip ${client === "all" ? "on" : ""}`} onClick={() => setClient("all")} aria-pressed={client === "all"}>
            {t("bd.all")} <span className="muted">{items.length}</span>
          </button>
          {[...counts].map(([id, n]) => (
            <button key={id} className={`cb-chip ${client === id ? "on" : ""}`} onClick={() => setClient(id)} aria-pressed={client === id}>
              <Avatar name={cname(id)?.name ?? "?"} photo={cname(id)?.cover || cname(id)?.instagram.picture} size={16} /> {cname(id)?.name ?? "?"} <span className="muted">{n}</span>
            </button>
          ))}
        </nav>
      )}
      {!shown.length && (
        <div className="bin-empty">
          <Icon name="trash" size={22} />
          <span className="muted">{t("bin.none")}</span>
        </div>
      )}
      <ul className="bin-list">
        {shown.map((p) => {
          const left = binDaysLeft(p);
          const c = cname(p.customer_id);
          return (
            <li key={p.id} className="bin-row" data-testid="bin-row">
              <span className="bin-th">
                <Cover src={thumbOf(p)} />
              </span>
              <span className="bin-main">
                <b>{p.title || p.caption.split("\n")[0] || t(`ct.type.${p.type}` as Key)}</b>
                <span className="muted small">
                  <TypeIcon type={p.type} /> {t(`ct.type.${p.type}` as Key)}
                  {!customerId && c && (
                    <>
                      {" · "}
                      <Link href={`/clientes/${c.id}?tab=bin`}>{c.name}</Link>
                    </>
                  )}
                  {" · "}
                  {t("bin.deletedOn", { date: new Date(p.deleted_at!).toLocaleDateString(locale, { day: "2-digit", month: "short" }) })}
                </span>
              </span>
              <span className={`label ${left <= 3 ? "tone-danger" : "muted"}`}>{t("bin.daysLeft", { n: left })}</span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn small" disabled={!!busy} onClick={() => act(`r${p.id}`, () => customerStore.restorePost(p))} data-testid="bin-restore">
                  <Icon name="back" size={13} /> {t("bin.restore")}
                </button>
                <button className="btn small ghost danger" disabled={!!busy} onClick={() => confirm(t("bin.purgeOne")) && act(`d${p.id}`, () => customerStore.removePost(p.id))} data-testid="bin-purge">
                  <Icon name="close" size={13} /> {t("bin.purge")}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {confirmAll && (
        <div className="overlay ov-top" onMouseDown={(e) => e.target === e.currentTarget && !busy && setConfirmAll(false)}>
          <div className="dialog stack trash-ask" role="alertdialog" aria-modal="true">
            <span className="trash-ic">
              <Icon name="trash" size={20} />
            </span>
            <b className="trash-title">{t("bin.emptyTitle", { n: shown.length })}</b>
            <p className="muted small" style={{ margin: 0 }}>
              {t("bin.emptyText")}
            </p>
            <div className="row between">
              <button className="btn ghost" onClick={() => setConfirmAll(false)} disabled={!!busy} autoFocus>
                {t("cancel")}
              </button>
              <button
                className="btn accent"
                disabled={!!busy}
                onClick={() =>
                  act("all", async () => {
                    for (const p of shown) await customerStore.removePost(p.id);
                    setConfirmAll(false);
                  })
                }
                data-testid="bin-empty-confirm"
              >
                {t("bin.emptyGo")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
