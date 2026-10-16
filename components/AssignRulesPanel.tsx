"use client";

// Definições → Automação de responsáveis: regras "quando … → atribuir a …". Edita o estado da página das
// Definições (grava com o botão Guardar dela). As regras aplicam-se ao gravar qualquer conteúdo (lib/assignRules).
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import type { AssignRule } from "@/lib/assignRules";
import { PHASES, POST_TYPES, type Customer } from "@/lib/customer";
import { customerStore } from "@/lib/customerStore";
import { useT, type Key } from "@/lib/i18n";
import { useTeamDirectory } from "@/components/team/useTeamDirectory";

export function AssignRulesPanel({ value = [], onChange, onSave }: { value?: AssignRule[]; onChange: (r: AssignRule[]) => void; onSave: () => void }) {
  const { t } = useT();
  const { dir } = useTeamDirectory();
  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    customerStore.list().then(setCustomers).catch(() => setCustomers([]));
  }, []);
  const people = [...dir.values()];
  const upd = (id: string, patch: Partial<AssignRule>) => onChange(value.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = () => onChange([...value, { id: crypto.randomUUID().slice(0, 8), on: "phase", phase: "editing", type: "any", customer_id: "any", assignee: people[0]?.email ?? "", active: true }]);
  return (
    <div className="arp stack" data-testid="assign-rules">
      <p className="muted small" style={{ margin: 0 }}>
        {t("arp.hint")}
      </p>
      {!value.length && <p className="muted small">{t("arp.none")}</p>}
      <ul className="arp-list">
        {value.map((r) => (
          <li key={r.id} className={`arp-row ${r.active === false ? "off" : ""}`} data-testid="arp-row">
            <span className="arp-w">{t("arp.when")}</span>
            <Select className="select" value={r.on === "create" ? "create" : `phase:${r.phase}`} onChange={(e) => (e.target.value === "create" ? upd(r.id, { on: "create", phase: undefined }) : upd(r.id, { on: "phase", phase: e.target.value.slice(6) as AssignRule["phase"] }))} aria-label={t("arp.when")}>
              <option value="create">{t("arp.created")}</option>
              {PHASES.map((ph) => (
                <option key={ph} value={`phase:${ph}`}>
                  {t("arp.movesTo", { phase: t(`pl.phase.${ph}` as Key) })}
                </option>
              ))}
            </Select>
            <Select className="select" value={r.type ?? "any"} onChange={(e) => upd(r.id, { type: e.target.value as AssignRule["type"] })} aria-label={t("dp.type")}>
              <option value="any">{t("arp.anyType")}</option>
              {POST_TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`ct.type.${x}` as Key)}
                </option>
              ))}
            </Select>
            <Select className="select" value={r.customer_id ?? "any"} onChange={(e) => upd(r.id, { customer_id: e.target.value })} aria-label={t("st.client")}>
              <option value="any">{t("arp.anyClient")}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <span className="arp-w">
              <Icon name="next" size={13} /> {t("arp.assignTo")}
            </span>
            <Select className="select" value={r.assignee} onChange={(e) => upd(r.id, { assignee: e.target.value })} aria-label={t("arp.assignTo")} data-testid="arp-person">
              {!people.some((p) => p.email === r.assignee) && <option value={r.assignee}>{r.assignee || "—"}</option>}
              {people.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.name}
                  {p.role ? ` · ${p.role}` : ""}
                </option>
              ))}
            </Select>
            <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
              <button className="check sm" role="checkbox" aria-checked={r.active !== false} onClick={() => upd(r.id, { active: r.active === false })} aria-label={t("arp.active")} title={t("arp.active")} />
              <button className="iconbtn" onClick={() => onChange(value.filter((x) => x.id !== r.id))} aria-label={t("remove")}>
                <Icon name="trash" size={14} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn small" onClick={add} disabled={!people.length} data-testid="arp-add">
          <Icon name="plus" size={13} /> {t("arp.add")}
        </button>
        <button className="btn small accent" onClick={onSave} data-testid="arp-save">
          <Icon name="check" size={13} /> {t("save")}
        </button>
      </div>
    </div>
  );
}
