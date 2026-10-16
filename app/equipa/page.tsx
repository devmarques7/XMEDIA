"use client";

import { TeamInviteDialog } from "@/components/team/TeamInviteDialog";
import { TeamWorkload } from "@/components/team/Workload";
import { Avatar } from "@/components/team/Avatar";
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { APP_ROLES, PERMS, ROLE_PRESETS, SENSITIVE, effectivePerms, type AppRole, type Perm } from "@/lib/roles";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, Toast, useToast } from "@/components/ui";
import { useT, type Key } from "@/lib/i18n";
import { download } from "@/lib/io";
import { store } from "@/lib/store";
import { memberApi, type InviteResult } from "@/lib/memberApi";
import { LANGS, type Lang } from "@/lib/i18n";
import {
  CURRENCIES,
  FALLBACK_RATES,
  convert,
  emptyMember,
  entryMinutes,
  fetchRates,
  fmtHours,
  fmtMoney,
  monthRange,
  monthSummary,
  shiftMonth,
  team,
  type Currency,
  type Me,
  type Member,
  type MonthClose,
  type Rates,
  type TimeEntry,
} from "@/lib/team";
import { isoDay, pad } from "@/lib/util";

const LS_CUR = "xmedia:cur";
type Tab = "hours" | "info" | "invite" | "close";

