"use client";

// Portal · Planear: o cliente cria os rascunhos da semana (ou do mês) — data, tipo, título, conceito e capa — que
// ficam em Ideias para a equipa produzir. Também mostra o que já está planeado/produzido nesse período.
import { MusicRef } from "./MusicRef";
import { useMemo, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { POST_TYPES, hasCover, monthGrid, thumbOf, type ContentPost, type PostType } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { portalApi } from "@/lib/portalApi";
import { weekDays, weekOf, ymd } from "@/lib/studio";
import { Cover, StatusLabel, TypeIcon } from "./parts";

type Refs = NonNullable<ContentPost["refs"]>;
type Row = { key: string; id?: string; date: string; type: PostType; title: string; caption: string; cover: string; refs: Refs; dirty: boolean };
// imagem do rascunho: capa no reel; nos outros tipos é o 1.º ficheiro (regra da capa em lib/customer)
const toRow = (p: ContentPost): Row => ({ key: p.id, id: p.id, date: p.scheduled_at ? p.scheduled_at.slice(0, 10) : "", type: p.type, title: p.title, caption: p.caption, cover: thumbOf(p), refs: p.refs ?? {}, dirty: false });
const DAY = 86_400_000;

export function DraftPlanner({ posts, readOnly, onSaved, onToast, moodboards = [] }: { posts: ContentPost[]; readOnly: boolean; onSaved: () => unknown; onToast: (m: string) => void; moodboards?: { id: string; title: string; deleted?: boolean }[] }) {
  const { t, locale } = useT();
  const [view, setView] = useState<"week" | "month">("week");
  const [week, setWeek] = useState(weekOf());
  const [month, setMonth] = useState(ymd(new Date()).slice(0, 7));
  const days = weekDays(week);
  const drafts = posts.filter((p) => p.client_draft && p.status === "idea");
  const [rows, setRows] = useState<Row[]>(() => drafts.map(toRow));
  const [busy, setBusy] = useState(false);
  const inWeek = (d: string) => !d || (d >= days[0] && d <= days[6]);
  const weekRows = rows.filter((r) => inWeek(r.date));
  const others = posts.filter((p) => !(p.client_draft && p.status === "idea") && p.scheduled_at && inWeek(p.scheduled_at.slice(0, 10)));
  const set = (key: string, p: Partial<Row>) => setRows((l) => l.map((r) => (r.key === key ? { ...r, ...p, dirty: true } : r)));
  const add = (date?: string) => {
    const taken = new Set(rows.map((r) => r.date));
    const free = date ?? days.find((d) => !taken.has(d) && d >= ymd(new Date())) ?? days[0];
    setRows((l) => [...l, { key: crypto.randomUUID(), date: free, type: "reel", title: "", caption: "", cover: "", refs: {}, dirty: true }]);
  };
  /** Planear a semana: um rascunho para segunda, quarta e sexta (os que ainda não existem). */
  const planWeek = () => {
    const taken = new Set(rows.map((r) => r.date));
    const pick = [days[0], days[2], days[4]].filter((d) => !taken.has(d));
    setRows((l) => [...l, ...pick.map((d) => ({ key: crypto.randomUUID(), date: d, type: "reel" as PostType, title: "", caption: "", cover: "", refs: {}, dirty: true }))]);
  };
  async function saveAll() {
    setBusy(true);
    try {
      const dirty = rows.filter((r) => r.dirty && (r.title.trim() || r.caption.trim()));
      const saved: Record<string, ContentPost> = {};
      for (const r of dirty) saved[r.key] = await portalApi.saveDraft({ id: r.id, type: r.type, title: r.title, caption: r.caption, cover: r.cover, scheduled_at: r.date ? `${r.date}T10:00:00` : "", refs: r.refs });
      setRows((l) => l.map((r) => (saved[r.key] ? { ...toRow(saved[r.key]), key: r.key } : r)));
      onToast(t("dp.saved", { n: dirty.length }));
      onSaved();
    } catch (e) {
      onToast((e as Error).message);
    }
    setBusy(false);
  }
  async function remove(r: Row) {
    if (r.id) await portalApi.deleteDraft(r.id).catch((e) => onToast((e as Error).message));
    setRows((l) => l.filter((x) => x.key !== r.key));
    onSaved();
  }
  const dirtyN = rows.filter((r) => r.dirty && (r.title.trim() || r.caption.trim())).length;
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T12:00:00").toLocaleDateString(locale, o);
  const grid = useMemo(() => monthGrid(month), [month]);
  const shift = (n: number) => (view === "week" ? setWeek(ymd(new Date(new Date(week + "T12:00:00").getTime() + n * 7 * DAY))) : setMonth(ymd(new Date(new Date(month + "-15T12:00:00").getTime() + n * 31 * DAY)).slice(0, 7)));

  return (
    <section className="dp">
      <div className="dp-bar">
        <div className="seg" role="group">
          <button aria-pressed={view === "week"} onClick={() => setView("week")}>
            {t("dp.week")}
          </button>
          <button aria-pressed={view === "month"} onClick={() => setView("month")}>
            {t("dp.month")}
          </button>
        </div>
        <span className="row" style={{ gap: 6 }}>
          <button className="iconbtn" onClick={() => shift(-1)} aria-label={t("cal.prev")}>
            <Icon name="back" size={15} />
          </button>
          <b className="dp-range">{view === "week" ? `${fmt(days[0], { day: "numeric", month: "short" })} – ${fmt(days[6], { day: "numeric", month: "short" })}` : fmt(`${month}-15`, { month: "long", year: "numeric" })}</b>
          <button className="iconbtn" onClick={() => shift(1)} aria-label={t("cal.next")}>
            <Icon name="next" size={15} />
          </button>
        </span>
        {!readOnly && (
          <span className="row" style={{ gap: 6 }}>
            <button className="btn small" onClick={planWeek} data-testid="dp-plan-week">
              <Icon name="sparkles" size={13} /> {t("dp.planWeek")}
            </button>
            <button className="btn small accent" onClick={saveAll} disabled={busy || !dirtyN} data-testid="dp-save">
              <Icon name="check" size={13} /> {t("dp.saveAll", { n: dirtyN })}
            </button>
          </span>
        )}
      </div>

      {view === "month" ? (
        <div className="dp-month">
          {grid.flat().map((d) => {
            const ds = rows.filter((r) => r.date === d);
            const ps = posts.filter((p) => p.scheduled_at?.slice(0, 10) === d && !(p.client_draft && p.status === "idea"));
            return (
              <button key={d} className={`dp-day ${d.slice(0, 7) !== month ? "out" : ""} ${d === ymd(new Date()) ? "today" : ""}`} onClick={() => (setWeek(weekOf(new Date(d + "T12:00:00"))), setView("week"), !readOnly && !ds.length && add(d))}>
                <span className="mono small">{Number(d.slice(8))}</span>
                {ds.map((r) => (
                  <i key={r.key} className="dp-dot draft" title={r.title} />
                ))}
                {ps.map((p) => (
                  <i key={p.id} className="dp-dot" title={p.title} />
                ))}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <ul className="dp-list">
            {weekRows
              .sort((a, b) => (a.date || "9").localeCompare(b.date || "9"))
              .map((r) => (
                <li key={r.key} className={`dp-row ${r.dirty ? "dirty" : ""}`} data-testid="dp-row">
                  <DropZone target="cover" onFiles={async ([f]) => !readOnly && set(r.key, { cover: await portalApi.upload(f) })} noPick disabled={readOnly}>
                    <label className="dp-cover" title={hasCover(r.type) ? t("dp.cover") : t("dp.image")}>
                      {r.cover ? <Cover src={r.cover} /> : <span className="muted small"><Icon name="image" size={16} /><br />{hasCover(r.type) ? t("dp.cover") : t("dp.image")}</span>}
                      {!readOnly && <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files?.[0] && set(r.key, { cover: await portalApi.upload(e.target.files[0]) })} />}
                    </label>
                  </DropZone>
                  <div className="dp-fields">
                    <div className="dp-line">
                      <input className="input" type="date" value={r.date} onChange={(e) => set(r.key, { date: e.target.value })} disabled={readOnly} aria-label={t("dp.date")} />
                      <Select className="select" value={r.type} onChange={(e) => set(r.key, { type: e.target.value as PostType })} disabled={readOnly} aria-label={t("dp.type")}>
                        {POST_TYPES.map((x) => (
                          <option key={x} value={x}>
                            {t(`ct.type.${x}` as Key)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <input className="input dp-title" value={r.title} onChange={(e) => set(r.key, { title: e.target.value })} placeholder={t("dp.titlePh")} disabled={readOnly} data-testid="dp-title" />
                    <textarea className="textarea" rows={2} value={r.caption} onChange={(e) => set(r.key, { caption: e.target.value })} placeholder={t("dp.conceptPh")} disabled={readOnly} />
                    {/* referências para a produção */}
                    <details className="dp-refs" open={!!(r.refs.music || r.refs.moodboard || r.refs.instagram)}>
                      <summary>
                        <Icon name="link" size={13} /> {t("dp.refs")}
                        {(["music", "moodboard", "instagram"] as const).filter((k) => r.refs[k]).map((k) => (
                          <span key={k} className="label muted">{t(`dp.ref.${k}` as Key)}</span>
                        ))}
                      </summary>
                      <MusicRef refs={r.refs} onChange={(refs) => set(r.key, { refs })} endpoint="/api/portal/music" disabled={readOnly} />
                      <label className="dp-ref">
                        <Icon name="layers" size={14} />
                        <Select className="select" value={r.refs.moodboard ?? ""} onChange={(e) => set(r.key, { refs: { ...r.refs, moodboard: e.target.value || undefined } })} disabled={readOnly || !moodboards.length} aria-label={t("dp.ref.moodboard")}>
                          <option value="">{moodboards.length ? t("dp.noMoodboard") : t("dp.noMoodboards")}</option>
                          {moodboards.filter((b) => !b.deleted).map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.title}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="dp-ref">
                        <Icon name="instagram" size={14} />
                        <input className="input" value={r.refs.instagram ?? ""} onChange={(e) => set(r.key, { refs: { ...r.refs, instagram: e.target.value } })} placeholder={t("dp.igPh")} disabled={readOnly} data-testid="dp-ig" />
                      </label>
                    </details>
                  </div>
                  {!readOnly && (
                    <button className="iconbtn" onClick={() => remove(r)} aria-label={t("ra.delete")}>
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </li>
              ))}
            {!readOnly && (
              <li>
                <button className="dp-add" onClick={() => add()} data-testid="dp-add">
                  <Icon name="plus" size={15} /> {weekRows.length ? t("dp.add") : t("dp.first")}
                </button>
              </li>
            )}
          </ul>
          {others.length > 0 && (
            <section className="dp-others">
              <span className="tile-t">{t("dp.alreadyThisWeek")}</span>
              {others.map((p) => (
                <div key={p.id} className="dp-other">
                  <TypeIcon type={p.type} />
                  <span className="mono small muted">{fmt(p.scheduled_at.slice(0, 10), { weekday: "short", day: "2-digit" })}</span>
                  <b>{p.title || t(`ct.type.${p.type}` as Key)}</b>
                  <StatusLabel status={p.status} />
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
