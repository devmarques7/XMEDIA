"use client";

// Clientes · Acesso: convites enviados, por enviar, ativos, expirados e revogados — e quem trabalha connosco com
// frequência mas ainda não tem dashboard. Filtrar por frequência (recorrente · uma demanda · sem projetos) e por
// etiquetas; ações rápidas por cliente: enviar/reenviar, copiar link, revogar, lembrete.
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { useMenu } from "@/components/LangMenu";
import { Avatar } from "@/components/team/Avatar";
import { FREQUENCIES, accessOf, allTags, frequencyOf, shouldInvite, type AccessState, type Frequency } from "@/lib/clientAccess";
import type { ContentPost, Customer } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { portalApi } from "@/lib/portalApi";
import { InviteDialog } from "./InviteDialog";

type StateFilter = "all" | "todo" | AccessState;
const STATES: StateFilter[] = ["all", "todo", "invited", "not_sent", "expired", "active", "disabled"];

export function AccessView({ list, posts, onSave, onToast }: { list: Customer[]; posts: ContentPost[]; onSave: (c: Customer) => Promise<unknown>; onToast: (m: string) => void }) {
  const { t, locale } = useT();
  const [state, setState] = useState<StateFilter>("all");
  const [freq, setFreq] = useState<Frequency | "all">("all");
  const [tag, setTag] = useState<string>("");
  const [inviting, setInviting] = useState<Customer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const tags = useMemo(() => allTags(list), [list]);
  const rows = useMemo(
    () =>
      list.map((c) => ({ c, access: accessOf(c), freq: frequencyOf(c, posts), todo: shouldInvite(c, posts) })).filter(
        (r) => (state === "all" || (state === "todo" ? r.todo : r.access === state)) && (freq === "all" || r.freq.value === freq) && (!tag || (r.c.tags ?? []).includes(tag))
      ),
    [list, posts, state, freq, tag]
  );
  const count = (s: StateFilter) => list.filter((c) => (s === "all" ? true : s === "todo" ? shouldInvite(c, posts) : accessOf(c) === s)).length;
  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : "");

  /** Pessoa a quem o convite se refere: o responsável (owner) ou a primeira pessoa convidada. */
  async function mainUser(c: Customer) {
    const us = await portalApi.users(c.id);
    return us.find((u) => u.role === "owner" && u.status !== "disabled") ?? us.find((u) => u.status === "invited") ?? null;
  }
  async function resend(c: Customer, send: boolean) {
    setBusy(c.id);
    try {
      const u = await mainUser(c);
      if (!u) return setInviting(c);
      const r = await portalApi.invite(c.id, u.id, send);
      if (!send || !r.email.sent) {
        await navigator.clipboard?.writeText(r.link).catch(() => {});
        onToast(send ? t("ax.copiedNotSent") : t("ax.copied"));
      } else onToast(t("ax.sent", { email: u.email }));
      await onSave({ ...c, reminder: undefined });
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function revoke(c: Customer) {
    const u = await mainUser(c);
    if (!u || !confirm(t("ax.revokeConfirm", { name: c.name }))) return;
    setBusy(c.id);
    try {
      await portalApi.access(c.id, "disable", u.id);
      onToast(t("ax.revoked"));
      await onSave(c);
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="ax">
      <div className="ax-bar">
        <nav className="td-tabs" role="tablist" aria-label={t("ax.state")}>
          {STATES.map((s) => (
            <button key={s} role="tab" aria-selected={state === s} onClick={() => setState(s)} data-testid={`ax-${s}`}>
              {t(`ax.s.${s}` as Key)} <span className="mono">{count(s)}</span>
            </button>
          ))}
        </nav>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="seg" role="group" aria-label={t("ax.freq")}>
            {(["all", ...FREQUENCIES] as const).map((f) => (
              <button key={f} aria-pressed={freq === f} onClick={() => setFreq(f)}>
                {f === "all" ? t("bd.all") : t(`ax.f.${f}` as Key)}
              </button>
            ))}
          </div>
          {tags.map((x) => (
            <button key={x} className={`td-chip ${tag === x ? "on" : ""}`} onClick={() => setTag(tag === x ? "" : x)}>
              <Icon name="tag" size={12} /> {x}
            </button>
          ))}
        </div>
      </div>

      {!rows.length && <p className="muted small">{t("ax.empty")}</p>}
      <ul className="ax-list">
        {rows.map(({ c, access, freq: f, todo }) => (
          <li key={c.id} className={`ax-row ${todo ? "todo" : ""}`} data-testid="ax-row">
            <Avatar name={c.name} photo={c.cover || c.instagram.picture} size={34} />
            <span className="ax-main">
              <Link href={`/clientes/${c.id}`} className="ax-name">
                {c.name}
              </Link>
              <span className="ax-meta">
                <span className={`ax-st s-${access}`}>
                  <i /> {t(`ax.s.${access}` as Key)}
                  {access === "invited" && c.portal.invited_at && ` · ${fmt(c.portal.invited_at)}`}
                  {(access === "invited" || access === "expired") && c.portal.invite_expires_at && ` → ${fmt(c.portal.invite_expires_at)}`}
                </span>
                {todo && <span className="label accent">{t("ax.inviteNow")}</span>}
                <TagEditor value={c.tags ?? []} all={tags} onChange={(next) => onSave({ ...c, tags: next })} />
              </span>
            </span>

            <span className="seg ax-freq" role="group" aria-label={t("ax.freq")} title={f.auto ? t("ax.auto") : undefined}>
              {FREQUENCIES.map((x) => (
                <button key={x} aria-pressed={f.value === x} className={f.auto && f.value === x ? "auto" : ""} onClick={() => onSave({ ...c, frequency: x })}>
                  {t(`ax.f.${x}` as Key)}
                </button>
              ))}
            </span>

            <span className="ax-rem" title={t("ax.reminder")}>
              <Icon name="clock" size={13} />
              <input
                type="date"
                className="input"
                value={c.reminder?.at ?? ""}
                onChange={(e) => onSave({ ...c, reminder: e.target.value ? { at: e.target.value, note: c.reminder?.note ?? t("ax.reminderNote") } : undefined })}
                aria-label={t("ax.reminder")}
              />
            </span>

            <span className="ax-act">
              {access === "not_sent" && (
                <button className="btn small accent" onClick={() => setInviting(c)} disabled={busy === c.id} data-testid="ax-invite">
                  <Icon name="send" size={13} /> {t("ax.invite")}
                </button>
              )}
              {(access === "invited" || access === "expired") && (
                <>
                  <button className="btn small accent" onClick={() => resend(c, true)} disabled={busy === c.id} data-testid="ax-resend">
                    <Icon name="refresh" size={13} /> {t("ax.resend")}
                  </button>
                  <button className="btn small" onClick={() => resend(c, false)} disabled={busy === c.id} title={t("ax.copyLink")} aria-label={t("ax.copyLink")}>
                    <Icon name="link" size={13} />
                  </button>
                  <button className="btn small ghost" onClick={() => revoke(c)} disabled={busy === c.id} data-testid="ax-revoke">
                    <Icon name="ban" size={13} /> {t("ax.revoke")}
                  </button>
                </>
              )}
              {(access === "active" || access === "disabled") && (
                <Link className="btn small ghost" href={`/clientes/${c.id}?tab=access`}>
                  <Icon name="settings" size={13} /> {t("ax.manage")}
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
      {inviting && <InviteDialog customer={inviting} onClose={() => setInviting(null)} onDone={(m) => (onToast(m), onSave(inviting))} />}
    </section>
  );
}

/** Etiquetas de um cliente: ativar/desativar as existentes ou criar uma nova. */
function TagEditor({ value, all, onChange }: { value: string[]; all: string[]; onChange: (v: string[]) => void }) {
  const { t } = useT();
  const { open, setOpen, ref } = useMenu();
  const [name, setName] = useState("");
  const toggle = (x: string) => onChange(value.includes(x) ? value.filter((y) => y !== x) : [...value, x]);
  return (
    <span className="menuwrap ax-tags" ref={ref}>
      {value.map((x) => (
        <span key={x} className="ax-tag">
          {x}
        </span>
      ))}
      <button className="ax-tag add" onClick={() => setOpen((o) => !o)} aria-label={t("ax.tags")} data-testid="ax-tag-add">
        <Icon name="tag" size={11} /> {value.length ? "" : t("ax.tags")}
      </button>
      {open && (
        <div className="menu" role="menu" style={{ minWidth: 200 }}>
          {all.map((x) => (
            <button key={x} role="menuitemcheckbox" aria-checked={value.includes(x)} onClick={() => toggle(x)}>
              {x}
              {value.includes(x) && (
                <span className="menu-check">
                  <Icon name="check" size={14} />
                </span>
              )}
            </button>
          ))}
          <form
            className="asg-add"
            onSubmit={(e) => {
              e.preventDefault();
              const v = name.trim().slice(0, 30);
              if (v && !value.includes(v)) onChange([...value, v]);
              setName("");
            }}
          >
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ax.newTag")} autoFocus data-testid="ax-tag-new" />
            <button className="btn small" aria-label={t("ax.newTag")}>
              <Icon name="plus" size={13} />
            </button>
          </form>
        </div>
      )}
    </span>
  );
}
