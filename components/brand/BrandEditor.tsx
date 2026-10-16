"use client";

// Identidade visual por passos (essência → logótipo → cores → tipografia → persona → voz → imagens → rever),
// com a apresentação ao lado a preencher-se em tempo real e "Gerar PDF" (mesmo modelo de impressão das propostas).
// Usado no portal (cliente) e na ficha do cliente (estúdio).
import { DropZone } from "@/components/DropZone";
import { Icon } from "@/components/Icon";
import { useEffect, useMemo, useState } from "react";
import { SlideFrame } from "@/components/proposal/Slide";
import { BRAND_STEPS, FONT_CATALOG, brandProgress, googleFontsUrl, normalizeBrand, type BrandColor, type BrandFont, type BrandIdentity, type BrandStep } from "@/lib/brand";
import { useT, type Key } from "@/lib/i18n";
import { BRAND_SLIDES, BrandSlide, STEP_SLIDES, useBrandFonts } from "./BrandSlides";

export const BRANDBOOK_PRINT_KEY = "xmedia:brandbook:print";

/** Imagem → data URL reduzida (o portal do cliente não escreve no Storage diretamente). */
async function shrink(file: File, max = 1400): Promise<string> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * s), height: Math.round(img.height * s) });
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return file.type === "image/png" || file.type === "image/svg+xml" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.82);
}

export function openBrandPdf(b: BrandIdentity) {
  try {
    localStorage.setItem(BRANDBOOK_PRINT_KEY, JSON.stringify(b));
  } catch {}
  window.open("/brandbook/print", "_blank");
}

