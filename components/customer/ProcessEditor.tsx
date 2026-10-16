"use client";

// Ajustar o processo de UM cliente: grupos, etapas (nome, prazo, fases que cobre, ação do cliente, automático),
// ordem, adicionar e remover. E importar/exportar os dados do cliente em JSON.
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { useState } from "react";
import { DEFAULT_CLIENT_PROCESS, normalizeProcessDef, type ClientProcess, type ProcessStage } from "@/lib/clientProcess";
import { applyClientJson, CLIENT_JSON_EXAMPLE } from "@/lib/clientJson";
import type { ContentPost, Customer, Phase } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";

const PHASES: Phase[] = ["idea", "editing", "client_review", "changes", "blocked", "approved", "scheduled", "published"];

export function ProcessEditor({ value, onSave }: { value?: ClientProcess; onSave: (p: ClientProcess) => Promise<unknown> }) {
  const { t } = useT();
  const [p, setP] = useState<ClientProcess>(() => normalizeProcessDef(value ?? DEFAULT_CLIENT_PROCESS));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const upd = (i: number, x: Partial<ProcessStage>) => setP({ ...p, stages: p.stages.map((s, j) => (j === i ? { ...s, ...x } : s)) });
  const move = (i: number, d: number) => {
    const st = [...p.stages];
    const [x] = st.splice(i, 1);
    st.splice(Math.max(0, Math.min(st.length, i + d)), 0, x);
    setP({ ...p, stages: st });
  };
  const togglePhase = (i: number, ph: Phase) => {
    // uma fase só pode estar numa etapa: tira-a das outras
    setP({ ...p, stages: p.stages.map((s, j) => (j === i ? { ...s, phases: s.phases.includes(ph) ? s.phases.filter((x) => x !== ph) : [...s.phases, ph] } : { ...s, phases: s.phases.filter((x) => x !== ph) })) });
  };
  const renameGroup = (g: string, to: string) => setP({ ...p, groups: p.groups.map((x) => (x === g ? to : x)), stages: p.stages.map((s) => (s.group === g ? { ...s, group: to } : s)) });

  return (
    <section className="w stack pe2">
      <div className="row between">
        <div>
          <span className="tile-t">{t("pe.title")}</span>
          <p className="muted small" style={{ margin: "6px 0 0", maxWidth: 720 }}>
            {t("pe.sub")}
          </p>
        </div>
        <span className="row" style={{ gap: 6 }}>
          <button className="btn small ghost" onClick={() => setP(normalizeProcessDef(DEFAULT_CLIENT_PROCESS))}>
            {t("pe.reset")}
          </button>
          <button
            className="btn accent"
            disabled={busy}
            data-testid="pe-save"
            onClick={async () => {
              setBusy(true);
              const n = normalizeProcessDef(p);
              await onSave(n);
              setP(n);
              setBusy(false);
              setMsg(t("pe.saved"));
              setTimeout(() => setMsg(""), 2500);
            }}
          >
            {t("pe.save")}
          </button>
        </span>
      </div>
      {msg && <span className="small tone-ok">{msg}</span>}
      <div className="row" style={{ gap: 8 }}>
        <span className="tile-t muted">{t("pe.group")}</span>
        {p.groups.map((g) => (
          <input key={g} className="input small" defaultValue={g} onBlur={(e) => e.target.value.trim() && e.target.value !== g && renameGroup(g, e.target.value.trim())} style={{ width: 150 }} aria-label={t("pe.group")} />
        ))}
        <button className="btn small ghost" onClick={() => setP({ ...p, groups: [...p.groups, `${t("pe.group")} ${p.groups.length + 1}`] })}>
          +
        </button>
      </div>
      <div className="pe2-cols">
        {p.stages.map((s, i) => (
          <article key={i} className={`pe2-stage ${s.client ? "client" : ""}`}>
            <div className="row between" style={{ gap: 4 }}>
              <span className="mono small muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="row" style={{ gap: 2 }}>
                <button className="btn ghost small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="←">
                  <Icon name="back" size={14} />
                </button>
                <button className="btn ghost small" onClick={() => move(i, 1)} disabled={i === p.stages.length - 1} aria-label="→">
                  <Icon name="next" size={14} />
                </button>
                <button className="btn ghost small" onClick={() => p.stages.length > 1 && setP({ ...p, stages: p.stages.filter((_, j) => j !== i) })} aria-label="✕">
                  <Icon name="close" size={14} />
                </button>
              </span>
            </div>
            <input className="input" value={s.label} onChange={(e) => upd(i, { label: e.target.value })} aria-label={t("pe.stage")} data-testid={`pe-label-${i}`} />
            <label className="field">
              <span>{t("pe.group")}</span>
              <Select className="select" value={s.group} onChange={(e) => upd(i, { group: e.target.value })}>
                {p.groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </Select>
            </label>
            <label className="field">
              <span>{t("pe.days")}</span>
              <input className="input" type="number" min={0} max={60} value={s.days} onChange={(e) => upd(i, { days: Math.max(0, +e.target.value) })} />
            </label>
            <div className="field">
              <span>{t("pe.covers")}</span>
              <div className="row" style={{ gap: 4 }}>
                {PHASES.map((ph) => (
                  <button key={ph} className={`cb-chip ${s.phases.includes(ph) ? "on" : ""}`} onClick={() => togglePhase(i, ph)} style={{ fontSize: 10 }}>
                    {t(`pl.phase.${ph}` as Key)}
                  </button>
                ))}
              </div>
              {!s.phases.length && <span className="muted small">{t("pe.custom")}</span>}
            </div>
            <label className="row small" style={{ gap: 6 }}>
              <input type="checkbox" checked={!!s.client} onChange={(e) => upd(i, { client: e.target.checked || undefined })} /> {t("pe.client")}
            </label>
            <label className="row small" style={{ gap: 6 }}>
              <input type="checkbox" checked={!!s.auto} onChange={(e) => upd(i, { auto: e.target.checked || undefined })} /> {t("pe.auto")}
            </label>
          </article>
        ))}
        <button className="pe2-add" onClick={() => setP({ ...p, stages: [...p.stages, { id: `etapa-${p.stages.length + 1}`, label: `${t("pe.stage")} ${p.stages.length + 1}`, group: p.groups.at(-1) ?? "", days: 2, phases: [] }] })} data-testid="pe-add">
          {t("pe.add")}
        </button>
      </div>
    </section>
  );
}

export function ClientJsonImport({ customer, by, onApply }: { customer: Customer; by: string; onApply: (c: Customer, posts: ContentPost[], parts: string[]) => Promise<unknown> }) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="w stack">
      <div className="row between">
        <span className="tile-t">{t("ij.title")}</span>
        <span className="row" style={{ gap: 6 }}>
          <button className="btn small ghost" onClick={() => setText(CLIENT_JSON_EXAMPLE)}>
            {t("ij.example")}
          </button>
          <button
            className="btn small"
            onClick={() => {
              const { notes: _n, portal: _p, instagram: _i, feedback: _f, ...rest } = customer;
              const out = { client: { name: rest.name, contact: rest.contact, email: rest.email, phone: rest.phone, lang: rest.lang, stage: rest.stage }, kind: rest.kind, billing: rest.billing, process: rest.process, brand: rest.brand, tasks: rest.tasks };
              const u = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
              Object.assign(document.createElement("a"), { href: u, download: `${customer.name || "cliente"}.json` }).click();
              URL.revokeObjectURL(u);
            }}
          >
            <Icon name="download" size={14} /> {t("ij.export")}
          </button>
        </span>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {t("ij.hint")}
      </p>
      <textarea
        className="textarea mono small"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) setText(await f.text());
        }}
        placeholder="{ … }"
        data-testid="ij-text"
      />
      {err && <p className="note tone-danger small">{err}</p>}
      <button
        className="btn accent"
        style={{ alignSelf: "flex-start" }}
        disabled={busy || !text.trim()}
        data-testid="ij-apply"
        onClick={async () => {
          setErr("");
          setBusy(true);
          try {
            const r = applyClientJson(customer, text, by);
            await onApply(r.customer, r.posts, r.parts);
            setText("");
          } catch (e) {
            setErr((e as Error).message);
          }
          setBusy(false);
        }}
      >
        {t("ij.apply")}
      </button>
    </section>
  );
}