export default function TeamPage() {
  const { t, locale } = useT();
  const [toast, setToast] = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [month, setMonth] = useState(isoDay().slice(0, 7));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [closes, setCloses] = useState<MonthClose[]>([]);
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES);
  const [cur, setCur] = useState<Currency>("EUR");
  const [selected, setSelected] = useState<string | null>(null); // id | "new"
  const [projects, setProjects] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem(LS_CUR) as Currency | null;
      if (c && CURRENCIES.includes(c)) setCur(c);
    } catch {}
    fetchRates().then(setRates);
    store.list().then((ps) => setProjects(ps.map((p) => p.title))).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const who = await team.me();
      setMe(who);
      const { from, to } = monthRange(month);
      if (who.isAdmin) {
        const [ms, es, cs] = await Promise.all([team.members(), team.entries(from, to), team.closes(month)]);
        setMembers(ms);
        setEntries(es);
        setCloses(cs);
      } else if (who.member) {
        const [es, cs] = await Promise.all([team.entries(from, to, who.member.id), team.closes(month)]);
        setMembers([who.member]);
        setEntries(es);
        setCloses(cs.filter((c) => c.member_id === who.member!.id));
        setSelected(who.member.id);
      } else {
        setMembers([]);
      }
    } catch (e) {
      setToast((e as Error).message);
    }
  }, [month, setToast]);
  useEffect(() => {
    load();
  }, [load]);

  function pickCur(c: Currency) {
    setCur(c);
    try {
      localStorage.setItem(LS_CUR, c);
    } catch {}
  }
  function open(id: string) {
    setSelected(id);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const monthLabel = new Date(month + "-15T12:00:00").toLocaleDateString(locale, { month: "long", year: "numeric" });
  const rows = useMemo(
    () =>
      members.map((m) => {
        const es = entries.filter((e) => e.member_id === m.id);
        const s = monthSummary(m, es);
        return { m, es, s, inCur: convert(s.amount, s.currency, cur, rates), close: closes.find((c) => c.member_id === m.id) };
      }),
    [members, entries, closes, cur, rates]
  );
  const total = rows.reduce((a, r) => ({ min: a.min + r.s.minutes, val: a.val + r.inCur }), { min: 0, val: 0 });
  const sel = selected === "new" ? null : rows.find((r) => r.m.id === selected) ?? null;
  const isAdmin = !!me?.isAdmin;

  function exportCsv() {
    const lines = [["member", "date", "start", "end", "break_min", "minutes", "project", "note"].join(";")];
    for (const r of rows)
      for (const e of r.es) lines.push([r.m.name, e.date, e.start, e.end, e.break_min, entryMinutes(e), e.project, e.note.replace(/[;\n]/g, " ")].join(";"));
    lines.push("");
    lines.push(["member", "minutes", "rate", "currency", "amount", `amount_${cur}`].join(";"));
    for (const r of rows) lines.push([r.m.name, r.s.minutes, r.m.rate, r.m.rate_currency, r.s.amount, r.inCur.toFixed(2)].join(";"));
    download(`xmedia-horas-${month}.csv`, lines.join("\n"), "text/csv");
  }

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{isAdmin ? t("tm.sub") : t("tm.mySub")}</span>
          <h1 className="h1">{t("nav.team")}</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("cal.prev")}>
            <Icon name="back" size={14} />
          </button>
          <span className="label" style={{ minWidth: 120, textAlign: "center" }}>
            {monthLabel}
          </span>
          <button className="btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("cal.next")}>
            <Icon name="next" size={14} />
          </button>
        </div>
      </section>

      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="label muted">{t("tm.showIn")}</span>
          <div className="seg" role="group" aria-label={t("tm.currency")}>
            {CURRENCIES.map((c) => (
              <button key={c} aria-pressed={cur === c} onClick={() => pickCur(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <span className="muted small">
          {rates.live || rates.date
            ? t("tm.fx", { gbp: rates.rates.GBP.toFixed(4), brl: rates.rates.BRL.toFixed(4), date: rates.date })
            : t("tm.fxOffline")}
        </span>
      </div>


      {me && !isAdmin && !me.member && <p className="w">{t("tm.notMember")}</p>}

      {isAdmin && (
        <div className="widgets teamstats" style={{ paddingTop: 0, marginBottom: 14 }}>
          <div className="w span-4">
            <div className="label muted">{t("tm.payroll")}</div>
            <div className="num" style={{ marginTop: 12 }}>{fmtMoney(total.val, cur, locale)}</div>
          </div>
          <div className="w span-4">
            <div className="label muted">{t("tm.hours")}</div>
            <div className="num" style={{ marginTop: 12 }}>{fmtHours(total.min)}</div>
          </div>
          <div className="w span-4">
            <div className="label muted">{t("tm.members")}</div>
            <div className="num" style={{ marginTop: 12 }}>{pad(members.filter((m) => m.active).length)}</div>
          </div>
        </div>
      )}

      {isAdmin && <TeamWorkload />}

      <div className={isAdmin ? "calgrid" : ""}>
        {isAdmin && (
          <section className="w">
            <div className="w-head" style={{ flexWrap: "wrap", gap: 10 }}>
              <span className="label">
                <b>{pad(members.length)}</b>
                {t("tm.members")}
              </span>
              <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                {entries.length > 0 && (
                  <button className="btn ghost small" onClick={exportCsv}>
                    <Icon name="download" size={14} /> {t("tm.export")}
                  </button>
                )}
                <button className="btn ghost small" onClick={() => open("new")}>
                  + {t("tm.add")}
                </button>
                <button className="btn accent" onClick={() => setInviting(true)} data-testid="team-invite">
                  <Icon name="userPlus" size={14} /> {t("ti.title")}
                </button>
              </div>
            </div>
            {members.length === 0 && <p className="muted">{t("tm.empty")}</p>}
            <div className="memberlist">
              {rows.map(({ m, s, inCur, close }) => (
                <button key={m.id} className={`memberrow ${selected === m.id ? "sel" : ""} ${m.active ? "" : "off"}`} onClick={() => open(m.id)}>
                  <Avatar name={m.name} photo={m.photo_url} size={36} />
                  <span className="mr-main">
                    <span className="mr-name">{m.name}</span>
                    <span className="muted small">
                      {m.role || "—"} · {fmtMoney(m.rate, m.rate_currency, locale)}
                      {t("tm.perHour")}
                    </span>
                  </span>
                  <span className="mr-nums">
                    <span className="mono small">{fmtHours(s.minutes)}</span>
                    <b>{fmtMoney(inCur, cur, locale)}</b>
                    {close && <span className={`label ${close.paid ? "tone-ok" : "tone-warn"}`}>{close.paid ? t("tm.paid") : t("tm.closed")}</span>}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div ref={panelRef} style={{ scrollMarginTop: 90 }}>
          {(selected === "new" || sel) && (
            <MemberPanel
              key={selected!}
              row={sel}
              isAdmin={isAdmin}
              month={month}
              monthLabel={monthLabel}
              cur={cur}
              rates={rates}
              projects={projects}
              onToast={setToast}
              onChanged={async (id) => {
                await load();
                if (id !== undefined) setSelected(id);
              }}
            />
          )}
        </div>
      </div>
      {inviting && <TeamInviteDialog onClose={() => (setInviting(false), load())} onDone={() => load()} />}
      <Toast msg={toast} />
    </AppShell>
  );
}

type Row = { m: Member; es: TimeEntry[]; s: ReturnType<typeof monthSummary>; inCur: number; close?: MonthClose };

function MemberPanel({
  row,
  isAdmin,
  month,
  monthLabel,
  cur,
  rates,
  projects,
  onToast,
  onChanged,
}: {
  row: Row | null;
  isAdmin: boolean;
  month: string;
  monthLabel: string;
  cur: Currency;
  rates: Rates;
  projects: string[];
  onToast: (m: string) => void;
  onChanged: (selectId?: string | null) => Promise<void>;
}) {
  const { t, locale } = useT();
  const [tab, setTab] = useState<Tab>(row ? "hours" : "info");
  const m = row?.m;
  const locked = !!row?.close;

  return (
    <section className="w">
      {m ? (
        <div className="row" style={{ gap: 14, flexWrap: "nowrap", marginBottom: 12 }}>
          <span className="mr-avatar big">{m.name.slice(0, 1).toUpperCase()}</span>
          <div style={{ minWidth: 0 }}>
            <h2 className="h2" style={{ margin: 0 }}>
              {m.name}
            </h2>
            <span className="label muted">
              {m.role || "—"} · <StatusChip status={m.status} />
            </span>
          </div>
        </div>
      ) : (
        <h2 className="h2" style={{ marginTop: 0 }}>
          {t("tm.new")}
        </h2>
      )}

      {m && (
        <>
          <div className="earn">
            <span className="label muted">
              {t("tm.earned")} · {monthLabel}
            </span>
            <span className="num earn-big">{fmtMoney(row!.inCur, cur, locale)}</span>
            <span className="muted small">
              {fmtHours(row!.s.minutes)} · {row!.s.days} {t("tm.days").toLowerCase()} × {fmtMoney(m.rate, m.rate_currency, locale)}
              {t("tm.perHour")}
            </span>
          </div>
          <nav className="tabs" role="tablist" style={{ marginTop: 12 }}>
            {((isAdmin ? ["hours", "info", "invite", "close"] : ["hours", "info", "close"]) as Tab[]).map((k, i) => (
              <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                <b>{pad(i + 1)}</b>
                {k === "invite" ? t("inv.title") : t(`tm.tab.${k}` as "tm.tab.hours")}
              </button>
            ))}
          </nav>
        </>
      )}

      {m && tab === "hours" && (
        <HoursTab member={m} entries={row!.es} month={month} locked={locked} projects={projects} onToast={onToast} onChanged={() => onChanged()} />
      )}
      {(!m || tab === "info") &&
        (isAdmin ? (
          <MemberForm member={m ?? null} onToast={onToast} onChanged={onChanged} />
        ) : (
          <MemberInfo member={m!} />
        ))}
      {m && isAdmin && tab === "invite" && <InviteTab member={m} onToast={onToast} onChanged={() => onChanged()} />}
      {m && tab === "close" && (
        <CloseTab row={row!} isAdmin={isAdmin} month={month} monthLabel={monthLabel} rates={rates} onToast={onToast} onChanged={() => onChanged()} />
      )}
    </section>
  );
}

function HoursTab({
  member,
  entries,
  month,
  locked,
  projects,
  onToast,
  onChanged,
}: {
  member: Member;
  entries: TimeEntry[];
  month: string;
  locked: boolean;
  projects: string[];
  onToast: (m: string) => void;
  onChanged: () => Promise<void>;
}) {
  const { t, locale } = useT();
  const today = isoDay();
  const defDate = today.startsWith(month) ? today : `${month}-01`;

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const entry = {
      member_id: member.id,
      date: String(fd.get("date")),
      start: String(fd.get("start")),
      end: String(fd.get("end")),
      break_min: Math.max(0, parseInt(String(fd.get("break") || "0"), 10) || 0),
      project: String(fd.get("project") ?? "").trim(),
      note: String(fd.get("note") ?? "").trim(),
    };
    if (!entryMinutes(entry)) return onToast(t("tm.badTime"));
    try {
      await team.addEntry(entry);
      form.reset();
      onToast(t("tm.logged"));
      await onChanged();
    } catch (err) {
      onToast((err as Error).message);
    }
  }
  async function remove(id: string) {
    if (!confirm(t("removeConfirm", { what: t("tm.hours").toLowerCase() }))) return;
    await team.removeEntry(id).catch((e) => onToast(e.message));
    await onChanged();
  }

  return (
    <div style={{ paddingTop: 14 }}>
      {locked ? (
        <p className="note">{t("tm.locked")}</p>
      ) : (
        <form className="stack" onSubmit={add} style={{ marginBottom: 16 }}>
          <div className="hoursgrid">
            <label className="field">
              <span>{t("tm.date")}</span>
              <input className="input" type="date" name="date" required defaultValue={defDate} min={monthRange(month).from} max={monthRange(month).to} />
            </label>
            <label className="field">
              <span>{t("tm.start")}</span>
              <input className="input" type="time" name="start" required />
            </label>
            <label className="field">
              <span>{t("tm.end")}</span>
              <input className="input" type="time" name="end" required />
            </label>
            <label className="field">
              <span>{t("tm.break")}</span>
              <input className="input" type="number" name="break" min={0} step={5} defaultValue={0} inputMode="numeric" />
            </label>
          </div>
          <div className="grid2">
            <label className="field">
              <span>{t("tm.project")}</span>
              <input className="input" name="project" list="tm-projects" />
              <datalist id="tm-projects">
                {projects.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>{t("tm.note")}</span>
              <input className="input" name="note" />
            </label>
          </div>
          <div>
            <button className="btn accent" type="submit">
              + {t("tm.log")}
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <p className="muted">{t("tm.noEntries")}</p>
      ) : (
        <ol className="timeline">
          {entries.map((e) => (
            <li key={e.id}>
              <span className="mono small tl-time">
                {new Date(e.date + "T12:00:00").toLocaleDateString(locale, { weekday: "short", day: "2-digit" })}
              </span>
              <div className="row between" style={{ flexWrap: "nowrap", gap: 10 }}>
                <span style={{ minWidth: 0 }}>
                  <span className="mono">
                    {e.start}–{e.end}
                  </span>
                  {e.break_min > 0 && <span className="muted small"> · −{e.break_min}′</span>}
                  {(e.project || e.note) && (
                    <span className="muted small" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[e.project, e.note].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                  <b className="mono">{fmtHours(entryMinutes(e))}</b>
                  {!locked && (
                    <button className="btn ghost small" onClick={() => remove(e.id)} aria-label={t("remove")}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MemberForm({ member, onToast, onChanged }: { member: Member | null; onToast: (m: string) => void; onChanged: (id?: string | null) => Promise<void> }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const m = member ?? { ...emptyMember(), id: undefined };
  const [appRole, setAppRole] = useState<AppRole>(m.app_role ?? "none");
  const [perms, setPerms] = useState<Perm[]>(m.app_permissions ?? []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const saved = await team.saveMember({
        id: member?.id,
        name: String(fd.get("name")).trim(),
        email: String(fd.get("email") ?? ""),
        role: String(fd.get("role") ?? "").trim(),
        description: String(fd.get("description") ?? "").trim(),
        responsibilities: String(fd.get("resp") ?? "")
          .split("\n")
          .map((s) => s.replace(/^[-•·*]\s*/, "").trim())
          .filter(Boolean),
        rate: Math.max(0, Number(String(fd.get("rate") || "0").replace(",", ".")) || 0),
        rate_currency: String(fd.get("rate_currency")) as Currency,
        access: "member",
        app_role: appRole,
        app_permissions: effectivePerms(appRole, perms),
        lang: String(fd.get("lang")) as Lang,
        photo_url: String(fd.get("photo_url") ?? "").trim(),
        city: String(fd.get("city") ?? "").trim(),
        active: fd.get("active") === "on",
      });
      onToast(t("tm.saved"));
      await onChanged(saved.id);
    } catch (err) {
      onToast((err as Error).message);
    }
    setBusy(false);
  }
  async function remove() {
    if (!member || !confirm(t("tm.removeConfirm", { name: member.name }))) return;
    await team.removeMember(member.id).catch((e) => onToast(e.message));
    await onChanged(null);
  }

  return (
    <form className="stack" style={{ paddingTop: 14 }} onSubmit={save}>
      <label className="field">
        <span>{t("tm.name")}</span>
        <input className="input big" name="name" required defaultValue={m.name} />
      </label>
      <label className="field">
        <span>{t("tm.email")}</span>
        <input className="input" name="email" type="email" defaultValue={m.email} placeholder="nome@email.com" />
        <span className="muted small">{t("tm.emailHint")}</span>
      </label>
      <div className="grid2">
        <label className="field">
          <span>{t("tm.role")}</span>
          <input className="input" name="role" defaultValue={m.role} placeholder={t("tm.rolePh")} />
        </label>
        <label className="field">
          <span>{t("inv.lang")}</span>
          <Select className="select" name="lang" defaultValue={m.lang ?? "pt"}>
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {l === "pt" ? "Português" : l === "en" ? "English" : "Nederlands"}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="grid2">
        <label className="field">
          <span>{t("tm.rate")}</span>
          <input className="input" name="rate" inputMode="decimal" defaultValue={m.rate || ""} placeholder="0,00" />
        </label>
        <label className="field">
          <span>{t("tm.currency")}</span>
          <Select className="select" name="rate_currency" defaultValue={m.rate_currency}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </label>
      </div>
      <span className="muted small" style={{ marginTop: -6 }}>
        {t("tm.rateHint")} {t("tm.sameValue")}
      </span>
      <div className="grid2">
        <label className="field">
          <span>{t("pf.city")}</span>
          <input className="input" name="city" defaultValue={m.city ?? ""} />
        </label>
        <label className="field">
          <span>{t("pf.avatar")}</span>
          <input className="input" name="photo_url" type="url" defaultValue={m.photo_url ?? ""} placeholder="https://" />
        </label>
      </div>
      <label className="field">
        <span>{t("tm.description")}</span>
        <textarea className="textarea" name="description" rows={3} defaultValue={m.description} placeholder={t("tm.descriptionPh")} />
      </label>
      <label className="field">
        <span>{t("tm.resp")}</span>
        <textarea className="textarea" name="resp" rows={4} defaultValue={m.responsibilities.join("\n")} placeholder={t("tm.respPh")} />
      </label>
      <section className="stack rl-box">
        <span className="label muted">🔐 {t("rl.title")}</span>
        <label className="field">
          <span>{t("rl.role")}</span>
          <Select
            className="select"
            value={appRole}
            onChange={(e) => {
              const r = e.target.value as AppRole;
              setAppRole(r);
              setPerms(ROLE_PRESETS[r]);
            }}
          >
            {APP_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`rl.role.${r}` as Key)}
              </option>
            ))}
          </Select>
          <span className="muted small">{t(`rl.roleHint.${appRole}` as Key)}</span>
        </label>
        {appRole !== "none" && (
          <div className="rl-perms">
            {PERMS.map((p) => (
              <label key={p} className={`rl-perm ${SENSITIVE.includes(p) ? "sensitive" : ""}`}>
                <input type="checkbox" checked={perms.includes(p)} onChange={(e) => setPerms((l) => (e.target.checked ? [...l, p] : l.filter((x) => x !== p)))} />
                <span>
                  {t(`rl.perm.${p}` as Key)}
                  {SENSITIVE.includes(p) && <b className="tone-warn"> · {t("rl.sensitive")}</b>}
                </span>
              </label>
            ))}
          </div>
        )}
      </section>
      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" name="active" defaultChecked={m.active} /> {t("tm.active")}
      </label>
      <div className="row">
        <button className="btn accent" type="submit" disabled={busy}>
          {t("tm.save")}
        </button>
        {member && (
          <button className="btn danger" type="button" onClick={remove}>
            {t("tm.remove")}
          </button>
        )}
      </div>
    </form>
  );
}

function MemberInfo({ member }: { member: Member }) {
  const { t, locale } = useT();
  return (
    <div className="stack" style={{ paddingTop: 14 }}>
      <div>
        <div className="label muted">{t("tm.rate")}</div>
        <div className="num" style={{ fontSize: 28, marginTop: 6 }}>
          {fmtMoney(member.rate, member.rate_currency, locale)}
          {t("tm.perHour")}
        </div>
        <span className="muted small">{t("tm.rateHint")}</span>
      </div>
      {member.description && (
        <div>
          <div className="label muted">{t("tm.description")}</div>
          <p style={{ margin: "6px 0 0" }}>{member.description}</p>
        </div>
      )}
      {member.responsibilities.length > 0 && (
        <div>
          <div className="label muted">{t("tm.resp")}</div>
          <ul className="resp">
            {member.responsibilities.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CloseTab({
  row,
  isAdmin,
  month,
  monthLabel,
  rates,
  onToast,
  onChanged,
}: {
  row: Row;
  isAdmin: boolean;
  month: string;
  monthLabel: string;
  rates: Rates;
  onToast: (m: string) => void;
  onChanged: () => Promise<void>;
}) {
  const { t, locale } = useT();
  const { m, s, close } = row;
  // fechado: usa os valores congelados no fecho; aberto: valores atuais
  const amount = close ? close.amount : s.amount;
  const base = close ? close.rate_currency : s.currency;
  const minutes = close ? close.minutes : s.minutes;

  async function doClose() {
    if (!confirm(t("tm.closeConfirm", { month: monthLabel, name: m.name }))) return;
    await team
      .closeMonth({ member_id: m.id, month, minutes: s.minutes, rate: m.rate, rate_currency: m.rate_currency, amount: s.amount, paid: false })
      .catch((e) => onToast(e.message));
    await onChanged();
  }

  return (
    <div style={{ paddingTop: 14 }}>
      <div className="closegrid">
        {CURRENCIES.map((c) => (
          <div key={c} className={`closecell ${c === base ? "base" : ""}`}>
            <span className="label muted">{c}</span>
            <span className="num" style={{ fontSize: 24 }}>
              {fmtMoney(convert(amount, base, c, rates), c, locale)}
            </span>
          </div>
        ))}
      </div>
      <p className="muted small">
        {fmtHours(minutes)} × {fmtMoney(close ? close.rate : m.rate, base, locale)}
        {t("tm.perHour")} · {t("tm.sameValue")}
      </p>

      {close ? (
        <div className="stack">
          <span className={`label ${close.paid ? "tone-ok" : "tone-warn"}`}>
            ● {close.paid ? t("tm.paid") : t("tm.unpaid")} · {t("tm.closedOn", { date: new Date(close.closed_at).toLocaleDateString(locale) })}
          </span>
          {isAdmin && (
            <div className="row">
              <button
                className="btn"
                onClick={async () => {
                  await team.setPaid(close.id, !close.paid).catch((e) => onToast(e.message));
                  await onChanged();
                }}
              >
                {close.paid ? t("tm.unpaid") : `${t("tm.markPaid")}`}
              </button>
              <button
                className="btn ghost"
                onClick={async () => {
                  await team.reopen(close.id).catch((e) => onToast(e.message));
                  await onChanged();
                }}
              >
                {t("tm.reopen")}
              </button>
            </div>
          )}
        </div>
      ) : (
        isAdmin && (
          <button className="btn accent" onClick={doClose} disabled={s.minutes === 0}>
            {t("tm.closeMonth")} <Icon name="arrow" size={14} />
          </button>
        )
      )}
    </div>
  );
}

function StatusChip({ status }: { status: Member["status"] }) {
  const { t } = useT();
  const tone = status === "active" ? "tone-ok" : status === "invited" ? "tone-warn" : status === "disabled" ? "tone-danger" : "muted";
  return <span className={tone}>● {t(`inv.status.${status ?? "draft"}` as "inv.status.draft")}</span>;
}

/** Convite por email + link para partilhar; mostra o estado do registo e do código. */
function InviteTab({ member, onToast, onChanged }: { member: Member; onToast: (m: string) => void; onChanged: () => Promise<void> }) {
  const { t, locale } = useT();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<InviteResult | null>(null);
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "");

  async function send(mail = false) {
    setBusy(true);
    try {
      const r = await memberApi.invite(member.id, mail);
      setRes(r);
      onToast(r.email.sent ? t("inv.sent", { email: member.email }) : t("inv.copy"));
      await onChanged();
    } catch (e) {
      onToast((e as Error).message);
    }
    setBusy(false);
  }
  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      onToast(t("inv.copied"));
    } catch {}
  }
  const reason = res && !res.email.sent ? res.email.reason ?? "" : "";
  const reasonText = reason === "no_provider" || reason === "local_mode" ? t(`inv.reason.${reason}` as "inv.reason.no_provider") : reason;
  const body = res ? t("inv.mailBody", { name: member.name, link: res.link }) : "";

  return (
    <div className="stack" style={{ paddingTop: 14 }}>
      <div className="invstate">
        <div>
          <div className="label muted">{t("inv.title")}</div>
          <div style={{ marginTop: 6 }}>
            <StatusChip status={member.status} />
          </div>
        </div>
        <div className="muted small" style={{ textAlign: "right" }}>
          {member.status === "invited" && member.invite_expires_at && <div>{t("inv.expires", { date: fmt(member.invite_expires_at) })}</div>}
          {member.code_hint && (
            <div>
              {t("inv.code")} <span className="mono">{member.code_hint}</span>
            </div>
          )}
          {member.last_login_at && <div>{t("inv.lastLogin", { date: fmt(member.last_login_at) })}</div>}
        </div>
      </div>

      {!member.email && <p className="note">{t("inv.needEmail")}</p>}
      <div>
        <span className="row" style={{ gap: 8 }}>
          <button className="btn accent" onClick={() => send(false)} disabled={busy || !member.email}>
            <Icon name="link" size={14} /> {t("ti.getLink")}
          </button>
          <button className="btn" onClick={() => send(true)} disabled={busy || !member.email}>
            <Icon name="mail" size={14} /> {member.status === "draft" ? t("inv.send") : t("inv.resend")}
          </button>
        </span>
      </div>
      {member.status !== "draft" && <span className="muted small">{t("inv.resetHint")}</span>}

      {res && (
        <div className="w invlink">
          {res.email.sent ? (
            <span className="tone-ok small"><Icon name="check" size={14} /> {t("inv.sent", { email: member.email })}</span>
          ) : (
            <span className="tone-warn small">{t("inv.notSent", { reason: reasonText })}</span>
          )}
          <span className="label muted">{t("inv.link")}</span>
          <button className="codechip" style={{ fontSize: 12.5, padding: "8px 10px" }} onClick={() => copy(res.link)}>
            {res.link}
          </button>
          <div className="row">
            <button className="btn" onClick={() => copy(res.link)}>
              {t("inv.copy")}
            </button>
            <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(body)}`} target="_blank" rel="noreferrer">
              {t("inv.whatsapp")}
            </a>
            <a className="btn" href={`mailto:${member.email}?subject=${encodeURIComponent(t("inv.mailSubject"))}&body=${encodeURIComponent(body)}`}>
              {t("inv.mailto")}
            </a>
          </div>
          <span className="muted small">{t("inv.expires", { date: fmt(res.expiresAt) })}</span>
        </div>
      )}
    </div>
  );
}