export function BrandEditor({ value, name, readOnly, onSave, initialStep, onView }: { value?: BrandIdentity; name: string; readOnly?: boolean; onSave: (b: BrandIdentity) => Promise<unknown>; initialStep?: BrandStep; onView?: () => void }) {
  const { t } = useT();
  const [b, setB] = useState<BrandIdentity>(() => normalizeBrand(value, name));
  const [step, setStep] = useState<BrandStep>(initialStep ?? "essence");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  useBrandFonts(b);
  useEffect(() => {
    if (!dirty) setB(normalizeBrand(value, name));
  }, [value, name]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<BrandIdentity>) => {
    setB((x) => ({ ...x, ...p }));
    setDirty(true);
  };
  const prog = brandProgress(b);
  const idx = BRAND_STEPS.indexOf(step);
  const slides = STEP_SLIDES[step];

  async function save() {
    setBusy(true);
    try {
      await onSave(b);
      setDirty(false);
      setMsg(t("br.saved"));
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="be">
      <section className="w be-form">
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <span className="tile-t">{t("br.title")}</span>
            <p className="muted small" style={{ margin: "6px 0 0" }}>
              {t("br.sub")}
            </p>
          </div>
          <span className="row" style={{ gap: 8 }}>
            <span className="mono small">{t("br.progress", { n: prog.total })}</span>
            {onView && (
              <button className="btn small" onClick={onView} data-testid="br-view">
                <Icon name="images" size={14} /> {t("bv.view")}
              </button>
            )}
          </span>
        </div>
        <ol className="be-steps" aria-label={t("br.title")}>
          {BRAND_STEPS.map((s, i) => {
            const p = s === "review" ? prog.total / 100 : prog.parts[s];
            return (
              <li key={s}>
                <button className={`${step === s ? "now" : ""} ${p >= 1 ? "done" : ""}`} onClick={() => setStep(s)} data-testid={`br-step-${s}`}>
                  <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  <span>{t(`br.step.${s}` as Key)}</span>
                  <i style={{ width: `${Math.round(p * 100)}%` }} />
                </button>
              </li>
            );
          })}
        </ol>
        {readOnly && <p className="note small">{t("br.readOnly")}</p>}
        <fieldset className="be-fields" disabled={readOnly}>
          {step === "essence" && (
            <>
              <Field label={t("br.name")}>
                <input className="input big" value={b.name} onChange={(e) => set({ name: e.target.value })} data-testid="br-name" />
              </Field>
              <Field label={t("br.tagline")}>
                <input className="input" value={b.tagline} onChange={(e) => set({ tagline: e.target.value })} />
              </Field>
              <Field label={t("br.about")}>
                <textarea className="textarea" rows={4} value={b.about} onChange={(e) => set({ about: e.target.value })} />
              </Field>
              <Field label={t("br.keywords")}>
                <Chips values={b.keywords} onChange={(keywords) => set({ keywords })} />
              </Field>
            </>
          )}
          {step === "logo" && (
            <>
              <div className="grid4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <ImagePick label={t("br.logoPrimary")} value={b.logo.primary} onChange={(primary) => set({ logo: { ...b.logo, primary } })} />
                <ImagePick label={t("br.logoMark")} value={b.logo.mark} onChange={(mark) => set({ logo: { ...b.logo, mark } })} />
              </div>
              <Field label={t("br.logoNotes")}>
                <textarea className="textarea" rows={4} value={b.logo.notes} onChange={(e) => set({ logo: { ...b.logo, notes: e.target.value } })} />
              </Field>
            </>
          )}
          {step === "colors" && (
            <>
              {(["primary", "secondary", "neutral"] as const).map((role) => (
                <div key={role} className="stack" style={{ gap: 8 }}>
                  <span className="tile-t muted">{t(`br.color.${role}` as Key)}</span>
                  <div className="be-colors">
                    {b.colors.map((c, i) =>
                      c.role !== role ? null : (
                        <div key={i} className="be-color">
                          <input type="color" value={c.hex} onChange={(e) => set({ colors: b.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)) })} aria-label={c.name} />
                          <input className="input small" value={c.name} onChange={(e) => set({ colors: b.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                          <span className="mono small muted">{c.hex.toUpperCase()}</span>
                          <button className="btn ghost small" onClick={() => set({ colors: b.colors.filter((_, j) => j !== i) })} aria-label="remove">
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                      )
                    )}
                    {b.colors.length < 12 && (
                      <button className="btn small" onClick={() => set({ colors: [...b.colors, { name: t(`br.color.${role}` as Key), hex: role === "neutral" ? "#cccccc" : "#ff5a1f", role } as BrandColor] })}>
                        {t("br.addColor")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          {step === "type" && (
            <>
              <FontPick label={t("br.fontPrimary")} value={b.fonts.primary} onChange={(primary) => set({ fonts: { ...b.fonts, primary } })} />
              <FontPick label={t("br.fontSecondary")} value={b.fonts.secondary} onChange={(secondary) => set({ fonts: { ...b.fonts, secondary } })} />
            </>
          )}
          {step === "persona" && (
            <div className="grid4" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {(["name", "age", "role", "channels", "goals", "pains", "quote"] as const).map((k) => (
                <Field key={k} label={t(`br.p.${k}` as Key)} wide={k === "goals" || k === "pains" || k === "quote"}>
                  {k === "goals" || k === "pains" || k === "quote" ? (
                    <textarea className="textarea" rows={2} value={b.persona[k]} onChange={(e) => set({ persona: { ...b.persona, [k]: e.target.value } })} />
                  ) : (
                    <input className="input" value={b.persona[k]} onChange={(e) => set({ persona: { ...b.persona, [k]: e.target.value } })} />
                  )}
                </Field>
              ))}
            </div>
          )}
          {step === "voice" && (
            <>
              {b.voice.map((p, i) => (
                <div key={i} className="grid4" style={{ gridTemplateColumns: "1fr 2fr" }}>
                  <Field label={`${t("br.pillar")} ${i + 1}`}>
                    <input className="input big" value={p.title} onChange={(e) => set({ voice: b.voice.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                  </Field>
                  <Field label={t("br.details")}>
                    <textarea className="textarea small" rows={3} value={p.details.join("\n")} onChange={(e) => set({ voice: b.voice.map((x, j) => (j === i ? { ...x, details: e.target.value.split("\n") } : x)) })} />
                  </Field>
                </div>
              ))}
              <div className="grid4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Field label={t("br.dos")}>
                  <textarea className="textarea small" rows={4} value={b.dos.join("\n")} onChange={(e) => set({ dos: e.target.value.split("\n") })} />
                </Field>
                <Field label={t("br.donts")}>
                  <textarea className="textarea small" rows={4} value={b.donts.join("\n")} onChange={(e) => set({ donts: e.target.value.split("\n") })} />
                </Field>
              </div>
            </>
          )}
          {step === "imagery" && (
            <>
              <Field label={t("br.imgNotes")}>
                <textarea className="textarea" rows={3} value={b.imagery.notes} onChange={(e) => set({ imagery: { ...b.imagery, notes: e.target.value } })} />
              </Field>
              <div className="be-imgs">
                {b.imagery.images.map((src, i) => (
                  <ImagePick key={i} label={`#${i + 1}`} value={src} onChange={(v) => set({ imagery: { ...b.imagery, images: v ? b.imagery.images.map((x, j) => (j === i ? v : x)) : b.imagery.images.filter((_, j) => j !== i) } })} />
                ))}
                {b.imagery.images.length < 6 && <ImagePick label={t("br.addImage")} value="" onChange={(v) => v && set({ imagery: { ...b.imagery, images: [...b.imagery.images, v] } })} />}
              </div>
            </>
          )}
          {step === "review" && (
            <div className="stack">
              {(Object.entries(prog.parts) as [Exclude<BrandStep, "review">, number][]).map(([k, v]) => (
                <button key={k} className="statrow" style={{ background: "none", border: 0, color: "inherit", width: "100%", textAlign: "left" }} onClick={() => setStep(k)}>
                  <span style={{ flex: 1 }}>{t(`br.step.${k}` as Key)}</span>
                  <span className="meter" style={{ width: 140 }}>
                    <i style={{ width: `${Math.round(v * 100)}%` }} />
                  </span>
                  <span className="mono small" style={{ width: 44, textAlign: "right" }}>
                    {Math.round(v * 100)}%
                  </span>
                </button>
              ))}
              <p className="muted small">{t("br.pdfHint")}</p>
            </div>
          )}
        </fieldset>
        <div className="row between be-actions">
          <button className="btn ghost" onClick={() => setStep(BRAND_STEPS[Math.max(0, idx - 1)])} disabled={idx === 0}>
            <Icon name="back" size={14} /> {t("br.prev")}
          </button>
          <span className="row" style={{ gap: 8 }}>
            {msg && <span className="small tone-ok">{msg}</span>}
            {!readOnly && (
              <button className="btn" onClick={save} disabled={busy || !dirty} data-testid="br-save">
                {t("br.save")}
              </button>
            )}
            {step === "review" ? (
              <button className="btn accent" onClick={() => openBrandPdf(b)} data-testid="br-pdf">
                <Icon name="download" size={14} /> {t("br.pdf")}
              </button>
            ) : (
              <button
                className="btn accent"
                onClick={async () => {
                  if (dirty && !readOnly) await save();
                  setStep(BRAND_STEPS[idx + 1]);
                }}
                data-testid="br-next"
              >
                {t("br.next")} <Icon name="next" size={14} />
              </button>
            )}
          </span>
        </div>
      </section>

      <section className="be-preview" aria-label="preview">
        {slides.map((k) => (
          <div key={k} className="be-slide">
            <SlideFrame>
              <BrandSlide k={k} b={b} />
            </SlideFrame>
          </div>
        ))}
      </section>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className="field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Chips({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [v, setV] = useState("");
  const add = () => {
    const x = v.trim();
    if (x && !values.includes(x) && values.length < 10) onChange([...values, x]);
    setV("");
  };
  return (
    <div className="be-chips">
      {values.map((x) => (
        <button key={x} className="chip" onClick={() => onChange(values.filter((y) => y !== x))}>
          {x} <Icon name="close" size={14} />
        </button>
      ))}
      <input className="input" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} onBlur={add} placeholder="+" style={{ width: 160 }} />
    </div>
  );
}

function ImagePick({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  return (
    <div className="be-img">
      <span className="tile-t muted">{label}</span>
      <DropZone target="cover" onFiles={async ([f]) => onChange(await shrink(f))} noPick>
        <label className="be-drop">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" />
          ) : (
            <span className="muted small">+ {t("br.upload")}</span>
          )}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) onChange(await shrink(f));
              e.target.value = "";
            }}
          />
        </label>
      </DropZone>
      {value && (
        <button className="btn ghost small" onClick={() => onChange("")}>
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

function FontPick({ label, value, onChange }: { label: string; value: BrandFont; onChange: (f: BrandFont) => void }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const list = useMemo(() => FONT_CATALOG.filter((f) => (cat === "all" || f.cat === cat) && f.family.toLowerCase().includes(q.toLowerCase())), [q, cat]);
  // carrega as fontes visíveis para a amostra
  useEffect(() => {
    const href = googleFontsUrl(list.slice(0, 40).map((f) => f.family));
    if (!href || document.querySelector(`link[data-fontpick="${href}"]`)) return;
    const l = Object.assign(document.createElement("link"), { rel: "stylesheet", href });
    l.dataset.fontpick = href;
    document.head.appendChild(l);
  }, [list]);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row between">
        <span className="tile-t">{label}</span>
        <span className="mono small">{value.family}</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("br.fontSearch")} style={{ maxWidth: 220 }} />
        {["all", "sans", "serif", "display", "mono", "script"].map((c) => (
          <button key={c} className={`cb-chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="be-fonts">
        {list.map((f) => (
          <button key={f.family} className={`be-font ${value.family === f.family ? "on" : ""}`} onClick={() => onChange({ ...value, family: f.family })} style={{ fontFamily: `'${f.family}', sans-serif` }} data-testid={`font-${f.family}`}>
            <span className="be-font-aa">Aa</span>
            <span className="be-font-name">{f.family}</span>
          </button>
        ))}
        {q && !list.length && (
          <button className="be-font" onClick={() => onChange({ ...value, family: q.trim() })}>
            <span className="be-font-aa">Aa</span>
            <span className="be-font-name">“{q.trim()}”</span>
          </button>
        )}
      </div>
      <div className="grid4" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <label className="field">
          <span>{t("br.usage")}</span>
          <input className="input" value={value.usage} onChange={(e) => onChange({ ...value, usage: e.target.value })} />
        </label>
        <div className="field">
          <span>{t("br.weights")}</span>
          <div className="row" style={{ gap: 4 }}>
            {[300, 400, 500, 700, 900].map((w) => (
              <button key={w} className={`cb-chip ${value.weights.includes(w) ? "on" : ""}`} onClick={() => onChange({ ...value, weights: value.weights.includes(w) ? value.weights.filter((x) => x !== w) : [...value.weights, w].sort() })}>
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Vista da identidade visual (o "template" completo): progresso por secção, todos os slides como no PDF,
 * "Editar" (abre o preenchimento por passos) e "Gerar PDF".
 */
export function BrandBookView({ value, name, canEdit, onEdit }: { value?: BrandIdentity; name: string; canEdit: boolean; onEdit: (step?: BrandStep) => void }) {
  const { t } = useT();
  const b = useMemo(() => normalizeBrand(value, name), [value, name]);
  useBrandFonts(b);
  const prog = brandProgress(b);
  const stepOf: Partial<Record<string, BrandStep>> = { cover: "essence", essence: "essence", logo: "logo", palette: "colors", stripes: "colors", type: "type", persona: "persona", voice: "voice", imagery: "imagery" };
  return (
    <div className="stack" style={{ gap: "var(--gap)" }}>
      <section className="widgets" style={{ padding: 0 }}>
        <div className="w tile span-4 sand">
          <span className="tile-t">{t("hm2.brand")}</span>
          <div className="meter" aria-hidden>
            <i style={{ width: `${prog.total}%` }} />
          </div>
          <div className="tile-foot">
            <span className="tile-num">{prog.total}%</span>
            <span className="tile-of">{t("hm2.brandSub")}</span>
          </div>
        </div>
        <div className="w span-8 stack bv-parts">
          <div className="bv-grid">
            {(Object.entries(prog.parts) as [Exclude<BrandStep, "review">, number][]).map(([k, v]) => (
              <button key={k} className="bv-part" onClick={() => canEdit && onEdit(k)} disabled={!canEdit}>
                <span className="small">{t(`br.step.${k}` as Key)}</span>
                <span className="meter">
                  <i style={{ width: `${Math.round(v * 100)}%` }} />
                </span>
                <span className="mono small muted">{Math.round(v * 100)}%</span>
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            {canEdit && (
              <button className="btn" onClick={() => onEdit()} data-testid="bv-edit">
                <Icon name="edit" size={14} /> {t("bv.edit")}
              </button>
            )}
            <button className="btn accent" onClick={() => openBrandPdf(b)} data-testid="bv-pdf">
              <Icon name="download" size={14} /> {t("br.pdf")}
            </button>
            <span className="muted small">{t("br.pdfHint")}</span>
          </div>
        </div>
      </section>
      <section className="bv-slides" aria-label={t("br.title")}>
        {BRAND_SLIDES.map((k) => (
          <button key={k} className="bv-slide" onClick={() => canEdit && stepOf[k] && onEdit(stepOf[k])} title={canEdit ? t("bv.edit") : undefined}>
            <SlideFrame>
              <BrandSlide k={k} b={b} />
            </SlideFrame>
          </button>
        ))}
      </section>
    </div>
  );
}
