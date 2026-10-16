"use client";

import { DropZone } from "@/components/DropZone";
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmailPanel } from "@/components/proposal/EmailPanel";
import { PricingPanel } from "@/components/proposal/PricingPanel";
import { SlideFrame, SlideView } from "@/components/proposal/Slide";
import { AppShell, Toast, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { download } from "@/lib/io";
import { uploadMedia } from "@/lib/media";
import {
  SLIDE_TYPES,
  STAGES,
  blankSlide,
  importProposalJson,
  type CycleStep,
  type Media,
  type Package,
  type Proposal,
  type ProposalTheme,
  type Row,
  type Slide,
  type SlideType,
} from "@/lib/proposal";
import { PROPOSAL_SAVED, proposalStore } from "@/lib/proposalStore";
import { isLocalMode } from "@/lib/store";
import { supabaseEnabled } from "@/lib/supabase/client";
import { pad } from "@/lib/util";
import { VersionHistory } from "@/components/VersionHistory";

type Tab = "content" | "pricing" | "deal" | "design" | "json";

export default function ProposalEditor() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const [toast, setToast] = useToast();
  const [p, setP] = useState<Proposal | null>(null);
  const [missing, setMissing] = useState(false);
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<Tab>("content");
  const [saved, setSaved] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const selfSave = useRef(false);

  useEffect(() => {
    const n = Number(new URLSearchParams(location.search).get("slide"));
    if (Number.isInteger(n) && n > 0) setSel(n);
  }, [id]);

  const reload = useCallback(() => proposalStore.get(id).then((x) => (x ? setP(x) : setMissing(true))), [id]);
  useEffect(() => {
    reload().catch((e) => setToast(e.message));
    // alterações feitas pelo assistente (IA) noutra parte da app
    const h = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail?.id !== id) return;
      if (selfSave.current) return void (selfSave.current = false);
      reload();
    };
    window.addEventListener(PROPOSAL_SAVED, h);
    return () => window.removeEventListener(PROPOSAL_SAVED, h);
  }, [id, reload, setToast]);

  const update = useCallback(
    (fn: (x: Proposal) => Proposal) => {
      setP((cur) => {
        if (!cur) return cur;
        const next = fn(cur);
        setSaved(false);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          selfSave.current = true;
          proposalStore
            .save(next)
            .then(() => setSaved(true))
            .catch((e) => setToast(e.message));
        }, 700);
        return next;
      });
    },
    [setToast]
  );

  if (missing)
    return (
      <AppShell>
        <p className="muted" style={{ paddingTop: 30 }}>
          404 · <Link href="/propostas">{t("pr.back")}</Link>
        </p>
      </AppShell>
    );
  if (!p) return <AppShell>{null}</AppShell>;

  const slides = p.doc.slides;
  const cur = slides[Math.min(sel, slides.length - 1)];
  const setSlide = (patch: Partial<Slide>) =>
    update((x) => ({ ...x, doc: { ...x.doc, slides: x.doc.slides.map((s) => (s.id === cur.id ? ({ ...s, ...patch } as Slide) : s)) } }));
  const setSlides = (fn: (s: Slide[]) => Slide[]) => update((x) => ({ ...x, doc: { ...x.doc, slides: fn(x.doc.slides) } }));
  const move = (d: number) => {
    const j = sel + d;
    if (j < 0 || j >= slides.length) return;
    setSlides((s) => {
      const a = [...s];
      [a[sel], a[j]] = [a[j], a[sel]];
      return a;
    });
    setSel(j);
  };

  return (
    <AppShell>
      <section className="pagehead" style={{ paddingBottom: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Link href="/propostas" className="label muted arrow">
            <Icon name="back" size={14} /> {t("pr.back")}
          </Link>
          <input className="input pr-titlein" value={p.title} onChange={(e) => update((x) => ({ ...x, title: e.target.value }))} aria-label={t("pr.col.title")} />
          <span className="muted small">
            {t(`pr.stage.${p.stage}`)} · {new Intl.NumberFormat("en", { style: "currency", currency: p.currency }).format(p.value)} · {slides.length} slides ·{" "}
            {saved ? `${t("fin.saved")}` : "…"}
          </span>
          {p.decision && (
            <span className={`label ${p.decision.status === "approved" ? "tone-ok" : "tone-danger"}`} style={{ display: "block", marginTop: 6 }}>
              {p.decision.status === "approved" ? "Booking" : "✕"} · {p.decision.name} ({p.decision.email}) · {new Date(p.decision.at).toLocaleString()}
              {p.decision.totals ? ` · €${p.decision.totals.subtotal.toFixed(2)} excl. BTW` : ""}
              {p.decision.note ? ` · “${p.decision.note}”` : ""}
              {p.decision.emailed === false ? " · email não enviado" : ""}
            </span>
          )}
        </div>
        <div className="row">
          <VersionHistory entity="proposal" id={p.id} className="btn" />
          <Link className="btn" href={`/propostas/${p.id}/apresentar`} target="_blank">
            <Icon name="play" size={14} /> {t("pr.present")}
          </Link>
          <Link className="btn" href={`/propostas/${p.id}/print`} target="_blank">
            <Icon name="download" size={14} /> {t("pr.pdf")}
          </Link>
          <button className="btn" onClick={() => setShareOpen((o) => !o)} aria-expanded={shareOpen}>
            <Icon name="arrow" size={14} /> {t("pr.share")}
          </button>
          <button className="btn accent" onClick={() => setMailOpen((o) => !o)} aria-expanded={mailOpen} data-testid="pr-mail">
            <Icon name="mail" size={14} /> {t("pe.open")}
          </button>
        </div>
      </section>

      {shareOpen && <SharePanel proposal={p} onToast={setToast} />}
      {mailOpen && <EmailPanel p={p} onToast={setToast} onSent={() => reload()} />}

      <div className="pr-editor">
        {/* trilho de slides */}
        <aside className="pr-rail">
          {slides.map((s, i) => (
            <button key={s.id} className={`pr-railitem ${i === sel ? "on" : ""}`} onClick={() => setSel(i)} aria-label={`${i + 1} ${s.type}`}>
              <span className="mono small">{pad(i + 1)}</span>
              <SlideFrame>
                <SlideView slide={s} doc={p.doc} mode="print" />
              </SlideFrame>
            </button>
          ))}
          <AddSlide
            onAdd={(type) => {
              setSlides((s) => [...s.slice(0, sel + 1), blankSlide(type), ...s.slice(sel + 1)]);
              setSel(sel + 1);
            }}
          />
        </aside>

        {/* preview */}
        <div className="pr-stage">
          <SlideFrame className="pr-main">
            <SlideView slide={cur} doc={p.doc} mode="edit" />
          </SlideFrame>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
            <span className="label muted">
              {pad(sel + 1)} / {pad(slides.length)} · {cur.type}
            </span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn ghost small" onClick={() => move(-1)} disabled={sel === 0} title={t("pr.moveUp")}>
                <Icon name="upload" size={14} />
              </button>
              <button className="btn ghost small" onClick={() => move(1)} disabled={sel === slides.length - 1} title={t("pr.moveDown")}>
                <Icon name="download" size={14} />
              </button>
              <button
                className="btn ghost small"
                title={t("pr.duplicate")}
                onClick={() => {
                  setSlides((s) => [...s.slice(0, sel + 1), { ...structuredClone(cur), id: crypto.randomUUID() }, ...s.slice(sel + 1)]);
                  setSel(sel + 1);
                }}
              >
                <Icon name="copy" size={14} />
              </button>
              <button
                className="btn ghost small"
                title={t("pr.remove")}
                disabled={slides.length <= 1}
                onClick={() => {
                  setSlides((s) => s.filter((x) => x.id !== cur.id));
                  setSel(Math.max(0, sel - 1));
                }}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* painel */}
        <aside className="pr-panel">
          <nav className="tabs" role="tablist" style={{ paddingTop: 0 }}>
            {(["content", "pricing", "deal", "design", "json"] as Tab[]).map((k, i) => (
              <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                <b>{pad(i + 1)}</b>
                {t(`pr.tab.${k}`)}
              </button>
            ))}
          </nav>
          <div className="stack" style={{ paddingTop: 14 }}>
            {tab === "content" && <SlideFields slide={cur} onChange={setSlide} proposalId={p.id} onToast={setToast} />}
            {tab === "pricing" && <PricingPanel key={p.id} p={p} update={update} onToast={setToast} />}
            {tab === "deal" && <DealFields p={p} update={update} />}
            {tab === "design" && <DesignFields p={p} update={update} />}
            {tab === "json" && (
              <JsonTab
                p={p}
                onApply={(patch) => {
                  update((x) => ({ ...x, ...patch, doc: patch.doc ?? x.doc }));
                  setSel(0);
                  setToast(t("pr.jsonOk"));
                }}
                onToast={setToast}
              />
            )}
          </div>
        </aside>
      </div>
      <Toast msg={toast} />
    </AppShell>
  );
}

