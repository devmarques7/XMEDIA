"use client";

// Painéis de administração do catálogo: importar JSON e editar regras de preço + pastas.
import { DropZone } from "@/components/DropZone";
import { Icon } from "@/components/Icon";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { serviceStore, type Catalog } from "@/lib/serviceStore";
import { normalizeRules, parseCatalog, slug, type PricingRules, type ServiceFolder, type Tier } from "@/lib/services";

type P = { catalog: Catalog; onDone: (msg: string) => void; onError: (msg: string) => void };

export function ImportPanel({ catalog, onDone, onError }: P) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [drag, setDrag] = useState(false);
  const [withRules, setWithRules] = useState(true);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => (text.trim() ? parseCatalog(text, catalog.folders) : null), [text, catalog.folders]);
  const ids = new Set(catalog.services.map((s) => s.id));
  const fresh = parsed?.services.filter((s) => !ids.has(s.id)).length ?? 0;

  async function go() {
    if (!parsed?.services.length) return;
    setBusy(true);
    try {
      if (withRules && parsed.folders?.length) await serviceStore.saveFolders(mergeFolders(catalog.folders, parsed.folders));
      if (withRules && parsed.rules) await serviceStore.saveRules(parsed.rules);
      // pastas novas referidas pelos serviços passam a existir
      const missing = [...new Set(parsed.services.map((s) => s.folder))].filter((f) => !catalog.folders.some((x) => x.id === f) && !parsed.folders?.some((x) => x.id === f));
      if (missing.length) await serviceStore.saveFolders(mergeFolders(catalog.folders, missing.map((id, i) => ({ id, label: id, color: "#8a8f98", order: 50 + i, hint: "" }))));
      const n = await serviceStore.saveMany(parsed.services, "import");
      setText("");
      onDone(t("sv.imp.done", { n }));
    } catch (e) {
      onError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <section
      className={`jsonbox stack sv-panel${drag ? " drag" : ""}`}
      onDragOver={(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave={() => setDrag(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) setText(await f.text());
      }}
    >
      <div className="label">{t("sv.imp.title")}</div>
      <p className="muted small">{t("sv.imp.hint")}</p>
      <textarea className="textarea mono" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder='{ "services": [ { "id": "edit-pro", "name": "Production | Editing PRO", "folder": "edit", "unit": "item", "price": 185, "crp": 65 } ] }' spellCheck={false} />
      {parsed?.errors.map((e, i) => (
        <p key={i} className="tone-danger small">
          {e}
        </p>
      ))}
      {parsed && parsed.services.length > 0 && <p className="small">{t("sv.imp.ready", { n: parsed.services.length, nw: fresh, up: parsed.services.length - fresh })}</p>}
      {(parsed?.rules || parsed?.folders) && (
        <label className="small row" style={{ gap: 6 }}>
          <input type="checkbox" checked={withRules} onChange={(e) => setWithRules(e.target.checked)} /> {t("sv.imp.rules")}
        </label>
      )}
      <div className="row">
        <button className="btn accent" onClick={go} disabled={busy || !parsed?.services.length}>
          {t("sv.imp.go")}
        </button>
        <DropZone target="json" compact onFiles={async ([f]) => setText(await f.text())} />
      </div>
    </section>
  );
}

function mergeFolders(a: ServiceFolder[], b: ServiceFolder[]) {
  const m = new Map(a.map((f) => [f.id, f]));
  for (const f of b) m.set(f.id, { ...m.get(f.id), ...f });
  return [...m.values()].sort((x, y) => x.order - y.order);
}

function TierEditor({ label, value, onChange, unit }: { label: string; value: Tier[]; onChange: (v: Tier[]) => void; unit: string }) {
  const { t } = useT();
  return (
    <div className="field">
      <span>{label}</span>
      <div className="sv-tiers">
        {value.map((r, i) => (
          <span key={i} className="sv-tier">
            <input className="input mono" type="number" min={0} value={r.min} onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, min: +e.target.value } : x)))} aria-label={unit} />
            <span className="muted">{unit} <Icon name="next" size={14} /></span>
            <input className="input mono" type="number" min={0} max={100} value={r.pct} onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, pct: +e.target.value } : x)))} aria-label="%" />
            <span className="muted">%</span>
            <button className="btn ghost small" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label={t("remove")}>
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
        <button className="btn ghost small" onClick={() => onChange([...value, { min: (value.at(-1)?.min ?? 0) + 1, pct: 0 }])}>
          {t("sv.r.addRow")}
        </button>
      </div>
    </div>
  );
}

