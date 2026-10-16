"use client";

// Cofre de acessos (keeper) — o mesmo componente no portal do cliente e no dashboard (internos + clientes).
// Lista rápida (plataforma, login, senha oculta com revelar/copiar, quem tem acesso), detalhe com conceito, link,
// permissões e registo, e formulário com gerador de senhas.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { Avatar } from "@/components/team/Avatar";
import { useT, type Key } from "@/lib/i18n";
import { platformOf, strength, strongPassword, type Grant, type PublicEntry } from "@/lib/vault";
import { vaultApi, vaultLocal, type People, type VaultList, type VaultSide } from "@/lib/vaultApi";
import type { Customer } from "@/lib/customer";

export function VaultView({ side, scope = "all", customers = [], onToast }: { side: VaultSide; scope?: string; customers?: Customer[]; onToast: (m: string) => void }) {
  const { t, locale } = useT();
  const [data, setData] = useState<VaultList | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<PublicEntry | null>(null);
  const [form, setForm] = useState<Partial<PublicEntry> | null>(null);
  const [shown, setShown] = useState<Record<string, string>>({});
  const err = (e: unknown) => {
    const m = (e as Error).message;
    const k = `vt.err.${m}` as Key;
    onToast(t(k) === k ? m : t(k));
  };
  const load = useCallback(() => vaultApi.list(side, scope).then(setData).catch((e) => (err(e), setData({ entries: [], people: { team: [], client: [] }, configured: false }))), [side, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => void load(), [load]);

  const cname = (id: string) => customers.find((c) => c.id === id)?.name;
  const list = useMemo(() => (data?.entries ?? []).filter((e) => !q.trim() || `${e.platform} ${e.url} ${e.login} ${e.concept} ${cname(e.customer_id) ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())), [data, q]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reveal(e: PublicEntry) {
    if (shown[e.id]) return setShown(({ [e.id]: _x, ...r }) => r);
    try {
      const p = await vaultApi.reveal(side, e);
      setShown((s) => ({ ...s, [e.id]: p }));
      setTimeout(() => setShown(({ [e.id]: _x, ...r }) => r), 30_000); // esconde sozinho
    } catch (x) {
      err(x);
    }
  }
  async function copy(e: PublicEntry, what: "login" | "password") {
    try {
      const v = what === "login" ? e.login : shown[e.id] ?? (await vaultApi.reveal(side, e, true));
      await navigator.clipboard.writeText(v);
      onToast(t(what === "login" ? "vt.copiedLogin" : "vt.copiedPass"));
    } catch (x) {
      err(x);
    }
  }

  return (
    <div className="vt">
      <section className="vt-sec">
        <Icon name="shield" size={20} />
        <span>
          <b>{t("vt.secTitle")}</b>
          <span className="muted small">{side === "portal" ? t("vt.secClient") : t("vt.secStudio")}</span>
        </span>
      </section>
      {data && !data.configured && <p className="note tone-danger small">{t("vt.notConfigured")}</p>}
      {vaultLocal && <p className="note small">{t("vt.localNote")}</p>}

      <div className="vt-bar">
        <span className="dh-search">
          <Icon name="search" size={15} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("vt.search")} aria-label={t("vt.search")} />
        </span>
        <button className="btn accent" onClick={() => setForm({ customer_id: side === "portal" ? "" : scope === "all" || scope === "internal" ? "" : scope })} data-testid="vt-new">
          <Icon name="plus" size={14} /> {t("vt.new")}
        </button>
      </div>

      {data && !list.length && (
        <button className="vt-ghost" onClick={() => setForm({ customer_id: side === "portal" ? "" : scope === "all" || scope === "internal" ? "" : scope })}>
          <span className="vt-logo gh" />
          <span className="gh-lines">
            <b>{t("vt.first")}</b>
            <span className="muted small">{t("vt.firstSub")}</span>
          </span>
        </button>
      )}

      <ul className="vt-list">
        {list.map((e) => (
          <li key={e.id} className="vt-row" data-testid="vt-row">
            <button className="vt-open" onClick={() => setOpen(e)} aria-label={e.platform}>
              <span className="vt-logo">{(e.platform || "?").slice(0, 2).toUpperCase()}</span>
              <span className="vt-name">
                <b>{e.platform || t("vt.untitled")}</b>
                <span className="muted small">
                  {side === "studio" && (e.customer_id ? cname(e.customer_id) ?? t("dd.clients") : t("td.internal"))}
                  {side === "studio" && " · "}
                  {e.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
                </span>
              </span>
            </button>
            <span className="vt-login">
              <span className="mono small">{e.login || "—"}</span>
              {e.login && (
                <button className="iconbtn" onClick={() => copy(e, "login")} aria-label={t("vt.copyLogin")} title={t("vt.copyLogin")}>
                  <Icon name="copy" size={14} />
                </button>
              )}
            </span>
            <span className="vt-pass">
              {e.can.reveal ? (
                <>
                  <span className="mono">{shown[e.id] ?? (e.has_secret ? "••••••••••" : "—")}</span>
                  {e.has_secret && (
                    <>
                      <button className="iconbtn" onClick={() => reveal(e)} aria-label={t("vt.reveal")} title={t("vt.reveal")} data-testid="vt-reveal">
                        <Icon name={shown[e.id] ? "eyeOff" : "eye"} size={14} />
                      </button>
                      <button className="iconbtn" onClick={() => copy(e, "password")} aria-label={t("vt.copyPass")} title={t("vt.copyPass")}>
                        <Icon name="copy" size={14} />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <span className="vt-locked small">
                  <Icon name="lock" size={13} /> {side === "studio" ? t("vt.clientDecides") : t("vt.noAccess")}
                </span>
              )}
            </span>
            <span className="vt-who">
              <GrantChips e={e} people={data?.people} />
            </span>
            <span className="vt-act">
              {e.url && (
                <a className="iconbtn" href={/^https?:/.test(e.url) ? e.url : `https://${e.url}`} target="_blank" rel="noreferrer noopener" aria-label={t("vt.openSite")} title={t("vt.openSite")}>
                  <Icon name="arrow" size={14} />
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>

      {open && data && (
        <Detail
          e={data.entries.find((x) => x.id === open.id) ?? open}
          side={side}
          people={data.people}
          client={cname(open.customer_id)}
          shown={shown[open.id]}
          onReveal={() => reveal(open)}
          onCopy={(w) => copy(open, w)}
          onEdit={() => (setForm(open), setOpen(null))}
          onClose={() => setOpen(null)}
          onGrants={async (g) => {
            try {
              await vaultApi.grants(side, open, g);
              await load();
              onToast(t("vt.grantsSaved"));
            } catch (x) {
              err(x);
            }
          }}
          onDelete={async () => {
            if (!confirm(t("ra.confirmDelete", { name: open.platform }))) return;
            try {
              await vaultApi.remove(side, open);
              setOpen(null);
              await load();
            } catch (x) {
              err(x);
            }
          }}
          locale={locale}
        />
      )}
      {form && (
        <EntryForm
          side={side}
          initial={form}
          customers={customers}
          onClose={() => setForm(null)}
          onSave={async (entry, password) => {
            try {
              await vaultApi.save(side, entry, password);
              setForm(null);
              await load();
              onToast(t("vt.saved"));
            } catch (x) {
              err(x);
            }
          }}
        />
      )}
    </div>
  );
}

function GrantChips({ e, people }: { e: PublicEntry; people?: People }) {
  const { t } = useT();
  const name = (g: Grant) => (g.kind === "studio" ? "XMEDIA" : [...(people?.team ?? []), ...(people?.client ?? [])].find((p) => p.email === g.email)?.name ?? g.email ?? "?");
  if (!e.grants.length) return <span className="muted small">{t("vt.onlyOwner")}</span>;
  return (
    <span className="av-stack" title={e.grants.map(name).join(", ")}>
      {e.grants.slice(0, 4).map((g, i) => (
        <Avatar key={i} name={name(g)} size={22} />
      ))}
    </span>
  );
}

function Detail({ e, side, people, client, shown, onReveal, onCopy, onEdit, onClose, onGrants, onDelete, locale }: { e: PublicEntry; side: VaultSide; people: People; client?: string; shown?: string; onReveal: () => void; onCopy: (w: "login" | "password") => void; onEdit: () => void; onClose: () => void; onGrants: (g: Grant[]) => void; onDelete: () => void; locale: string }) {
  const { t } = useT();
  const has = (g: Grant) => e.grants.some((x) => x.kind === g.kind && (x.email ?? "") === (g.email ?? ""));
  const toggle = (g: Grant) => onGrants(has(g) ? e.grants.filter((x) => !(x.kind === g.kind && (x.email ?? "") === (g.email ?? ""))) : [...e.grants, g]);
  const url = /^https?:/.test(e.url) ? e.url : `https://${e.url}`;
  return (
    <div className="overlay" onMouseDown={(x) => x.target === x.currentTarget && onClose()}>
      <aside className="vt-drawer" role="dialog" aria-modal="true" aria-label={e.platform}>
        <header className="row between">
          <span className="row" style={{ gap: 10 }}>
            <span className="vt-logo">{(e.platform || "?").slice(0, 2).toUpperCase()}</span>
            <span>
              <b style={{ fontSize: 20 }}>{e.platform}</b>
              <span className="muted small" style={{ display: "block" }}>
                {e.customer_id ? client : t("td.internal")}
              </span>
            </span>
          </span>
          <button className="btn ghost" onClick={onClose} aria-label={t("close")}>
            <Icon name="close" />
          </button>
        </header>

        {e.url && (
          <a className="btn" href={url} target="_blank" rel="noreferrer noopener">
            <Icon name="globe" size={14} /> {e.url.replace(/^https?:\/\//, "").slice(0, 50)} <Icon name="arrow" size={13} />
          </a>
        )}
        {e.concept && (
          <section className="vt-box">
            <span className="tile-t">{t("vt.concept")}</span>
            <p style={{ margin: 0, whiteSpace: "pre-line" }}>{e.concept}</p>
          </section>
        )}
        <section className="vt-box">
          <span className="tile-t">{t("vt.login")}</span>
          <span className="row between">
            <span className="mono">{e.login || "—"}</span>
            {e.login && (
              <button className="btn small ghost" onClick={() => onCopy("login")}>
                <Icon name="copy" size={13} /> {t("vt.copy")}
              </button>
            )}
          </span>
          <span className="tile-t" style={{ marginTop: 8 }}>
            {t("vt.password")}
          </span>
          {e.can.reveal ? (
            <span className="row between">
              <span className="mono">{shown ?? (e.has_secret ? "••••••••••" : "—")}</span>
              {e.has_secret && (
                <span className="row" style={{ gap: 4 }}>
                  <button className="btn small ghost" onClick={onReveal} data-testid="vt-d-reveal">
                    <Icon name={shown ? "eyeOff" : "eye"} size={13} /> {shown ? t("vt.hide") : t("vt.reveal")}
                  </button>
                  <button className="btn small ghost" onClick={() => onCopy("password")}>
                    <Icon name="copy" size={13} /> {t("vt.copy")}
                  </button>
                </span>
              )}
            </span>
          ) : (
            <span className="vt-locked small">
              <Icon name="lock" size={13} /> {side === "studio" ? t("vt.clientDecidesLong") : t("vt.noAccess")}
            </span>
          )}
        </section>

        <section className="vt-box">
          <span className="tile-t">{t("vt.access")}</span>
          <span className="muted small">{t("vt.registeredBy", { email: e.created_by.email, side: e.created_by.side === "client" ? t("tk.client") : "XMEDIA" })}</span>
          {e.can.manage ? (
            <div className="vt-grants">
              <label className="vt-g">
                <input type="checkbox" checked={has({ kind: "studio" })} onChange={() => toggle({ kind: "studio" })} data-testid="vt-g-studio" /> <b>{t("vt.wholeStudio")}</b>
              </label>
              {people.team.map((p) => (
                <label key={p.email} className="vt-g">
                  <input type="checkbox" checked={has({ kind: "member", email: p.email })} onChange={() => toggle({ kind: "member", email: p.email })} /> <Avatar name={p.name} size={18} /> {p.name} <span className="muted small">XMEDIA</span>
                </label>
              ))}
              {side === "portal" &&
                people.client.map((p) => (
                  <label key={p.email} className="vt-g">
                    <input type="checkbox" checked={has({ kind: "client", email: p.email })} onChange={() => toggle({ kind: "client", email: p.email })} /> <Avatar name={p.name || p.email} size={18} /> {p.name || p.email} <span className="muted small">{t(`pu.role.${p.role}` as Key)}</span>
                  </label>
                ))}
            </div>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>
              {e.customer_id ? (side === "studio" ? t("vt.onlyClientManages") : t("vt.onlyOwnerManages")) : t("vt.onlyAdminManages")}
            </p>
          )}
        </section>

        <section className="vt-box">
          <span className="tile-t">{t("vt.log")}</span>
          <ul className="vt-log">
            {[...e.audit].reverse().slice(0, 12).map((a, i) => (
              <li key={i}>
                <span className="mono small muted">{new Date(a.at).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="small">
                  {t(`vt.ev.${a.action}` as Key)} · {a.by}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {e.can.edit && (
          <div className="row between">
            <button className="btn ghost small" onClick={onDelete}>
              <Icon name="trash" size={13} /> {t("ra.delete")}
            </button>
            <button className="btn small" onClick={onEdit}>
              <Icon name="edit" size={13} /> {t("ra.edit")}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function EntryForm({ side, initial, customers, onClose, onSave }: { side: VaultSide; initial: Partial<PublicEntry>; customers: Customer[]; onClose: () => void; onSave: (e: Partial<PublicEntry> & { customer_id: string }, password?: string) => void }) {
  const { t } = useT();
  const [e, setE] = useState<Partial<PublicEntry> & { customer_id: string }>({ platform: "", url: "", concept: "", login: "", ...initial, customer_id: initial.customer_id ?? "" });
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const s = strength(pass);
  return (
    <div className="overlay" onMouseDown={(x) => x.target === x.currentTarget && onClose()}>
      <form
        className="dialog stack vt-form"
        onSubmit={(x) => {
          x.preventDefault();
          onSave({ ...e, platform: e.platform || platformOf(e.url ?? "") }, pass || undefined);
        }}
      >
        <header className="row between">
          <span className="tile-t">{initial.id ? t("vt.editTitle") : t("vt.new")}</span>
          <button type="button" className="btn ghost" onClick={onClose} aria-label={t("close")}>
            <Icon name="close" />
          </button>
        </header>
        <label className="field">
          <span>{t("vt.url")}</span>
          <input className="input" value={e.url} onChange={(x) => setE({ ...e, url: x.target.value, platform: e.platform && e.platform !== platformOf(e.url ?? "") ? e.platform : platformOf(x.target.value) })} placeholder="https://business.facebook.com" autoFocus data-testid="vt-url" />
        </label>
        <div className="grid4" style={{ gridTemplateColumns: side === "studio" && !initial.id ? "1fr 1fr" : "1fr" }}>
          <label className="field">
            <span>{t("vt.platform")}</span>
            <input className="input" value={e.platform} onChange={(x) => setE({ ...e, platform: x.target.value })} data-testid="vt-platform" />
          </label>
          {side === "studio" && !initial.id && (
            <label className="field">
              <span>{t("vt.owner")}</span>
              <Select className="select" value={e.customer_id} onChange={(x) => setE({ ...e, customer_id: x.target.value })}>
                <option value="">{t("td.internal")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </div>
        <label className="field">
          <span>{t("vt.concept")}</span>
          <input className="input" value={e.concept} onChange={(x) => setE({ ...e, concept: x.target.value })} placeholder={t("vt.conceptPh")} />
        </label>
        <label className="field">
          <span>{t("vt.login")}</span>
          <input className="input" value={e.login} onChange={(x) => setE({ ...e, login: x.target.value })} placeholder="email@empresa.com" autoComplete="off" data-testid="vt-login" />
        </label>
        <label className="field">
          <span>
            {t("vt.password")} {initial.id && <span className="muted">· {t("vt.keepEmpty")}</span>}
          </span>
          <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input className="input mono" type={show ? "text" : "password"} value={pass} onChange={(x) => setPass(x.target.value)} autoComplete="new-password" data-testid="vt-pass" />
            <button type="button" className="iconbtn" onClick={() => setShow((v) => !v)} aria-label={t("vt.reveal")}>
              <Icon name={show ? "eyeOff" : "eye"} size={14} />
            </button>
            <button type="button" className="btn small" onClick={() => (setPass(strongPassword()), setShow(true))}>
              <Icon name="refresh" size={13} /> {t("vt.generate")}
            </button>
          </span>
          {pass && (
            <span className="vt-str" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <i key={i} className={i < s ? `on s${s}` : ""} />
              ))}
            </span>
          )}
        </label>
        <p className="muted small" style={{ margin: 0 }}>
          <Icon name="shield" size={12} /> {t("vt.formNote")}
        </p>
        <button className="btn accent" disabled={!e.url?.trim() && !e.platform?.trim()} data-testid="vt-save">
          <Icon name="check" size={14} /> {t("save")}
        </button>
      </form>
    </div>
  );
}
