"use client";

import { DropZone } from "@/components/DropZone";
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { useEffect, useRef, useState } from "react";
import { useT, type Key } from "@/lib/i18n";
import { CSV_COLUMNS, download, formatLinks, fromJSON, mergeCSV, parseFile, parseLinks, slug, toCSV, toJSON } from "@/lib/io";
import { store } from "@/lib/store";
import {
  REEL_STATUS,
  type Block,
  type Project,
  type ProjectData,
  type ProjectVersion,
  type RefLink,
  type Scene,
  type Session,
} from "@/lib/types";
import { STATUS_COLOR, expiryLabel, pad, sessionStats } from "@/lib/util";

type Update = (fn: (d: ProjectData) => void, immediate?: boolean) => void;
const uid = () => crypto.randomUUID();

// ---------- small primitives ----------
function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: number }) {
  return (
    <label className="field" style={{ flex: grow ?? 1 }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Head({ n, title, children }: { n: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="row between" style={{ padding: "28px 0 8px", alignItems: "end" }}>
      <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
        {n && <span className="label tone-warn">{n}</span>}
        <h2 className="h2">{title}</h2>
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

function Remove({ onClick, what }: { onClick: () => void; what: string }) {
  const { t } = useT();
  return (
    <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => confirm(t("removeConfirm", { what })) && onClick()}>
      {t("remove")}
    </button>
  );
}

function MoveBtns({ onMove }: { onMove: (d: -1 | 1) => void }) {
  return (
    <>
      <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => onMove(-1)} aria-label="up">
        <Icon name="upload" size={14} />
      </button>
      <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => onMove(1)} aria-label="down">
        <Icon name="download" size={14} />
      </button>
    </>
  );
}

function LinksField({ value, onChange }: { value: RefLink[]; onChange: (v: RefLink[]) => void }) {
  const [text, setText] = useState(formatLinks(value, "\n"));
  return (
    <textarea
      className="textarea"
      rows={2}
      placeholder={"Moodboard https://pinterest.com/…\nhttps://instagram.com/reel/…"}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(parseLinks(text))}
    />
  );
}

// ---------- 01 Geral ----------
export function Overview({ data, update }: { data: ProjectData; update: Update }) {
  const { t } = useT();
  return (
    <>
      <Head n="01" title={t("ov.title")} />
      <div className="grid2" style={{ paddingTop: 12 }}>
        <Field label={t("ed.client")}>
          <input className="input" value={data.client} onChange={(e) => update((d) => void (d.client = e.target.value))} />
        </Field>
        <Field label={t("ov.shootDate")}>
          <input className="input" type="date" value={data.shootDate} onChange={(e) => update((d) => void (d.shootDate = e.target.value))} />
        </Field>
      </div>
      <div style={{ paddingTop: 20 }}>
        <Field label={t("ov.concept")}>
          <textarea className="textarea" rows={4} value={data.description} onChange={(e) => update((d) => void (d.description = e.target.value))} />
        </Field>
      </div>

      <Head n="" title={t("ov.defs")}>
        <button className="btn" onClick={() => update((d) => void d.definitions.push({ id: uid(), label: "", value: "" }))}>
          + {t("ov.addDef")}
        </button>
      </Head>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        {t("ov.defsHint")}
      </p>
      {data.definitions.map((x) => (
        <div key={x.id} className="row item" style={{ padding: "10px 0", alignItems: "end" }}>
          <div style={{ flex: "0 0 180px" }}>
            <input
              className="input label"
              placeholder={t("ov.defName")}
              value={x.label}
              onChange={(e) => update((d) => void (d.definitions.find((y) => y.id === x.id)!.label = e.target.value))}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              className="input"
              placeholder={t("ov.defValue")}
              value={x.value}
              onChange={(e) => update((d) => void (d.definitions.find((y) => y.id === x.id)!.value = e.target.value))}
            />
          </div>
          <Remove what={t("ov.definition")} onClick={() => update((d) => void (d.definitions = d.definitions.filter((y) => y.id !== x.id)))} />
        </div>
      ))}
    </>
  );
}

// ---------- 02 Reels ----------
export function Reels({ data, update }: { data: ProjectData; update: Update }) {
  const { t } = useT();
  const sceneCount = (id: string) => data.sessions.flatMap((s) => s.blocks.flatMap((b) => b.scenes)).filter((c) => c.reelId === id).length;

  function setCount(n: number) {
    if (!Number.isFinite(n) || n < 0 || n > 99) return;
    update((d) => {
      while (d.reels.length < n)
        d.reels.push({ id: uid(), title: t("rl.default", { n: pad(d.reels.length + 1) }), concept: "", expiresAt: "", status: "ideia" });
      // só remove do fim os que estão vazios
      while (d.reels.length > n) {
        const last = d.reels[d.reels.length - 1];
        if (last.concept || sceneCount(last.id)) break;
        d.reels.pop();
      }
    });
  }

  return (
    <>
      <Head n="02" title={t("tab.reels")} />
      <div className="row" style={{ alignItems: "end", gap: 24, padding: "8px 0 20px", borderBottom: "1px solid var(--line)" }}>
        <div className="display" style={{ fontSize: "clamp(64px, 12vw, 120px)" }}>
          {pad(data.reels.length)}
        </div>
        <div className="stack" style={{ paddingBottom: 8 }}>
          <span className="label muted">{t("rl.howMany")}</span>
          <div className="row">
            <button className="btn" onClick={() => setCount(data.reels.length - 1)} aria-label="−">
              −
            </button>
            <button className="btn accent" onClick={() => setCount(data.reels.length + 1)} aria-label="+">
              +
            </button>
          </div>
        </div>
      </div>

      {data.reels.map((r, i) => {
        const e = expiryLabel(r.expiresAt);
        const set = (patch: Partial<typeof r>) => update((d) => void Object.assign(d.reels.find((x) => x.id === r.id)!, patch));
        return (
          <div key={r.id} className="item" style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 16 }}>
            <div className="num" style={{ color: STATUS_COLOR[r.status] }}>
              {pad(i + 1)}
            </div>
            <div className="stack">
              <input className="input big" value={r.title} placeholder={t("rl.titlePh")} onChange={(ev) => set({ title: ev.target.value })} />
              <Field label={t("rl.concept")}>
                <textarea className="textarea" rows={3} value={r.concept} placeholder={t("rl.conceptPh")} onChange={(ev) => set({ concept: ev.target.value })} />
              </Field>
              <div className="row" style={{ alignItems: "end", gap: 20 }}>
                <Field label={t("rl.expiry")}>
                  <input className="input" type="date" value={r.expiresAt} onChange={(ev) => set({ expiresAt: ev.target.value })} />
                </Field>
                <Field label={t("rl.status")}>
                  <Select className="select" value={r.status} onChange={(ev) => set({ status: ev.target.value as typeof r.status })}>
                    {REEL_STATUS.map((s) => (
                      <option key={s} value={s}>
                        {t(`st.${s}` as Key)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="field" style={{ flex: 1 }}>
                  <span>{t("rl.deadline")}</span>
                  <div style={{ padding: "6px 0" }}>
                    <span className={`tone-${e.tone}`}>{t(e.key, { n: e.n })}</span>
                    <span className="muted"> · {t("rl.scenes", { n: sceneCount(r.id) })}</span>
                  </div>
                </div>
                <Remove
                  what={`“${r.title}”`}
                  onClick={() =>
                    update((d) => {
                      d.reels = d.reels.filter((x) => x.id !== r.id);
                      d.sessions.forEach((s) => s.blocks.forEach((b) => b.scenes.forEach((c) => c.reelId === r.id && delete c.reelId)));
                    })
                  }
                />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---------- 03 Locais ----------
export function Locations({ data, update }: { data: ProjectData; update: Update }) {
  const { t } = useT();
  return (
    <>
      <Head n="03" title={t("lc.title")}>
        <button className="btn" onClick={() => update((d) => void d.locations.push({ id: uid(), name: "", address: "", mapsUrl: "", notes: "" }))}>
          + {t("lc.add")}
        </button>
      </Head>
      {data.locations.length === 0 && <p className="muted">{t("lc.empty")}</p>}
      {data.locations.map((l, i) => {
        const set = (patch: Partial<typeof l>) => update((d) => void Object.assign(d.locations.find((x) => x.id === l.id)!, patch));
        return (
          <div key={l.id} className="item" style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 16 }}>
            <span className="index">{pad(i + 1)}</span>
            <div className="stack">
              <input className="input big" placeholder={t("lc.name")} value={l.name} onChange={(e) => set({ name: e.target.value })} />
              <div className="grid2">
                <Field label={t("lc.address")}>
                  <input className="input" value={l.address} onChange={(e) => set({ address: e.target.value })} />
                </Field>
                <Field label={t("lc.maps")}>
                  <input className="input" value={l.mapsUrl} placeholder="https://maps.app.goo.gl/…" onChange={(e) => set({ mapsUrl: e.target.value })} />
                </Field>
              </div>
              <Field label={t("lc.notes")}>
                <textarea className="textarea" rows={2} value={l.notes} onChange={(e) => set({ notes: e.target.value })} />
              </Field>
              <div className="row between">
                {l.mapsUrl ? (
                  <a className="label arrow" href={l.mapsUrl} target="_blank" rel="noreferrer">
                    {t("lc.open")}
                  </a>
                ) : (
                  <span />
                )}
                <Remove
                  what={t("lc.what")}
                  onClick={() =>
                    update((d) => {
                      d.locations = d.locations.filter((x) => x.id !== l.id);
                      d.sessions.forEach((s) => s.locationId === l.id && delete s.locationId);
                    })
                  }
                />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---------- 04 Sessões → divisões → cenas ----------
function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

export function Schedule({ data, update }: { data: ProjectData; update: Update }) {
  const { t } = useT();
  const findS = (d: ProjectData, sid: string) => d.sessions.find((s) => s.id === sid)!;
  const findB = (d: ProjectData, sid: string, bid: string) => findS(d, sid).blocks.find((b) => b.id === bid)!;

  return (
    <>
      <Head n="04" title={t("sc.title")}>
        <button
          className="btn"
          onClick={() =>
            update((d) =>
              void d.sessions.push({
                id: uid(),
                label: d.sessions.length === 0 ? t("sc.morning") : d.sessions.length === 1 ? t("sc.afternoon") : t("sc.session"),
                date: d.shootDate,
                start: d.sessions.length === 0 ? "08:00" : d.sessions.length === 1 ? "14:00" : "",
                end: d.sessions.length === 0 ? "12:00" : d.sessions.length === 1 ? "18:00" : "",
                notes: "",
                blocks: [],
              })
            )
          }
        >
          + {t("sc.add")}
        </button>
      </Head>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        {t("sc.hint")}
      </p>

      {data.sessions.map((s, si) => {
        const setS = (patch: Partial<Session>) => update((d) => void Object.assign(findS(d, s.id), patch));
        const st = sessionStats(s);
        return (
          <details key={s.id} open className="w" style={{ marginBottom: 14 }}>
            <summary style={{ listStyle: "none", cursor: "pointer", paddingBottom: 14 }}>
              <div className="row between" style={{ alignItems: "end" }}>
                <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
                  <span className="num">{pad(si + 1)}</span>
                  <span className="h2">{s.label || t("sc.session")}</span>
                  <span className="mono muted" style={{ fontSize: 13 }}>
                    {[s.start, s.end].filter(Boolean).join("–")}
                  </span>
                </div>
                <span className="label muted">{t("sc.count", { done: st.done, total: st.total })}</span>
              </div>
            </summary>

            <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
              <Field label={t("sc.name")}>
                <input className="input" value={s.label} onChange={(e) => setS({ label: e.target.value })} />
              </Field>
              <Field label={t("sc.date")}>
                <input className="input" type="date" value={s.date} onChange={(e) => setS({ date: e.target.value })} />
              </Field>
              <Field label={t("sc.start")}>
                <input className="input" type="time" value={s.start} onChange={(e) => setS({ start: e.target.value })} />
              </Field>
              <Field label={t("sc.end")}>
                <input className="input" type="time" value={s.end} onChange={(e) => setS({ end: e.target.value })} />
              </Field>
              <Field label={t("sc.location")}>
                <Select className="select" value={s.locationId ?? ""} onChange={(e) => setS({ locationId: e.target.value || undefined })}>
                  <option value="">—</option>
                  {data.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name || "—"}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div style={{ paddingTop: 14 }}>
              <Field label={t("sc.notes")}>
                <input className="input" value={s.notes} onChange={(e) => setS({ notes: e.target.value })} />
              </Field>
            </div>

            <div style={{ marginTop: 20 }}>
              {s.blocks.map((b, bi) => (
                <BlockEditor
                  key={b.id}
                  n={`${si + 1}.${bi + 1}`}
                  block={b}
                  data={data}
                  set={(patch) => update((d) => void Object.assign(findB(d, s.id, b.id), patch))}
                  mutate={(fn) => update((d) => fn(findB(d, s.id, b.id)))}
                  onMove={(dir) => update((d) => move(findS(d, s.id).blocks, bi, dir))}
                  onRemove={() => update((d) => void (findS(d, s.id).blocks = findS(d, s.id).blocks.filter((x) => x.id !== b.id)))}
                />
              ))}
              <div className="row between" style={{ paddingTop: 16 }}>
                <button className="btn" onClick={() => update((d) => void findS(d, s.id).blocks.push({ id: uid(), title: "", start: "", end: "", scenes: [] }))}>
                  + {t("sc.addBlock")}
                </button>
                <div className="row">
                  <MoveBtns onMove={(dir) => update((d) => move(d.sessions, si, dir))} />
                  <Remove what={t("sc.sessionWhat")} onClick={() => update((d) => void (d.sessions = d.sessions.filter((x) => x.id !== s.id)))} />
                </div>
              </div>
            </div>
          </details>
        );
      })}
    </>
  );
}

function BlockEditor(props: {
  n: string;
  block: Block;
  data: ProjectData;
  set: (p: Partial<Block>) => void;
  mutate: (fn: (b: Block) => void) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const { n, block: b, data, set, mutate } = props;
  return (
    <div style={{ borderTop: "1px solid var(--muted)", padding: "14px 0 18px" }}>
      <div className="row" style={{ alignItems: "end" }}>
        <span className="label tone-warn" style={{ minWidth: 34 }}>
          {n}
        </span>
        <Field label={t("bl.label")} grow={3}>
          <input className="input" placeholder={t("bl.ph")} value={b.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label={t("sc.start")}>
          <input className="input" type="time" value={b.start} onChange={(e) => set({ start: e.target.value })} />
        </Field>
        <Field label={t("sc.end")}>
          <input className="input" type="time" value={b.end} onChange={(e) => set({ end: e.target.value })} />
        </Field>
        <MoveBtns onMove={props.onMove} />
        <Remove what={t("bl.what")} onClick={props.onRemove} />
      </div>

      {b.scenes.map((c, ci) => (
        <SceneEditor
          key={c.id}
          n={pad(ci + 1)}
          scene={c}
          reels={data.reels}
          set={(patch) => mutate((bb) => void Object.assign(bb.scenes.find((x) => x.id === c.id)!, patch))}
          onMove={(dir) => mutate((bb) => move(bb.scenes, ci, dir))}
          onRemove={() => mutate((bb) => void (bb.scenes = bb.scenes.filter((x) => x.id !== c.id)))}
        />
      ))}
      <button
        className="btn ghost"
        style={{ marginTop: 10 }}
        onClick={() => mutate((bb) => void bb.scenes.push({ id: uid(), title: "", description: "", links: [], done: false, imageUrl: "", videoUrl: "" }))}
      >
        + {t("bl.addScene")}
      </button>
    </div>
  );
}

function SceneEditor(props: {
  n: string;
  scene: Scene;
  reels: ProjectData["reels"];
  set: (p: Partial<Scene>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const { n, scene: c, reels, set } = props;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "34px 1fr 96px", gap: 14, padding: "16px 0", borderTop: "1px solid var(--line)" }}>
      <span className="index" style={{ paddingTop: 8 }}>
        {n}
      </span>
      <div className="stack">
        <div className="row" style={{ alignItems: "end" }}>
          <Field label={t("cn.label")} grow={3}>
            <input className="input" style={{ fontSize: 18 }} value={c.title} placeholder={t("cn.ph")} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label={t("cn.reel")}>
            <Select className="select" value={c.reelId ?? ""} onChange={(e) => set({ reelId: e.target.value || undefined })}>
              <option value="">—</option>
              {reels.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("cn.desc")}>
          <textarea
            className="textarea"
            rows={2}
            style={{ minHeight: 44 }}
            value={c.description}
            placeholder={t("cn.descPh")}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>
        <div className="grid2">
          <Field label={t("cn.image")}>
            <input className="input" value={c.imageUrl ?? ""} onChange={(e) => set({ imageUrl: e.target.value })} />
          </Field>
          <Field label={t("cn.video")}>
            <input className="input" value={c.videoUrl ?? ""} onChange={(e) => set({ videoUrl: e.target.value })} />
          </Field>
        </div>
        <Field label={t("cn.links")}>
          <LinksField value={c.links} onChange={(links) => set({ links })} />
        </Field>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <MoveBtns onMove={props.onMove} />
          <Remove what={t("cn.what")} onClick={props.onRemove} />
        </div>
      </div>
      {c.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.imageUrl} alt="" className="thumb" style={{ width: 96, height: 120 }} />
      ) : (
        <div className="thumb dots" style={{ width: 96, height: 120 }} />
      )}
    </div>
  );
}

// ---------- 05 Versões ----------
export function Versions({
  project,
  flush,
  onRestored,
  toast,
}: {
  project: Project;
  flush: () => Promise<void>;
  onRestored: (p: Project) => void;
  toast: (m: string) => void;
}) {
  const { t, locale } = useT();
  const [list, setList] = useState<ProjectVersion[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => store.versions(project.id).then(setList);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function snap() {
    setBusy(true);
    await flush();
    const v = await store.snapshot(project.id, note || t("vs.manual"));
    onRestored({ ...project, version: v.version + 1 });
    setNote("");
    await load();
    setBusy(false);
    toast(t("vs.saved", { n: v.version }));
  }

  async function restore(v: ProjectVersion) {
    if (!confirm(t("vs.restoreConfirm", { n: v.version }))) return;
    setBusy(true);
    await flush();
    onRestored(await store.restore(project.id, v.id, t("vs.beforeRestore", { n: v.version })));
    await load();
    setBusy(false);
    toast(t("vs.restored", { n: v.version }));
  }

  return (
    <>
      <Head n="05" title={t("vs.title")} />
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        {t("vs.hint")}
      </p>
      <div className="row" style={{ alignItems: "end", padding: "8px 0 24px" }}>
        <Field label={t("vs.note", { n: project.version })} grow={4}>
          <input
            className="input"
            placeholder={t("vs.notePh")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && snap()}
          />
        </Field>
        <button className="btn accent" disabled={busy} onClick={snap}>
          {t("vs.save")}
        </button>
      </div>
      {list?.length === 0 && <p className="muted">{t("vs.empty")}</p>}
      {list?.map((v) => (
        <div key={v.id} className="item row between" style={{ padding: "14px 0" }}>
          <div className="row" style={{ gap: 18, alignItems: "baseline" }}>
            <span className="num" style={{ fontSize: 28, minWidth: 64 }}>
              v{v.version}
            </span>
            <div>
              <div>{v.note || "—"}</div>
              <div className="mono muted" style={{ fontSize: 12 }}>
                {new Date(v.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                {t("vs.meta", { reels: v.data.reels.length, scenes: v.data.sessions.flatMap((s) => s.blocks.flatMap((b) => b.scenes)).length })}
              </div>
            </div>
          </div>
          <div className="row">
            <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => download(`${slug(v.title)}-v${v.version}.json`, toJSON(v), "application/json")}>
              JSON <Icon name="download" size={14} />
            </button>
            <button className="btn" disabled={busy} onClick={() => restore(v)}>
              {t("vs.restore")}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

// ---------- 06 Dados: importar / exportar ----------
export function DataIO({
  project,
  update,
  setTitle,
  flush,
  toast,
}: {
  project: Project;
  update: Update;
  setTitle: (t: string) => void;
  flush: () => Promise<void>;
  toast: (m: string) => void;
}) {
  const { t } = useT();
  const fileIn = useRef<HTMLInputElement>(null);
  const name = slug(project.title);

  async function importFile(f: File) {
    try {
      const p = parseFile(f.name, await f.text());
      if (p.kind === "json") {
        if (!confirm(t("io.replaceConfirm"))) return;
        await flush();
        await store.snapshot(project.id, t("vs.beforeImport", { fmt: "JSON" }));
        setTitle(fromJSON(await f.text()).title);
        update((d) => void Object.assign(d, p.data), true);
        toast(t("io.jsonDone"));
      } else {
        if (!p.rows.length) return toast(p.issues[0]?.code === "missingCols" ? t("err.missingCols", { cols: "session, scene" }) : t("err.noRows"));
        await flush();
        await store.snapshot(project.id, t("vs.beforeImport", { fmt: p.format }));
        update((d) => void Object.assign(d, mergeCSV(d, p.rows).data), true);
        const bad = p.total - p.rows.length;
        toast(t("import.done", { n: p.rows.filter((r) => r.scene).length }) + (bad ? ` · ${t("import.rows", { ok: p.rows.length, bad })}` : ""));
      }
    } catch (e) {
      toast(t("err.json", { msg: (e as Error).message }));
    }
  }

  return (
    <>
      <Head n="06" title={t("io.title")} />
      <div className="grid2" style={{ paddingTop: 12 }}>
        <div className="w stack">
          <span className="label">{t("io.export")}</span>
          <p style={{ margin: 0, fontSize: 14 }}>{t("io.exportHint")}</p>
          <div className="row">
            <button className="btn accent" onClick={() => download(`${name}.json`, toJSON(project), "application/json")}>
              JSON
            </button>
            <button className="btn" onClick={() => download(`${name}.csv`, "﻿" + toCSV(project.data, ","), "text/csv;charset=utf-8")}>
              CSV
            </button>
            <button className="btn" onClick={() => download(`${name}.ssv`, "﻿" + toCSV(project.data, ";"), "text/csv;charset=utf-8")}>
              SSV
            </button>
          </div>
        </div>
        <div className="w stack">
          <span className="label">{t("io.import")}</span>
          <p style={{ margin: 0, fontSize: 14 }}>{t("io.importHint")}</p>
          <div className="row">
            <button className="btn accent" onClick={() => fileIn.current?.click()}>
              JSON / CSV / SSV
            </button>
            {["csv", "ssv", "json"].map((ext) => (
              <a key={ext} className="chip" href={`/templates/template.${ext}`} download={`template.${ext}`}>
                template.{ext} <Icon name="download" size={14} />
              </a>
            ))}
          </div>
          <DropZone target="data" onFiles={([f]) => importFile(f)} testId="io-drop" />
          <input
            ref={fileIn}
            type="file"
            accept=".json,.csv,.ssv,.tsv,.txt"
            hidden
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0]).finally(() => (e.target.value = ""))}
          />
        </div>
      </div>
      <p className="mono muted" style={{ fontSize: 11.5, marginTop: 20 }}>
        {t("io.cols", { cols: CSV_COLUMNS.join(", ") })}
      </p>
    </>
  );
}
