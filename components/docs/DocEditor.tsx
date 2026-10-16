"use client";

// Preparar um documento para assinatura (estilo BoldSign): destinatários em cima (nome, email, papel, língua,
// ordem, CC), paleta de campos à esquerda (arrastar para a página ou clicar), o PDF ao centro com os campos
// (mover, redimensionar, apagar) e as miniaturas à direita com quantos campos cada página tem.
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Select } from "@/components/Select";
import { FIELD_TYPES, STATIC_FIELDS, clamp, colorOf, newField, newRecipient, sendProblems, type Doc, type DocField, type FieldType, type Recipient } from "@/lib/documents";
import { docApi, docLocal, type SendLink } from "@/lib/docApi";
import type { Customer } from "@/lib/customer";
import { LANGS, useT, type Key } from "@/lib/i18n";
import { PdfThumbs, PdfView } from "./PdfView";

const ICONS: Record<FieldType, IconName> = {
  signature: "edit", initials: "edit", name: "user", email: "mail", company: "briefcase", title: "tag", date_signed: "calendar", date: "calendar",
  textbox: "page", checkbox: "check", radio: "target", image: "image", drawing: "palette", label: "page", hyperlink: "link",
};

export function DocEditor({ doc: initial, customer, me, onSaved, onBack }: { doc: Doc; customer: Customer | null; me: { name: string; email: string }; onSaved: (d: Doc) => void; onBack: () => void }) {
  const { t } = useT();
  const [d, setD] = useState<Doc>(initial);
  const [rid, setRid] = useState(initial.recipients[0]?.id ?? "");
  const [sel, setSel] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [links, setLinks] = useState<SendLink[] | null>(null);
  const pages = useRef<Record<number, HTMLDivElement | null>>({});
  const drag = useRef<{ id: string; mode: "move" | "size"; x0: number; y0: number; f: DocField; rect: DOMRect } | null>(null);
  const dirty = useRef(false);

  const set = (p: Partial<Doc>) => {
    dirty.current = true;
    setD((x) => ({ ...x, ...p }));
  };
  const setField = (id: string, p: Partial<DocField>) => set({ fields: d.fields.map((f) => (f.id === id ? { ...f, ...p } : f)) });
  const setRec = (id: string, p: Partial<Recipient>) => set({ recipients: d.recipients.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const field = d.fields.find((f) => f.id === sel) ?? null;
  const counts = useMemo(() => {
    const n: number[] = [];
    for (const f of d.fields) n[f.page] = (n[f.page] ?? 0) + 1;
    return n;
  }, [d.fields]);
  const problems = sendProblems(d);
  const src = docLocal ? d.file.path : docApi.fileUrl(d);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (sel && (e.key === "Delete" || e.key === "Backspace") && !(el && /INPUT|TEXTAREA/.test(el.tagName))) {
        set({ fields: d.fields.filter((f) => f.id !== sel) });
        setSel(null);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  function addRecipient(p: Partial<Recipient> = {}) {
    const r = newRecipient({ order: d.recipients.length + 1, lang: (customer?.lang as Recipient["lang"]) ?? "en", ...p });
    set({ recipients: [...d.recipients, r] });
    setRid(r.id);
  }
  function addField(type: FieldType, pg: number, x: number, y: number) {
    const f = newField(type, pg, x, y, rid || d.recipients[0]?.id || "");
    if (type === "label") f.value = t("df.t.label");
    if (type === "hyperlink") f.value = "https://";
    if (type === "radio") f.label = "A|B";
    set({ fields: [...d.fields, f] });
    setSel(f.id);
  }
  async function save(silent = false) {
    setBusy(true);
    try {
      const saved = await docApi.save({ ...d, kind: d.recipients.length || d.fields.length ? "signature" : d.kind });
      setD(saved);
      dirty.current = false;
      onSaved(saved);
      if (!silent) setMsg(t("de.saved"));
      return saved;
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    const saved = await save(true);
    if (!saved) return;
    setBusy(true);
    try {
      setLinks(await docApi.send(saved));
      const fresh = (await docApi.list(saved.customer_id)).find((x) => x.doc.id === saved.id)?.doc;
      if (fresh) (setD(fresh), onSaved(fresh));
    } catch (e) {
      setMsg(t(`de.err.${(e as Error).message.split(":")[0]}` as Key) || (e as Error).message);
    }
    setBusy(false);
  }
  async function saveTemplate() {
    const copy: Doc = { ...d, id: crypto.randomUUID(), template: true, customer_id: "", status: "draft", recipients: d.recipients.map((r) => ({ ...r, email: "", status: "pending", token_hash: undefined, sent_at: undefined, viewed_at: undefined, signed_at: undefined })), audit: [], title: `${d.title} · ${t("dd.template")}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    await docApi.save(copy);
    setMsg(t("de.templateSaved"));
  }

  // mover / redimensionar campos (rato e toque)
  const onDown = (e: React.PointerEvent, f: DocField, mode: "move" | "size") => {
    e.stopPropagation();
    setSel(f.id);
    const rect = (e.currentTarget.closest(".pdf-page") as HTMLElement).getBoundingClientRect();
    drag.current = { id: f.id, mode, x0: e.clientX, y0: e.clientY, f, rect };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const dx = (e.clientX - g.x0) / g.rect.width;
    const dy = (e.clientY - g.y0) / g.rect.height;
    if (g.mode === "move") setField(g.id, { x: clamp(g.f.x + dx, 0, 1 - g.f.w), y: clamp(g.f.y + dy, 0, 1 - g.f.h) });
    else setField(g.id, { w: clamp(g.f.w + dx, 0.02, 1 - g.f.x), h: clamp(g.f.h + dy, 0.012, 1 - g.f.y) });
  };
  const onUp = () => (drag.current = null);

  const recName = (id: string) => d.recipients.find((r) => r.id === id)?.name || t("de.sender");
  const locked = d.status !== "draft";

  return (
    <div className="de">
      {/* barra superior */}
      <header className="de-top">
        <button className="btn ghost small" onClick={onBack}>
          <Icon name="back" size={14} /> {t("dd.title")}
        </button>
        <input className="input de-title" value={d.title} onChange={(e) => set({ title: e.target.value })} aria-label={t("dd.docTitle")} />
        <span className="row" style={{ gap: 6 }}>
          {!locked && (
            <button className="btn small ghost" onClick={saveTemplate}>
              <Icon name="copy" size={13} /> {t("de.asTemplate")}
            </button>
          )}
          <button className="btn small" onClick={() => save()} disabled={busy}>
            <Icon name="check" size={13} /> {t("save")}
          </button>
          {!locked && (
            <button className="btn small accent" onClick={send} disabled={busy || problems.length > 0} title={problems.map((p) => t(`de.err.${p.split(":")[0]}` as Key)).join(" · ")} data-testid="de-send">
              <Icon name="send" size={13} /> {t("de.send")}
            </button>
          )}
        </span>
      </header>
      {msg && <p className="small accent" style={{ margin: 0 }}>{msg}</p>}
      {locked && <p className="note small">{t("de.locked")}</p>}

      {/* destinatários */}
      <section className="de-rec">
        <div className="row between">
          <span className="tile-t">{t("de.recipients")}</span>
          <span className="row" style={{ gap: 10 }}>
            {!locked && (
              <>
                <button className="lnk small" onClick={() => addRecipient({ name: me.name, email: me.email })}>
                  {t("de.addMe")}
                </button>
                {customer && (
                  <button className="lnk small" onClick={() => addRecipient({ name: customer.contact || customer.name, email: customer.billing?.email || customer.email, company: customer.billing?.company || customer.name })}>
                    {t("de.addClient")}
                  </button>
                )}
              </>
            )}
            <label className="row small" style={{ gap: 6 }}>
              <input type="checkbox" checked={d.signing_order} onChange={(e) => set({ signing_order: e.target.checked })} disabled={locked} /> {t("de.order")}
            </label>
          </span>
        </div>
        {d.recipients.map((r, i) => (
          <div key={r.id} className={`de-r ${rid === r.id ? "on" : ""}`} onClick={() => setRid(r.id)} style={{ ["--rc" as string]: colorOf(d, r.id) }}>
            <span className="de-r-n mono">{d.signing_order ? r.order : i + 1}</span>
            <input className="input" value={r.name} onChange={(e) => setRec(r.id, { name: e.target.value })} placeholder={t("de.rName")} disabled={locked} />
            <input className="input" type="email" value={r.email} onChange={(e) => setRec(r.id, { email: e.target.value })} placeholder={t("de.rEmail")} disabled={locked} />
            <Select className="select" value={r.role} onChange={(e) => setRec(r.id, { role: e.target.value as Recipient["role"] })} aria-label={t("de.role")} disabled={locked}>
              {(["signer", "approver", "viewer"] as const).map((x) => (
                <option key={x} value={x}>
                  {t(`de.role.${x}` as Key)}
                </option>
              ))}
            </Select>
            <Select className="select" value={r.lang} onChange={(e) => setRec(r.id, { lang: e.target.value as Recipient["lang"] })} aria-label="lang" disabled={locked}>
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </Select>
            {d.signing_order && <input className="input mono" type="number" min={1} value={r.order} onChange={(e) => setRec(r.id, { order: Math.max(1, +e.target.value) })} style={{ width: 56 }} aria-label={t("de.order")} disabled={locked} />}
            <span className={`label s-${r.status}`}>{t(`de.rs.${r.status}` as Key)}</span>
            {!locked && (
              <button className="btn ghost small" onClick={() => set({ recipients: d.recipients.filter((x) => x.id !== r.id), fields: d.fields.filter((f) => f.recipient_id !== r.id) })} aria-label={t("ra.delete")}>
                <Icon name="close" size={14} />
              </button>
            )}
            {locked && r.status !== "signed" && r.role !== "viewer" && (
              <button className="btn small" onClick={async () => setLinks(await docApi.send(d, r.id))}>
                <Icon name="refresh" size={13} /> {t("ax.resend")}
              </button>
            )}
          </div>
        ))}
        {!locked && (
          <button className="de-add" onClick={() => addRecipient()} data-testid="de-add-rec">
            <Icon name="plus" size={14} /> {t("de.addRecipient")}
          </button>
        )}
        <div className="de-more">
          <label className="field">
            <span>CC</span>
            <input className="input" value={d.cc.join(", ")} onChange={(e) => set({ cc: e.target.value.split(/[,;\s]+/).filter(Boolean) })} placeholder={t("de.ccPh")} disabled={locked} />
          </label>
          <label className="field">
            <span>{t("de.message")}</span>
            <input className="input" value={d.message} onChange={(e) => set({ message: e.target.value })} placeholder={t("de.messagePh")} disabled={locked} />
          </label>
          <label className="field" style={{ maxWidth: 170 }}>
            <span>{t("de.expires")}</span>
            <input className="input" type="date" value={d.expires_at?.slice(0, 10) ?? ""} onChange={(e) => set({ expires_at: e.target.value ? `${e.target.value}T23:59:59.000Z` : undefined })} disabled={locked} />
          </label>
        </div>
      </section>

      <div className="de-body">
        {/* paleta de campos */}
        <aside className="de-pal">
          <span className="tile-t">{t("de.fields")}</span>
          <div className="de-for">
            <span className="muted small">{t("de.addingFor")}</span>
            <span className="de-who" style={{ ["--rc" as string]: colorOf(d, rid) }}>
              <i /> {recName(rid)}
            </span>
          </div>
          <div className="de-grid">
            {FIELD_TYPES.map((ty) => (
              <button
                key={ty}
                className="de-f"
                draggable={!locked}
                disabled={locked}
                onDragStart={(e) => e.dataTransfer.setData("text/x-field", ty)}
                onClick={() => addField(ty, page, 0.5, 0.45)}
                title={t(`df.h.${ty}` as Key)}
                data-testid={`de-f-${ty}`}
              >
                <Icon name={ICONS[ty]} size={18} />
                <span>{t(`df.t.${ty}` as Key)}</span>
                {STATIC_FIELDS.includes(ty) && <small className="muted">{t("de.static")}</small>}
              </button>
            ))}
          </div>
        </aside>

        {/* documento */}
        <main className="de-doc" onPointerMove={onMove} onPointerUp={onUp} onPointerDown={() => setSel(null)}>
          {!d.file.mime.includes("pdf") ? (
            <p className="note">{t("de.notPdf")}</p>
          ) : (
            <PdfView
              src={src}
              onPageRef={(i, el) => (pages.current[i] = el)}
              overlay={(pg) => (
                <div
                  className="de-ov"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const ty = e.dataTransfer.getData("text/x-field") as FieldType;
                    if (!ty || locked) return;
                    e.preventDefault();
                    const r = e.currentTarget.getBoundingClientRect();
                    setPage(pg);
                    addField(ty, pg, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
                  }}
                  onPointerEnter={() => setPage(pg)}
                >
                  {d.fields
                    .filter((f) => f.page === pg)
                    .map((f) => (
                      <div
                        key={f.id}
                        className={`de-fld t-${f.type} ${sel === f.id ? "sel" : ""}`}
                        style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%`, ["--rc" as string]: colorOf(d, f.recipient_id) }}
                        onPointerDown={(e) => !locked && onDown(e, f, "move")}
                        data-testid="de-fld"
                      >
                        {f.value && f.value.startsWith("data:image") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.value} alt="" />
                        ) : (
                          <span>
                            {f.type === "label" || f.type === "hyperlink" ? f.value : t(`df.t.${f.type}` as Key)}
                            {f.required && " *"}
                          </span>
                        )}
                        {!locked && <i className="de-sz" onPointerDown={(e) => onDown(e, f, "size")} />}
                      </div>
                    ))}
                </div>
              )}
            />
          )}
        </main>

        {/* miniaturas + propriedades */}
        <aside className="de-side">
          {field && !locked && (
            <section className="de-insp">
              <span className="tile-t">{t(`df.t.${field.type}` as Key)}</span>
              {!STATIC_FIELDS.includes(field.type) && (
                <Select className="select" value={field.recipient_id} onChange={(e) => setField(field.id, { recipient_id: e.target.value })} aria-label={t("de.recipients")}>
                  {d.recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || r.email || "—"}
                    </option>
                  ))}
                </Select>
              )}
              {(field.type === "label" || field.type === "hyperlink") && <input className="input" value={field.value ?? ""} onChange={(e) => setField(field.id, { value: e.target.value })} aria-label="value" />}
              {field.type === "radio" && <input className="input" value={field.label ?? ""} onChange={(e) => setField(field.id, { label: e.target.value })} placeholder="A|B|C" aria-label="options" />}
              {(field.type === "textbox" || field.type === "date") && <input className="input" value={field.label ?? ""} onChange={(e) => setField(field.id, { label: e.target.value })} placeholder={t("de.placeholder")} aria-label="placeholder" />}
              {field.type === "image" && (
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await new Promise<string>((res) => {
                      const r = new FileReader();
                      r.onload = () => res(String(r.result));
                      r.readAsDataURL(f);
                    });
                    setField(field.id, { value: url });
                  }}
                />
              )}
              {!STATIC_FIELDS.includes(field.type) && (
                <label className="row small" style={{ gap: 6 }}>
                  <input type="checkbox" checked={field.required} onChange={(e) => setField(field.id, { required: e.target.checked })} /> {t("de.required")}
                </label>
              )}
              <button className="btn ghost small" onClick={() => (set({ fields: d.fields.filter((f) => f.id !== field.id) }), setSel(null))}>
                <Icon name="trash" size={13} /> {t("ra.delete")}
              </button>
            </section>
          )}
          <span className="tile-t">{t("de.pages")}</span>
          <PdfThumbs src={d.file.mime.includes("pdf") ? src : null} active={page} counts={counts} onPick={(i) => (setPage(i), pages.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" }))} />
        </aside>
      </div>

      {links && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setLinks(null)}>
          <div className="dialog stack" role="dialog" aria-modal="true">
            <span className="tile-t">{t("de.sentTitle")}</span>
            {links.map((l) => (
              <div key={l.id} className="stack" style={{ gap: 4 }}>
                <span className="small">
                  {l.email} · {l.sent ? <span className="tone-ok">{t("de.emailed")}</span> : <span className="muted">{t("de.copyShare")}</span>}
                </span>
                <button className="codechip" onClick={() => navigator.clipboard?.writeText(l.link)} style={{ textAlign: "left", wordBreak: "break-all", fontSize: 12 }} data-testid="de-link">
                  {l.link}
                </button>
              </div>
            ))}
            <button className="btn" onClick={() => setLinks(null)}>
              {t("ti.done")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
