"use client";

import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { EmailPreview } from "@/components/EmailPreview";
import { ConnectionsPanel } from "@/components/ConnectionsPanel";
import { StoragePanel } from "@/components/StoragePanel";
import { AssignRulesPanel } from "@/components/AssignRulesPanel";
import { useEffect, useState } from "react";
import { CreatePasscode } from "@/components/customer/CreatePasscode";
import { AppShell, Toast, useToast } from "@/components/ui";
import { DEFAULT_SETTINGS, PHASES, normalizeSettings, type PortalSettings, type ProcessSettings } from "@/lib/customer";
import { customerStore } from "@/lib/customerStore";
import { useT, type Key } from "@/lib/i18n";
import { portalApi, type IntegrationStatus } from "@/lib/portalApi";

/** Definições do admin: mensalidade do portal, horários da fila e dados do estúdio no portal. */
export default function SettingsPage() {
  const { t, locale } = useT();
  const [toast, setToast] = useToast();
  const [s, setS] = useState<PortalSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [newTime, setNewTime] = useState("09:00");
  useEffect(() => {
    customerStore.settings().then(setS).catch((e) => setToast(e.message));
    portalApi.status().then(setStatus).catch(() => {});
  }, [setToast]);
  const set = (p: Partial<PortalSettings>) => setS((x) => ({ ...x, ...p }));
  const setProc = (p: Partial<ProcessSettings>) => setS((x) => ({ ...x, process: { ...x.process, ...p } }));
  const num = (v: string, min = 0) => Math.max(min, Math.round(Number(v) || 0));
  const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 5 + i).toLocaleDateString(locale, { weekday: "short" })); // 5 out 2026 = segunda

  async function save() {
    try {
      setS(await customerStore.saveSettings(normalizeSettings(s)));
      setToast(t("st.saved"));
    } catch (e) {
      setToast((e as Error).message);
    }
  }

  const flag = (on?: boolean) => <span className={`label ${on ? "tone-ok" : "muted"}`}>{on ? t("st.on") : t("st.off")}</span>;

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("st.sub")}</span>
          <h1 className="h1">{t("nav.settings")}</h1>
        </div>
        <button className="btn accent" onClick={save}>
          {t("st.save")}
        </button>
      </section>

      <div className="widgets" style={{ paddingTop: 0 }}>
        <section className="w span-5 stack">
          <span className="label muted">{t("st.price")}</span>
          <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
            <span className="num">€</span>
            <input
              className="input big"
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              value={s.price}
              onChange={(e) => set({ price: Math.max(0, Number(e.target.value) || 0) })}
              aria-label={t("st.price")}
              style={{ maxWidth: 140 }}
              data-testid="portal-price"
            />
            <span className="muted">{t("cu.perMonth")}</span>
          </div>
          <p className="muted small">{t("st.priceHint")}</p>
        </section>

        <section className="w span-7 stack">
          <span className="label muted">{t("st.slots")}</span>
          <div className="row" style={{ gap: 6 }}>
            {days.map((d, i) => (
              <button key={i} className={`chip ${s.slots.days.includes(i) ? "on" : ""}`} onClick={() => set({ slots: { ...s.slots, days: s.slots.days.includes(i) ? s.slots.days.filter((x) => x !== i) : [...s.slots.days, i].sort() } })}>
                {d}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {s.slots.times.map((tm) => (
              <span key={tm} className="chip on">
                {tm}{" "}
                <button className="btn ghost small" style={{ color: "inherit" }} onClick={() => set({ slots: { ...s.slots, times: s.slots.times.filter((x) => x !== tm) } })} aria-label={t("remove")}>
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
            <input className="input" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} style={{ width: 110 }} />
            <button className="btn small" onClick={() => newTime && !s.slots.times.includes(newTime) && set({ slots: { ...s.slots, times: [...s.slots.times, newTime].sort() } })}>
              {t("st.addTime")}
            </button>
          </div>
          <p className="muted small">{t("st.slotsHint")}</p>
        </section>

        <section className="w span-7 stack">
          <span className="label muted">{t("st.studio")}</span>
          <div className="grid2">
            <label className="field">
              <span>{t("st.hours")}</span>
              <input className="input" value={s.studio_hours} onChange={(e) => set({ studio_hours: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("st.delivery")}</span>
              <input className="input" type="number" min={1} value={s.delivery_days} onChange={(e) => set({ delivery_days: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
            <label className="field">
              <span>{t("st.email")}</span>
              <input className="input" type="email" value={s.contact_email} onChange={(e) => set({ contact_email: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("st.phone")}</span>
              <input className="input" type="tel" value={s.contact_phone} onChange={(e) => set({ contact_phone: e.target.value })} />
            </label>
          </div>
        </section>

        <section className="w span-12 stack" id="processo">
          <div className="row between">
            <span className="label muted">{t("pl.process")}</span>
            <span className="label tone-warn"><Icon name="lock" size={14} /> {t("pl.adminOnly")}</span>
          </div>
          <p className="muted small">{t("pl.processHint")}</p>
          <div className="tablewrap">
            <table className="table" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th>{t("pl.step")}</th>
                  <th>{t("pl.stepName")}</th>
                  <th className="r">{t("pl.days")}</th>
                </tr>
              </thead>
              <tbody>
                {PHASES.map((k) => (
                  <tr key={k}>
                    <td className="mono small muted">{t(`pl.phase.${k}` as Key)}</td>
                    <td>
                      <input
                        className="input"
                        placeholder={t(`pl.phase.${k}` as Key)}
                        value={s.process.steps[k].label}
                        onChange={(e) => setProc({ steps: { ...s.process.steps, [k]: { ...s.process.steps[k], label: e.target.value } } })}
                      />
                    </td>
                    <td className="r">
                      <input
                        className="input mono"
                        type="number"
                        min={0}
                        style={{ width: 80, textAlign: "right" }}
                        value={s.process.steps[k].days}
                        disabled={k === "scheduled" || k === "published"}
                        onChange={(e) => setProc({ steps: { ...s.process.steps, [k]: { ...s.process.steps[k], days: num(e.target.value) } } })}
                        aria-label={t("pl.days")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid2">
            <label className="field">
              <span>{t("pl.lead")}</span>
              <input className="input" type="number" min={0} value={s.process.approval_lead_days} onChange={(e) => setProc({ approval_lead_days: num(e.target.value) })} />
            </label>
            <label className="field">
              <span>{t("pl.warn")}</span>
              <input className="input" type="number" min={0} value={s.process.warn_days} onChange={(e) => setProc({ warn_days: num(e.target.value) })} />
            </label>
            <label className="field">
              <span>{t("pl.rounds")}</span>
              <input className="input" type="number" min={1} value={s.process.max_rounds} onChange={(e) => setProc({ max_rounds: num(e.target.value, 1) })} />
            </label>
            <label className="field">
              <span>{t("pl.fps")}</span>
              <Select className="select" value={s.process.fps} onChange={(e) => setProc({ fps: Number(e.target.value) })}>
                {[24, 25, 30, 50, 60].map((f) => (
                  <option key={f} value={f}>
                    {f} fps
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </section>

        {status && !status.local && (
          <section className="w span-7 stack">
            <span className="label muted"><Icon name="lock" size={14} /> {t("au.newCode")}</span>
            <p className="muted small">{t("au.newCodeHint")}</p>
            <CreatePasscode
              onDone={async (code) => {
                const r = await fetch("/api/auth/admin-passcode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `http_${r.status}`);
                setToast(t("au.codeSaved"));
              }}
            />
          </section>
        )}

        <section className="w span-5 stack">
          <span className="label muted">{t("st.integrations")}</span>
          {status?.local && <p className="note">{t("st.localNote")}</p>}
          <div className="statrow">
            <span className="small">{t("st.ig")}</span>
            <span style={{ marginLeft: "auto" }}>{flag(status?.instagram)}</span>
          </div>
          <div className="statrow">
            <span className="small">{t("st.mail")}</span>
            <span style={{ marginLeft: "auto" }}>{flag(status?.email)}</span>
          </div>
          <div className="statrow">
            <span className="small">{t("st.cron")}</span>
            <span style={{ marginLeft: "auto" }}>{flag(status?.cron)}</span>
          </div>
          <div className="statrow">
            <span className="small">{t("st.r2")}</span>
            <span style={{ marginLeft: "auto" }}>{flag(status?.r2)}</span>
          </div>
          <div className="statrow">
            <span className="small">{t("st.mux")}</span>
            <span style={{ marginLeft: "auto" }}>{flag(status?.mux)}</span>
          </div>
          <div className="statrow">
            <span className="small">{t("st.vault")}</span>
            <span style={{ marginLeft: "auto" }}>{flag(status?.vault)}</span>
          </div>
        </section>

        <section className="w span-12 stack" id="automacao">
          <span className="label muted">{t("arp.title")}</span>
          <AssignRulesPanel value={s.assign_rules ?? []} onChange={(assign_rules) => set({ assign_rules })} onSave={save} />
        </section>

        <section className="w span-12 stack" id="armazenamento">
          <span className="label muted">{t("stg.title")}</span>
          <StoragePanel />
        </section>

        <section className="w span-12 stack" id="ligacoes">
          <span className="label muted">{t("cn.title")}</span>
          <ConnectionsPanel />
        </section>

        <section className="w span-12 stack" id="emails">
          <div>
            <span className="label muted">{t("em.title")}</span>
            <p className="muted small" style={{ margin: "6px 0 0" }}>
              {t("em.sub")}
            </p>
          </div>
          <EmailPreview />
        </section>
      </div>
      <Toast msg={toast} />
    </AppShell>
  );
}
