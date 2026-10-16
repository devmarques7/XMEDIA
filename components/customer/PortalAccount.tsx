"use client";

// Conta do cliente no portal: Perfil (Instagram, língua, código, sair), Equipa (convidar em 3 passos, funções),
// Contrato (o que está combinado) e Pagamento (mensalidade e faturas).
import { Select } from "@/components/Select";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Tile } from "@/components/bento";
import { useErr } from "@/components/customer/PortalChrome";
import { Icon } from "@/components/Icon";
import { LangSwitch, ThemeToggle } from "@/components/ui";
import { CUSTOMER_USER_ROLES, canManageInstagram, planState, type Billing, type CustomerUser, type CustomerUserRole } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { isoDay } from "@/lib/util";
import { portalApi, rememberWho, type InviteResult, type PortalData, type PortalInvoice } from "@/lib/portalApi";

export type AccountSection = "profile" | "company" | "team" | "contract" | "payment";
export const ACCOUNT_SECTIONS: AccountSection[] = ["profile", "company", "team", "contract", "payment"];

export function PortalAccount({ data, section, onSection, onToast, reload, onSync, busy }: { data: PortalData; section: AccountSection; onSection: (s: AccountSection) => void; onToast: (m: string) => void; reload: () => Promise<unknown>; onSync: () => void; busy: boolean }) {
  const { t } = useT();
  const sections = ACCOUNT_SECTIONS.filter((s) => s !== "payment" || data.me.role !== "viewer");
  return (
    <div className="stack" style={{ gap: "var(--gap)" }}>
      <nav className="acc-nav" aria-label={t("po.tab.account")}>
        {sections.map((s) => (
          <button key={s} aria-current={section === s ? "page" : undefined} onClick={() => onSection(s)} data-testid={`acc-${s}`}>
            {t(s === "team" ? "ac.members" : (`ac.${s}` as Key))}
          </button>
        ))}
      </nav>
      {section === "profile" && <Profile data={data} onToast={onToast} reload={reload} onSync={onSync} busy={busy} />}
      {section === "company" && <Company data={data} onToast={onToast} reload={reload} />}
      {section === "team" && <Team data={data} onToast={onToast} />}
      {section === "contract" && <Contract data={data} />}
      {section === "payment" && data.me.role !== "viewer" && <Payment data={data} />}
    </div>
  );
}

function Profile({ data, onToast, reload, onSync, busy }: { data: PortalData; onToast: (m: string) => void; reload: () => Promise<unknown>; onSync: () => void; busy: boolean }) {
  const { t } = useT();
  const tErr = useErr();
  const router = useRouter();
  const c = data.customer;
  const [handle, setHandle] = useState(c.instagram.handle);
  const owner = canManageInstagram(data.me.role);
  return (
    <section className="widgets" style={{ padding: 0 }}>
      <div className="w span-6 stack">
        <span className="tile-t">{t("ac.profile")}</span>
        <div className="statrow">
          <span className="muted">{t("fb.name")}</span>
          <b style={{ marginLeft: "auto" }}>{data.me.name || "—"}</b>
        </div>
        <div className="statrow">
          <span className="muted">{t("cu.google")}</span>
          <b style={{ marginLeft: "auto" }}>{data.me.email}</b>
        </div>
        <div className="statrow">
          <span className="muted">{t("pu.role")}</span>
          <b style={{ marginLeft: "auto" }}>{t(`pu.role.${data.me.role}` as Key)}</b>
        </div>
        <div className="row">
          <LangSwitch />
          <ThemeToggle />
          <button className="btn" onClick={() => router.push("/portal/bem-vindo?change=1")}>
            <Icon name="lock" size={15} /> {t("po.changePasscode")}
          </button>
          <button
            className="btn ghost"
            onClick={async () => {
              rememberWho(null);
              await portalApi.logout();
              router.replace("/portal/login");
            }}
          >
            {t("po.logout")} <Icon name="arrow" size={14} />
          </button>
        </div>
      </div>
      <div className="w span-6 stack">
        <span className="tile-t">Instagram</span>
        <span className={`label ${c.instagram.connected ? "tone-ok" : "muted"}`}>● {c.instagram.connected ? t("mt.connected") : t("mt.notConnected")}</span>
        {owner && (
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="po-handle" style={{ flex: 1 }}>
              <span>@</span>
              <input className="input" value={handle} onChange={(e) => setHandle(e.target.value)} autoCapitalize="none" spellCheck={false} />
            </label>
            <button
              className="btn"
              onClick={async () => {
                try {
                  await portalApi.setHandle(handle);
                  await reload();
                  onToast(t("ct.saved"));
                } catch (e) {
                  onToast(tErr(e));
                }
              }}
            >
              {t("po.save")}
            </button>
          </div>
        )}
        <div className="row">
          {!c.instagram.connected && owner && data.info.igConnect && (
            <a className="btn accent" href="/api/portal/instagram/connect">
              <Icon name="instagram" size={15} /> {t("mt.connect")}
            </a>
          )}
          {c.instagram.connected && (
            <button className="btn" onClick={onSync} disabled={busy}>
              <Icon name="refresh" size={14} /> {t("mt.sync")}
            </button>
          )}
        </div>
        {!owner && <p className="muted small">{t("pp.askOwner")}</p>}
      </div>
    </section>
  );
}