function AddSlide({ onAdd }: { onAdd: (t: SlideType) => void }) {
  const { t } = useT();
  const [type, setType] = useState<SlideType>("section");
  return (
    <div className="pr-add">
      <Select className="select" value={type} onChange={(e) => setType(e.target.value as SlideType)} aria-label={t("pr.slideType")}>
        {SLIDE_TYPES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>
      <button className="btn small" onClick={() => onAdd(type)}>
        + {t("pr.addSlide")}
      </button>
    </div>
  );
}

const Text = ({ label, value, onChange, area, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; area?: boolean; rows?: number }) => (
  <label className="field">
    <span>{label}</span>
    {area ? <textarea className="textarea" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /> : <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />}
  </label>
);

function SlideFields({ slide: s, onChange, proposalId, onToast }: { slide: Slide; onChange: (p: Partial<Slide>) => void; proposalId: string; onToast: (m: string) => void }) {
  const { t } = useT();
  const hint = <span className="muted small">{t("pr.marksHint")}</span>;
  switch (s.type) {
    case "cover":
      return (
        <>
          <div className="seg" role="group" aria-label="cover style">
            {(["classic", "gradient"] as const).map((v) => (
              <button key={v} aria-pressed={(s.style ?? "classic") === v} onClick={() => onChange({ style: v })}>
                {v === "classic" ? "Classic" : "XMEDIA gradient"}
              </button>
            ))}
          </div>
          {s.style === "gradient" && (
            <>
              <Text label="Kicker" value={s.kicker ?? ""} onChange={(v) => onChange({ kicker: v })} />
              <Text label="Title" value={s.title ?? ""} onChange={(v) => onChange({ title: v })} area />
            </>
          )}
          <Text label="Statement" value={s.statement} onChange={(v) => onChange({ statement: v })} area />
          <Text label="Mark" value={s.mark} onChange={(v) => onChange({ mark: v })} />
          <MediaList label={t("pr.media")} items={s.image ? [s.image] : []} max={1} onChange={(m) => onChange({ image: m[0] })} proposalId={proposalId} onToast={onToast} />
        </>
      );
    case "section":
      return (
        <>
          <div className="grid2">
            <Text label="Number" value={s.number} onChange={(v) => onChange({ number: v })} />
            <Text label="Title" value={s.title} onChange={(v) => onChange({ title: v })} />
          </div>
          <Text label="Text" value={s.text} onChange={(v) => onChange({ text: v })} area rows={4} />
          {hint}
        </>
      );
    case "manifest":
      return (
        <>
          <Text label="Index" value={s.index} onChange={(v) => onChange({ index: v })} />
          <Text label="Headline" value={s.headline} onChange={(v) => onChange({ headline: v })} area />
          <Text label="Subtitle" value={s.subtitle} onChange={(v) => onChange({ subtitle: v })} />
          <Text label="Body" value={s.body} onChange={(v) => onChange({ body: v })} area rows={6} />
          {hint}
          <MediaList label={t("pr.media")} items={s.media ? [s.media] : []} max={1} onChange={(m) => onChange({ media: m[0] })} proposalId={proposalId} onToast={onToast} />
        </>
      );
    case "case":
    case "gallery":
      return (
        <>
          <div className="grid2">
            <Text label="Index" value={s.index} onChange={(v) => onChange({ index: v })} />
            <Text label="Meta" value={s.meta} onChange={(v) => onChange({ meta: v })} />
          </div>
          <Text label="Title" value={s.title} onChange={(v) => onChange({ title: v })} />
          {s.type === "case" && (
            <>
              <Text label="Overview" value={s.overview} onChange={(v) => onChange({ overview: v } as Partial<Slide>)} area rows={5} />
              <Text label="Credits" value={s.credits} onChange={(v) => onChange({ credits: v } as Partial<Slide>)} area />
              {hint}
            </>
          )}
          <MediaList label={t("pr.media")} items={s.media} max={s.type === "case" ? 3 : 4} onChange={(m) => onChange({ media: m })} proposalId={proposalId} onToast={onToast} />
        </>
      );
    case "list":
      return (
        <>
          <div className="grid2">
            <Text label="Index" value={s.index} onChange={(v) => onChange({ index: v })} />
            <label className="field">
              <span>Tone</span>
              <Select className="select" value={s.tone} onChange={(e) => onChange({ tone: e.target.value as "dark" | "light" })}>
                <option value="dark">dark</option>
                <option value="light">light</option>
              </Select>
            </label>
          </div>
          <Text label="Title" value={s.title} onChange={(v) => onChange({ title: v })} />
          <ArrayEditor<Row>
            items={s.rows}
            make={() => ({ n: String(s.rows.length + 1), name: "", text: "" })}
            onChange={(rows) => onChange({ rows })}
            render={(r, set) => (
              <>
                <div className="grid2" style={{ gridTemplateColumns: "70px 1fr" }}>
                  <Text label="N" value={r.n} onChange={(v) => set({ ...r, n: v })} />
                  <Text label="Name" value={r.name} onChange={(v) => set({ ...r, name: v })} />
                </div>
                <Text label="Text" value={r.text} onChange={(v) => set({ ...r, text: v })} area />
              </>
            )}
          />
          {hint}
        </>
      );
    case "cycle":
      return (
        <>
          <Text label="Index" value={s.index} onChange={(v) => onChange({ index: v })} />
          <Text label="Title" value={s.title} onChange={(v) => onChange({ title: v })} area rows={2} />
          <ArrayEditor<CycleStep>
            items={s.steps}
            max={6}
            make={() => ({ days: "", name: "", text: "" })}
            onChange={(steps) => onChange({ steps })}
            render={(st, set) => (
              <>
                <div className="grid2">
                  <Text label="Days" value={st.days} onChange={(v) => set({ ...st, days: v })} />
                  <Text label="Name" value={st.name} onChange={(v) => set({ ...st, name: v })} />
                </div>
                <Text label="Text" value={st.text} onChange={(v) => set({ ...st, text: v })} area />
                <label className="row small" style={{ gap: 8 }}>
                  <input type="checkbox" checked={!!st.highlight} onChange={(e) => set({ ...st, highlight: e.target.checked })} /> highlight
                </label>
              </>
            )}
          />
          <Text label="Note" value={s.note} onChange={(v) => onChange({ note: v })} area />
        </>
      );
    case "packages":
      return (
        <>
          <div className="grid2">
            <Text label="Index" value={s.index} onChange={(v) => onChange({ index: v })} />
            <Text label="Title" value={s.title} onChange={(v) => onChange({ title: v })} />
          </div>
          <ArrayEditor<Package>
            items={s.packages}
            max={3}
            make={() => ({ name: "", price: "€ 0,00 EUR", description: "", items: [] })}
            onChange={(packages) => onChange({ packages })}
            render={(pk, set) => (
              <>
                <div className="grid2">
                  <Text label="Name" value={pk.name} onChange={(v) => set({ ...pk, name: v })} />
                  <Text label="Price" value={pk.price} onChange={(v) => set({ ...pk, price: v })} />
                </div>
                <Text label="Description" value={pk.description} onChange={(v) => set({ ...pk, description: v })} area />
                <Text label="Included (one per line)" value={pk.items.join("\n")} onChange={(v) => set({ ...pk, items: v.split("\n") })} area rows={5} />
                <label className="row small" style={{ gap: 8 }}>
                  <input type="checkbox" checked={!!pk.recommended} onChange={(e) => set({ ...pk, recommended: e.target.checked })} /> Recommended
                </label>
              </>
            )}
          />
          <Text label="Note" value={s.note} onChange={(v) => onChange({ note: v })} area rows={2} />
          <MediaList label={t("pr.media")} items={s.media ? [s.media] : []} max={1} onChange={(m) => onChange({ media: m[0] })} proposalId={proposalId} onToast={onToast} />
        </>
      );
    case "closing":
      return (
        <>
          <Text label="Text" value={s.text} onChange={(v) => onChange({ text: v })} area rows={10} />
          <Text label="Mark" value={s.mark} onChange={(v) => onChange({ mark: v })} />
          {hint}
        </>
      );
  }
}

function ArrayEditor<T>({ items, make, onChange, render, max = 8 }: { items: T[]; make: () => T; onChange: (v: T[]) => void; render: (it: T, set: (v: T) => void) => React.ReactNode; max?: number }) {
  return (
    <div className="stack">
      {items.map((it, i) => (
        <div key={i} className="pr-item">
          <div className="row between">
            <span className="label muted">{pad(i + 1)}</span>
            <span className="row" style={{ gap: 4 }}>
              <button className="btn ghost small" disabled={i === 0} onClick={() => onChange(items.map((x, k) => (k === i - 1 ? items[i] : k === i ? items[i - 1] : x)))}>
                <Icon name="upload" size={14} />
              </button>
              <button className="btn ghost small" onClick={() => onChange(items.filter((_, k) => k !== i))}>
                <Icon name="close" size={14} />
              </button>
            </span>
          </div>
          {render(it, (v) => onChange(items.map((x, k) => (k === i ? v : x))))}
        </div>
      ))}
      {items.length < max && (
        <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...items, make()])}>
          +
        </button>
      )}
    </div>
  );
}