export function RulesPanel({ catalog, onDone, onError }: P) {
  const { t } = useT();
  const [r, setR] = useState<PricingRules>(catalog.rules);
  const [folders, setFolders] = useState<ServiceFolder[]>(catalog.folders);
  const [busy, setBusy] = useState(false);
  const num = (k: keyof PricingRules, label: string) => (
    <label className="field">
      <span>{label}</span>
      <input className="input mono" type="number" min={0} value={r[k] as number} onChange={(e) => setR({ ...r, [k]: +e.target.value })} />
    </label>
  );
  const inUse = (id: string) => catalog.services.some((s) => s.folder === id);

  async function save() {
    setBusy(true);
    try {
      await serviceStore.saveRules(normalizeRules(r));
      await serviceStore.saveFolders(folders.map((f, i) => ({ ...f, order: i + 1 })));
      onDone(t("sv.r.saved"));
    } catch (e) {
      onError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <section className="jsonbox stack sv-panel">
      <div className="label">{t("sv.r.title")}</div>
      <p className="muted small">{t("sv.r.hint")}</p>
      <div className="grid2">
        <TierEditor label={t("sv.r.hours")} value={r.hours_tiers} onChange={(v) => setR({ ...r, hours_tiers: v })} unit="h" />
        <TierEditor label={t("sv.r.volume")} value={r.volume_tiers} onChange={(v) => setR({ ...r, volume_tiers: v })} unit="#" />
        <TierEditor
          label={t("sv.r.recurring")}
          value={r.recurring.map((x) => ({ min: x.months, pct: x.pct }))}
          onChange={(v) => setR({ ...r, recurring: v.map((x) => ({ months: x.min, pct: x.pct })) })}
          unit="m"
        />
      </div>
      <label className="small row" style={{ gap: 6 }}>
        <input type="checkbox" checked={r.hours_on_capture} onChange={(e) => setR({ ...r, hours_on_capture: e.target.checked })} /> {t("sv.r.hoursCapture")}
      </label>
      <div className="grid4 sv-rule-nums">
        {num("partner_pct", t("sv.r.partner"))}
        {num("cap_pct", t("sv.r.cap"))}
        {num("floor_margin", t("sv.r.floor"))}
        {num("target_margin", t("sv.r.target"))}
        <label className="field">
          <span>{t("sv.r.healthy")}</span>
          <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input className="input mono" type="number" value={r.healthy[0]} onChange={(e) => setR({ ...r, healthy: [+e.target.value, r.healthy[1]] })} />
            <span className="muted">–</span>
            <input className="input mono" type="number" value={r.healthy[1]} onChange={(e) => setR({ ...r, healthy: [r.healthy[0], +e.target.value] })} />
          </span>
        </label>
        {num("rush_pct", t("sv.r.rush"))}
        {num("btw", t("sv.r.btw"))}
        {num("deposit_pct", t("sv.r.deposit"))}
      </div>

      <div className="label" style={{ marginTop: 18 }}>
        {t("sv.folders")}
      </div>
      <ul className="sv-folders">
        {folders.map((f, i) => (
          <li key={f.id}>
            <input type="color" value={f.color} onChange={(e) => setFolders(folders.map((x) => (x.id === f.id ? { ...x, color: e.target.value } : x)))} aria-label="color" />
            <input className="input" value={f.label} onChange={(e) => setFolders(folders.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))} aria-label={t("sv.r.folderName")} />
            <input className="input small" value={f.hint} onChange={(e) => setFolders(folders.map((x) => (x.id === f.id ? { ...x, hint: e.target.value } : x)))} aria-label="hint" />
            <button className="btn ghost small" disabled={i === 0} onClick={() => setFolders(swap(folders, i, i - 1))} aria-label="↑">
              <Icon name="upload" size={14} />
            </button>
            <button className="btn ghost small" disabled={i === folders.length - 1} onClick={() => setFolders(swap(folders, i, i + 1))} aria-label="↓">
              <Icon name="download" size={14} />
            </button>
            <button className="btn ghost small" onClick={() => (inUse(f.id) ? onError(t("sv.r.folderInUse")) : setFolders(folders.filter((x) => x.id !== f.id)))} aria-label={t("remove")}>
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="row">
        <button
          className="btn ghost small"
          onClick={() => {
            const label = prompt(t("sv.r.folderName"));
            if (label?.trim()) setFolders([...folders, { id: slug(label), label: label.trim(), color: "#8a8f98", order: folders.length + 1, hint: "" }]);
          }}
        >
          {t("sv.r.folderAdd")}
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn accent" onClick={save} disabled={busy}>
          {t("sv.save")}
        </button>
      </div>
    </section>
  );
}

const swap = <T,>(a: T[], i: number, j: number) => {
  const b = a.slice();
  [b[i], b[j]] = [b[j], b[i]];
  return b;
};