const ERR: Record<string, Key> = { not_self: "tm.err.not_self", last_owner: "tm.err.last_owner", email_in_use: "tm.err.email_in_use" };

function Team({ data, onToast }: { data: PortalData; onToast: (m: string) => void }) {
  const { t, locale } = useT();
  const tErr = useErr();
  const owner = data.me.role === "owner";
  const [users, setUsers] = useState<CustomerUser[] | null>(null);
  const [step, setStep] = useState(0); // 0 = fechado, 1–3 passos
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CustomerUserRole>("member");
  const [result, setResult] = useState<{ email: string; invite: InviteResult } | null>(null);
  const [busy, setBusy] = useState(false);
  const err = (e: unknown) => onToast(ERR[(e as Error).message] ? t(ERR[(e as Error).message]) : tErr(e));
  const load = useCallback(() => portalApi.team().then(setUsers).catch(err), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [load]);
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  async function finish(send: boolean) {
    if (send && !confirm(t("pu.sendConfirm", { email: email.trim() }))) return;
    setBusy(true);
    try {
      const r = await portalApi.teamAction({ action: "save", name: name.trim(), email: email.trim(), role });
      const u = r.users.find((x) => x.email === email.trim().toLowerCase());
      if (!u) throw new Error("not_found");
      const inv = await portalApi.teamAction({ action: "invite", id: u.id, send });
      setUsers(inv.users);
      setResult({ email: email.trim(), invite: inv.invite! });
      setStep(4);
    } catch (e) {
      err(e);
    }
    setBusy(false);
  }
  const reset = () => {
    setStep(0);
    setName("");
    setEmail("");
    setRole("member");
    setResult(null);
  };

  return (
    <section className="widgets" style={{ padding: 0 }}>
      <div className="w span-7 stack">
        <div className="row between">
          <div>
            <span className="tile-t">{t("tm.title")}</span>
            <p className="muted small" style={{ margin: "6px 0 0" }}>
              {t("tm.sub")}
            </p>
          </div>
          {owner && step === 0 && (
            <button className="btn accent" onClick={() => setStep(1)} data-testid="tm-invite">
              + {t("tm.invite")}
            </button>
          )}
        </div>
        {!owner && <p className="note small">{t("tm.ownerOnly")}</p>}
        {(users ?? []).map((u) => (
          <div key={u.id} className="tmw-row">
            <span className="cl-av">{(u.name || u.email).slice(0, 2).toUpperCase()}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <b>
                {u.name || u.email} {u.id === data.me.id && <span className="muted small">{t("tm.you")}</span>}
              </b>
              <span className="muted small" style={{ display: "block" }}>
                {u.email} · <span className={u.status === "active" ? "tone-ok" : "tone-warn"}>{t(`pu.status.${u.status}` as Key)}</span>
                {u.last_login_at ? ` · ${new Date(u.last_login_at).toLocaleDateString(locale)}` : ""}
              </span>
            </span>
            {owner && u.id !== data.me.id ? (
              <span className="row" style={{ gap: 6 }}>
                <Select
                  className="select statussel"
                  value={u.role}
                  onChange={async (e) => {
                    try {
                      setUsers((await portalApi.teamAction({ action: "save", id: u.id, name: u.name, role: e.target.value as CustomerUserRole })).users);
                    } catch (x) {
                      err(x);
                    }
                  }}
                  aria-label={t("pu.role")}
                >
                  {CUSTOMER_USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`pu.role.${r}` as Key)}
                    </option>
                  ))}
                </Select>
                {u.status !== "active" && (
                  <button
                    className="btn small"
                    onClick={async () => {
                      try {
                        const r = await portalApi.teamAction({ action: "invite", id: u.id, send: false });
                        setResult({ email: u.email, invite: r.invite! });
                        setStep(4);
                      } catch (x) {
                        err(x);
                      }
                    }}
                  >
                    {t("tm.reinvite")}
                  </button>
                )}
                <button
                  className="btn small ghost"
                  onClick={async () => {
                    if (!confirm(t("tm.removeConfirm", { name: u.name || u.email }))) return;
                    try {
                      setUsers((await portalApi.teamAction({ action: "remove", id: u.id })).users);
                    } catch (x) {
                      err(x);
                    }
                  }}
                  aria-label={t("tm.remove")}
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            ) : (
              <span className="label muted">{t(`pu.role.${u.role}` as Key)}</span>
            )}
          </div>
        ))}
      </div>

      <div className="w span-5 stack tmw-wizard">
        {step === 0 ? (
          <>
            <span className="tile-t">{t("pu.role")}</span>
            {CUSTOMER_USER_ROLES.map((r) => (
              <div key={r} className="statrow" style={{ alignItems: "flex-start" }}>
                <b style={{ minWidth: 110 }}>{t(`pu.role.${r}` as Key)}</b>
                <span className="muted small">{t(`pu.roleHint.${r}` as Key)}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <ol className="tmw-steps">
              {(["tm.step1", "tm.step2", "tm.step3"] as const).map((k, i) => (
                <li key={k} className={step > i + 1 ? "done" : step === i + 1 ? "now" : ""}>
                  <span className="mono">{i + 1}</span> {t(k)}
                </li>
              ))}
            </ol>
            {step === 1 && (
              <>
                <label className="field">
                  <span>{t("fb.name")}</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus data-testid="tm-name" />
                </label>
                <label className="field">
                  <span>{t("fb.email")}</span>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com" data-testid="tm-email" />
                </label>
                <div className="row">
                  <button className="btn ghost" onClick={reset}>
                    {t("tm.back")}
                  </button>
                  <button className="btn accent" onClick={() => setStep(2)} disabled={!validEmail} data-testid="tm-next">
                    {t("tm.next")} <Icon name="next" size={14} />
                  </button>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                {CUSTOMER_USER_ROLES.map((r) => (
                  <label key={r} className={`tmw-role ${role === r ? "on" : ""}`}>
                    <input type="radio" name="tm-role" checked={role === r} onChange={() => setRole(r)} />
                    <span>
                      <b>{t(`pu.role.${r}` as Key)}</b>
                      <span className="muted small" style={{ display: "block" }}>
                        {t(`pu.roleHint.${r}` as Key)}
                      </span>
                    </span>
                  </label>
                ))}
                <div className="row">
                  <button className="btn ghost" onClick={() => setStep(1)}>
                    {t("tm.back")}
                  </button>
                  <button className="btn accent" onClick={() => setStep(3)} data-testid="tm-next2">
                    {t("tm.next")} <Icon name="next" size={14} />
                  </button>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <div className="statrow">
                  <span className="muted">{name || email}</span>
                  <b style={{ marginLeft: "auto" }}>{t(`pu.role.${role}` as Key)}</b>
                </div>
                <p className="muted small">{email}</p>
                <div className="row">
                  <button className="btn ghost" onClick={() => setStep(2)}>
                    {t("tm.back")}
                  </button>
                  <button className="btn accent" onClick={() => finish(true)} disabled={busy}>
                    <Icon name="mail" size={14} /> {t("tm.send")}
                  </button>
                  <button className="btn" onClick={() => finish(false)} disabled={busy} data-testid="tm-link">
                    {t("tm.linkOnly")}
                  </button>
                </div>
              </>
            )}
            {step === 4 && result && (
              <>
                <b><Icon name="check" size={14} /> {t("tm.done")}</b>
                <p className="small" style={{ margin: 0 }}>
                  {result.invite.email.sent ? t("tm.doneSent", { email: result.email }) : t("tm.doneLink", { email: result.email })}
                </p>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <input className="input mono small" readOnly value={result.invite.link} onFocus={(e) => e.target.select()} data-testid="tm-linkval" />
                  <button
                    className="btn small"
                    onClick={() => {
                      navigator.clipboard?.writeText(result.invite.link);
                      onToast(t("fb.copied"));
                    }}
                  >
                    {t("fb.copy")}
                  </button>
                </div>
                <button className="btn ghost" onClick={reset} style={{ alignSelf: "flex-start" }}>
                  <Icon name="back" size={14} /> {t("tm.title")}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Contract({ data }: { data: PortalData }) {
  const { t } = useT();
  const i = data.info;
  return (
    <section className="widgets" style={{ padding: 0 }}>
      <Tile span={4} tone="blue" title={t("ac.contract")} value={i.contract_signed ? <Icon name="check" size={48} /> : "—"} of={i.contract_signed ? t("ac.signed") : t("ac.unsigned")} />
      <Tile span={4} title={t("ac.delivery")} value={i.delivery_days} of={t("ac.deliveryN", { n: i.delivery_days }).replace(/^\d+\s*/, "")} />
      <Tile span={4} title={t("ac.rounds")} value={i.process?.max_rounds ?? 2} />
      <div className="w span-6 stack">
        <span className="tile-t">{t("ac.hours")}</span>
        <p style={{ margin: 0 }}>{i.studio_hours}</p>
      </div>
      <div className="w span-6 stack">
        <span className="tile-t">{t("ac.contact")}</span>
        <p style={{ margin: 0 }}>
          <a href={`mailto:${i.contact_email}`}>{i.contact_email}</a>
          <br />
          <a href={`https://wa.me/${i.contact_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
            {i.contact_phone}
          </a>
        </p>
      </div>
    </section>
  );
}

function Payment({ data }: { data: PortalData }) {
  const { t, locale } = useT();
  const c = data.customer;
  const [list, setList] = useState<PortalInvoice[] | null>(null);
  useEffect(() => {
    portalApi
      .billing()
      .then(setList)
      .catch(() => setList([]));
  }, []);
  const money = (v: number, cur = "EUR") => new Intl.NumberFormat(locale, { style: "currency", currency: cur }).format(v);
  const ps = planState({ ...c, notes: "" }, isoDay());
  const open = (list ?? []).filter((i) => i.status === "sent");
  const late = (i: PortalInvoice) => i.status === "sent" && new Date(i.issue_date + "T12:00:00").getTime() + i.due_days * 86_400_000 < Date.now();
  return (
    <section className="widgets" style={{ padding: 0 }}>
      <Tile span={4} title={t("ac.plan")} value={money(data.info.fee)} of={t("cu.perMonth")} foot={<><span>{t(`cu.plan.${ps}` as Key)}</span><span>{c.plan.paid_until ? new Date(c.plan.paid_until + "T12:00:00").toLocaleDateString(locale) : "—"}</span></>} />
      <Tile span={4} tone={open.length ? "blue" : undefined} title={t("ac.open")} value={money(open.reduce((s, i) => s + i.total, 0))} of={`${open.length}`} />
      <Tile span={4} title={t("ac.invoices")} value={(list ?? []).length} of={`${(list ?? []).filter((i) => i.status === "paid").length} ${t("ac.paid").toLowerCase()}`} />
      <div className="w span-12 stack">
        <span className="tile-t">{t("ac.invoices")}</span>
        {!list?.length ? (
          <p className="muted small">{t("ac.noInvoices")}</p>
        ) : (
          list.map((i) => (
            <div key={i.id} className="statrow">
              <span className="mono small" style={{ minWidth: 110 }}>
                {i.number}
              </span>
              <span className="muted small">{new Date(i.issue_date + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}</span>
              <span className={`label ${i.status === "paid" ? "tone-ok" : late(i) ? "tone-danger" : "tone-warn"}`} style={{ marginLeft: "auto" }}>
                {i.status === "paid" ? t("ac.paid") : late(i) ? t("ac.overdue") : t("ac.open")}
              </span>
              <span className="mono" style={{ minWidth: 100, textAlign: "right" }}>
                {money(i.total, i.currency)}
              </span>
            </div>
          ))
        )}
        <p className="muted small" style={{ margin: 0 }}>
          {t("ac.payHint")}
        </p>
      </div>
    </section>
  );
}

const EMPTY_BILLING: Billing = { company: "", contact: "", address: "", country: "NL", vat: "", kvk: "", email: "", website: "", sector: "", size: "", phone: "" };

function Company({ data, onToast, reload }: { data: PortalData; onToast: (m: string) => void; reload: () => Promise<unknown> }) {
  const { t } = useT();
  const tErr = useErr();
  const owner = data.me.role === "owner";
  const [kind, setKind] = useState<"company" | "person">(data.customer.kind ?? "company");
  const [b, setB] = useState<Billing>({ ...EMPTY_BILLING, ...(data.customer.billing ?? {}) });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Billing, v: string) => setB((x) => ({ ...x, [k]: v }));
  const fields: [keyof Billing, Key, boolean?][] =
    kind === "company"
      ? [["company", "ac.legal"], ["kvk", "ac.kvk" as Key], ["vat", "ac.vat" as Key], ["address", "cu.billAddress", true], ["country", "cu.billCountry"], ["website", "ac.website"], ["sector", "ac.sector"], ["size", "ac.size"], ["email", "cu.billEmail"], ["phone", "ac.phone"]]
      : [["company", "fb.name"], ["address", "cu.billAddress", true], ["country", "cu.billCountry"], ["website", "ac.website"], ["email", "cu.billEmail"], ["phone", "ac.phone"]];
  return (
    <section className="widgets" style={{ padding: 0 }}>
      <div className="w span-12 stack">
        <div className="row between">
          <span className="tile-t">{t("ac.company")}</span>
          <div className="seg" role="group" aria-label={t("ac.kind")}>
            {(["company", "person"] as const).map((k) => (
              <button key={k} aria-pressed={kind === k} onClick={() => owner && setKind(k)} disabled={!owner}>
                {t(k === "company" ? "ac.kindCompany" : "ac.kindPerson")}
              </button>
            ))}
          </div>
        </div>
        {!owner && <p className="note small">{t("tm.ownerOnly")}</p>}
        <fieldset className="grid4 co-grid" disabled={!owner} style={{ border: 0, padding: 0, margin: 0 }}>
          {fields.map(([k, label, wide]) => (
            <label key={k} className="field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
              <span>{label === ("ac.kvk" as Key) ? "KVK" : label === ("ac.vat" as Key) ? "VAT / BTW" : t(label)}</span>
              {wide ? (
                <textarea className="textarea small" rows={2} value={b[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
              ) : (
                <input className="input" value={b[k] ?? ""} onChange={(e) => set(k, k === "country" ? e.target.value.toUpperCase().slice(0, 2) : e.target.value)} />
              )}
            </label>
          ))}
        </fieldset>
        {owner && (
          <button
            className="btn accent"
            style={{ alignSelf: "flex-start" }}
            disabled={busy}
            data-testid="co-save"
            onClick={async () => {
              setBusy(true);
              try {
                await portalApi.saveCompany(kind, b);
                await reload();
                onToast(t("ct.saved"));
              } catch (e) {
                onToast(tErr(e));
              }
              setBusy(false);
            }}
          >
            {t("ac.saveCompany")}
          </button>
        )}
      </div>
    </section>
  );
}