function MediaList({ label, items, max, onChange, proposalId, onToast }: { label: string; items: Media[]; max: number; onChange: (m: Media[]) => void; proposalId: string; onToast: (m: string) => void }) {
  const { t } = useT();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const full = items.length >= max;
  return (
    <div className="stack">
      <span className="label muted">
        {label} · {items.length}/{max}
      </span>
      {items.map((m, i) => (
        <div key={i} className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
          <span className="chip">{m.kind === "video" ? "▶" : "▣"}</span>
          <input className="input" value={m.caption ?? m.src} onChange={(e) => onChange(items.map((x, k) => (k === i ? { ...x, caption: e.target.value } : x)))} aria-label="caption" />
          <button className="btn ghost small" onClick={() => onChange(items.filter((_, k) => k !== i))}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      {!full && (
        <>
          <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
            <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder={t("pr.linkPh")} />
            <button
              className="btn small"
              disabled={!/^https?:\/\//.test(link.trim())}
              onClick={() => {
                const src = link.trim();
                const video = /youtu|vimeo|frame\.io|\.(mp4|webm|mov)(\?|$)/i.test(src);
                onChange([...items, { src, kind: video ? "video" : "image" }]);
                setLink("");
              }}
            >
              + {t("pr.addLink")}
            </button>
          </div>
          <DropZone
            target="gallery"
            existing={items.length}
            busy={busy}
            disabled={busy}
            compact
            onFiles={async (files) => {
              setBusy(true);
              try {
                onChange([...items, ...(await Promise.all(files.map((f) => uploadMedia(f, proposalId))))]);
              } catch (err) {
                onToast((err as Error).message);
              }
              setBusy(false);
            }}
          />
          {isLocalMode && <span className="muted small">{t("pr.localMedia")}</span>}
        </>
      )}
    </div>
  );
}

function DealFields({ p, update }: { p: Proposal; update: (fn: (x: Proposal) => Proposal) => void }) {
  const { t } = useT();
  const setClient = (k: keyof Proposal["client"], v: string) => update((x) => ({ ...x, client: { ...x.client, [k]: v } }));
  return (
    <>
      <Text label={t("pr.client.company")} value={p.client.company} onChange={(v) => setClient("company", v)} />
      <div className="grid2">
        <Text label={t("pr.client.name")} value={p.client.name} onChange={(v) => setClient("name", v)} />
        <Text label={t("pr.client.email")} value={p.client.email} onChange={(v) => setClient("email", v)} />
      </div>
      <div className="grid2">
        <label className="field">
          <span>{t("pr.value")}</span>
          <input className="input" inputMode="decimal" defaultValue={p.value || ""} onChange={(e) => update((x) => ({ ...x, value: Number(e.target.value.replace(",", ".")) || 0 }))} />
        </label>
        <label className="field">
          <span>{t("fin.currency")}</span>
          <Select className="select" value={p.currency} onChange={(e) => update((x) => ({ ...x, currency: e.target.value as Proposal["currency"] }))}>
            <option>EUR</option>
            <option>GBP</option>
          </Select>
        </label>
      </div>
      <label className="field">
        <span>{t("pr.col.stage")}</span>
        <Select className="select" value={p.stage} onChange={(e) => update((x) => ({ ...x, stage: e.target.value as Proposal["stage"] }))}>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {t(`pr.stage.${s}`)}
            </option>
          ))}
        </Select>
      </label>
      <div className="grid2">
        <label className="field">
          <span>{t("pr.col.sent")}</span>
          <input className="input" type="date" value={p.sent_at} onChange={(e) => update((x) => ({ ...x, sent_at: e.target.value }))} />
        </label>
        <label className="field">
          <span>{t("pr.col.valid")}</span>
          <input className="input" type="date" value={p.valid_until} onChange={(e) => update((x) => ({ ...x, valid_until: e.target.value }))} />
        </label>
      </div>
      <Text label={t("pr.notes")} value={p.notes} onChange={(v) => update((x) => ({ ...x, notes: v }))} area rows={4} />
    </>
  );
}

function DesignFields({ p, update }: { p: Proposal; update: (fn: (x: Proposal) => Proposal) => void }) {
  const { t } = useT();
  const setMeta = (k: keyof Proposal["doc"]["meta"], v: string) => update((x) => ({ ...x, doc: { ...x.doc, meta: { ...x.doc.meta, [k]: v } } }));
  const setTheme = (k: keyof ProposalTheme, v: string) => update((x) => ({ ...x, doc: { ...x.doc, theme: { ...x.doc.theme, [k]: v } } }));
  return (
    <>
      <div className="grid2">
        {(["brand", "line2", "year", "fao"] as const).map((k) => (
          <Text key={k} label={t(`pr.meta.${k}`)} value={p.doc.meta[k]} onChange={(v) => setMeta(k, v)} />
        ))}
      </div>
      <div className="colorgrid">
        {(["orange", "dark", "cream", "paper", "ink", "gray"] as (keyof ProposalTheme)[]).map((k) => (
          <label key={k} className="colorin">
            <input type="color" value={p.doc.theme[k]} onChange={(e) => setTheme(k, e.target.value.toUpperCase())} />
            <span>
              {t(`pr.theme.${k}`)}
              <em className="mono">{p.doc.theme[k]}</em>
            </span>
          </label>
        ))}
      </div>
    </>
  );
}

function JsonTab({ p, onApply, onToast }: { p: Proposal; onApply: (patch: Partial<Proposal>) => void; onToast: (m: string) => void }) {
  const { t } = useT();
  const json = () => {
    const { created_at: _c, updated_at: _u, ...rest } = p;
    return JSON.stringify(rest, null, 2);
  };
  const [text, setText] = useState(json);
  const [err, setErr] = useState("");
  return (
    <>
      <textarea
        className="textarea mono"
        rows={20}
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          setErr("");
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) setText(await f.text());
        }}
        style={{ fontSize: 11.5 }}
      />
      {err && <p className="tone-danger small">{err}</p>}
      <div className="row">
        <button
          className="btn accent"
          onClick={() => {
            const r = importProposalJson(text);
            if (r.errors.length) return setErr(r.errors.join(" · "));
            onApply(r.patch);
          }}
        >
          {t("pr.jsonApply")}
        </button>
        <button
          className="btn"
          onClick={() => {
            navigator.clipboard?.writeText(json());
            onToast(t("pr.shareCopied").replace("Link", "JSON"));
          }}
        >
          {t("pr.jsonCopy")}
        </button>
        <button className="btn ghost" onClick={() => download(`${p.title.replace(/[^\w-]+/g, "_")}.json`, json(), "application/json")}>
          <Icon name="download" size={14} /> {t("pr.jsonDownload")}
        </button>
      </div>
    </>
  );
}

function SharePanel({ proposal, onToast }: { proposal: Proposal; onToast: (m: string) => void }) {
  const { t, locale } = useT();
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ url: string; expiresAt: string } | null>(null);
  if (!supabaseEnabled)
    return (
      <div className="note" style={{ marginBottom: 14 }}>
        {t("pr.shareNeedsSupabase")}
      </div>
    );
  async function create() {
    setBusy(true);
    try {
      const r = await fetch("/api/proposals/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalId: proposal.id, days }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `http_${r.status}`);
      setRes(j);
    } catch (e) {
      onToast((e as Error).message);
    }
    setBusy(false);
  }
  return (
    <div className="w stack" style={{ marginBottom: 14 }}>
      <div className="row">
        <span className="label">{t("pr.shareDays")}</span>
        <div className="seg" role="group">
          {[1, 3, 7, 14, 30].map((d) => (
            <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>
              {t("pr.days", { n: d })}
            </button>
          ))}
        </div>
        <button className="btn accent" onClick={create} disabled={busy}>
          {t("pr.shareCreate")}
        </button>
      </div>
      <span className="muted small">{t("pr.shareNote")}</span>
      {res && (
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input className="input mono" readOnly value={res.url} onFocus={(e) => e.target.select()} />
          <button
            className="btn"
            onClick={() => {
              navigator.clipboard?.writeText(res.url);
              onToast(t("pr.shareCopied"));
            }}
          >
            {t("pr.shareCopy")}
          </button>
          <span className="muted small" style={{ whiteSpace: "nowrap" }}>
            {t("pr.shareExpires", { date: new Date(res.expiresAt).toLocaleDateString(locale) })}
          </span>
        </div>
      )}
    </div>
  );
}
