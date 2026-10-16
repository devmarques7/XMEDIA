"use client";

import { BinView, useTrash } from "@/components/customer/Trash";
import { milestoneText } from "@/lib/milestones-i18n";
import { DocumentsHub } from "@/components/docs/DocumentsHub";
import { PortalPreview } from "@/components/customer/PortalPreview";
import { DropZone } from "@/components/DropZone";
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BillingCard } from "@/components/customer/BillingCard";
import { BrandEditor } from "@/components/brand/BrandEditor";
import { ClientJsonImport, ProcessEditor } from "@/components/customer/ProcessEditor";
import { TaskBoard } from "@/components/customer/TaskBoard";
import { InviteDialog } from "@/components/customer/InviteDialog";
import { ClientInspiration } from "@/components/inspiration/ClientInspiration";
import { mergeTasks } from "@/lib/tasks";
import { useUser } from "@/components/ui";
import { AgendaCalendar } from "@/components/customer/AgendaCalendar";
import { ContentBoard } from "@/components/customer/ContentBoard";
import { stageMove } from "@/lib/clientProcess";
import { PortalUsers } from "@/components/customer/PortalUsers";
import { PostEditor } from "@/components/customer/PostEditor";
import { ContentCalendar, Cover, GridPreview, Journey, Metrics, PostRow } from "@/components/customer/parts";
import { AppShell, Toast, useToast } from "@/components/ui";
import {
  CSTAGES,
  DEFAULT_SETTINGS,
  MILESTONES,
  POST_STATUSES,
  POST_TYPES,
  addPaidMonth,
  cleanHandle,
  emptyPost,
  isWorkStage,
  moveToPhase,
  phaseOf,
  monthlyFee,
  nextStage,
  planState,
  stageProgress,
  type CStage,
  type ContentPost,
  type Customer,
  type PortalSettings,
  type PostStatus,
  type PostType,
} from "@/lib/customer";
import { CUSTOMER_SAVED, customerStore } from "@/lib/customerStore";
import { LANGS, useT, type Key } from "@/lib/i18n";
import { uploadMedia } from "@/lib/media";
import { ApiError, portalApi, type IntegrationStatus } from "@/lib/portalApi";
import { isoDay } from "@/lib/util";
import { VersionHistory } from "@/components/VersionHistory";
import { WithMenu } from "@/components/ContextMenu";
import { pins } from "@/lib/pins";

type Tab = "portal" | "documents" | "overview" | "content" | "calendar" | "tasks" | "brand" | "inspiration" | "process" | "grid" | "metrics" | "access" | "bin";
const TABS: Tab[] = ["portal", "overview", "content", "calendar", "tasks", "brand", "inspiration", "documents", "process", "grid", "metrics", "access", "bin"];

export default function Page() {
  return (
    <Suspense>
      <CustomerPage />
    </Suspense>
  );
}

function CustomerPage() {
  const { t, locale, lang } = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const tab = (TABS.includes(sp.get("tab") as Tab) ? sp.get("tab") : "portal") as Tab;
  // "recentes" da lista de clientes: este cliente foi aberto agora
  useEffect(() => {
    if (id) pins.touch("customer", id);
  }, [id]);
  // abas fixadas com o botão direito (guardadas neste browser)
  const [pinnedTabs, setPinnedTabs] = useState<Tab[]>([]);
  useEffect(() => {
    try {
      setPinnedTabs(JSON.parse(localStorage.getItem("xmedia:cu:pinnedTabs") || "[]"));
    } catch {}
  }, []);
  const pinTab = (k: Tab, on: boolean) =>
    setPinnedTabs((l) => {
      const next = on ? [...l.filter((x) => x !== k), k] : l.filter((x) => x !== k);
      try {
        localStorage.setItem("xmedia:cu:pinnedTabs", JSON.stringify(next));
      } catch {}
      return next;
    });
  const [toast, setToast] = useToast();
  const user = useUser();
  const [inviting, setInviting] = useState(false);
  const [c, setC] = useState<Customer | null>(null);
  const [missing, setMissing] = useState(false);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [editing, setEditing] = useState<ContentPost | null>(null);
  const [filter, setFilter] = useState<PostStatus | "all">("all");
  const [cview, setCview] = useState<"board" | "list">("board");
  const [calView, setCalView] = useState<"agenda" | "month">("agenda");
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tErr = (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    const k = `po.err.${m}` as Key;
    const s = t(k);
    return s === k ? m : s;
  };

  const load = useCallback(async () => {
    const [cust, p, s] = await Promise.all([customerStore.get(id), customerStore.posts(id), customerStore.settings()]);
    if (!cust) return setMissing(true);
    setC(cust);
    setPosts(p);
    setSettings(s);
  }, [id]);
  useEffect(() => {
    load().catch((e) => setToast(e.message));
    portalApi.status().then(setStatus).catch(() => {});
  }, [load, setToast]);
  useEffect(() => {
    const on = (e: Event) => (e as CustomEvent).detail?.id === id && !saveTimer.current && load();
    window.addEventListener(CUSTOMER_SAVED, on);
    return () => window.removeEventListener(CUSTOMER_SAVED, on);
  }, [id, load]);

  // abre um post pelo link (?post=…), ex. a partir da pesquisa global
  const postParam = sp.get("post");
  useEffect(() => {
    if (postParam && posts.length) {
      const p = posts.find((x) => x.id === postParam);
      if (p) setEditing(p);
    }
  }, [postParam, posts]);

  /** Grava com atraso (escrever não dispara um pedido por tecla). */
  const update = (patch: Partial<Customer>) => {
    setC((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        customerStore.save(next).catch((e) => setToast(e.message));
      }, 600);
      return next;
    });
  };
  useEffect(() => () => void (saveTimer.current && clearTimeout(saveTimer.current)), []);

  const go = (k: Tab) => router.replace(k === "portal" ? `/clientes/${id}` : `/clientes/${id}?tab=${k}`, { scroll: false });
  const money = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleString(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : t("cu.never"));

  const shown = useMemo(() => (filter === "all" ? posts : posts.filter((p) => p.status === filter)), [posts, filter]);
  const counts = useMemo(() => Object.fromEntries(POST_STATUSES.map((s) => [s, posts.filter((p) => p.status === s).length])) as Record<PostStatus, number>, [posts]);

  if (missing)
    return (
      <AppShell>
        <p className="muted w">404 · {t("cu.back")}</p>
      </AppShell>
    );
  // apagar: vazio = de vez; com conteúdo = confirmar e mover para o lixo (15 dias)
  const trash = useTrash((p, kind) => {
    setPosts((l) => l.filter((x) => x.id !== p.id));
    setEditing(null);
    setToast(kind === "trash" ? t("bin.moved") : t("bin.purged"));
  });
  if (!c) return <AppShell>{null}</AppShell>;

  const pr = stageProgress(c);
  const ps = planState(c, isoDay());

  async function savePost(p: ContentPost) {
    const saved = await customerStore.savePost(p);
    setPosts((l) => (l.some((x) => x.id === saved.id) ? l.map((x) => (x.id === saved.id ? saved : x)) : [...l, saved]));
    setToast(t("ct.saved"));
    return saved;
  }
  const removePost = (p: ContentPost) => trash.remove(p);
  async function publish(p: ContentPost) {
    try {
      await customerStore.savePost(p);
      const r = await portalApi.publishNow(p.id);
      setToast(r.ok ? t("ct.status.published") : tErr(new Error(r.error || "error")));
      await load();
      setEditing(null);
    } catch (e) {
      setToast(tErr(e));
    }
  }
  const newPost = (type: PostType, day?: string) => {
    const p = { ...emptyPost(c.id, type), internal: true }; // novo: interno até ficar pronto para o cliente
    if (day) {
      const [h, m] = (settings.slots.times[0] || "12:00").split(":").map(Number);
      const [y, mo, d] = day.split("-").map(Number);
      p.scheduled_at = new Date(y, mo - 1, d, h, m).toISOString();
    }
    setEditing(p);
  };

  async function sync() {
    setBusy(true);
    try {
      await portalApi.adminSync(c!.id);
      await load();
    } catch (e) {
      setToast(tErr(e));
    }
    setBusy(false);
  }
  async function remove() {
    if (!confirm(t("cu.deleteConfirm", { name: c!.name }))) return;
    await customerStore.remove(c!.id);
    router.push("/clientes");
  }

  return (
    <AppShell
      left={
        <Link href="/clientes" className="btn ghost">
          <Icon name="back" size={14} /> {t("cu.back")}
        </Link>
      }
    >
      <section className="pagehead cu-head">
        <div className="row" style={{ gap: 16, flexWrap: "nowrap", minWidth: 0 }}>
          <DropZone target="cover" onFiles={async ([f]) => update({ cover: (await uploadMedia(f, `customers/${c.id}`)).src })} noPick>
            <label className="cu-avatar" title={t("ct.cover")}>
              <Cover src={c.cover || c.instagram.picture} />
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) update({ cover: (await uploadMedia(f, `customers/${c.id}`)).src });
                }}
              />
            </label>
          </DropZone>
          <div style={{ minWidth: 0 }}>
            {/* estado: etiqueta pequena (clicar para mudar), em vez de um select grande */}
            <label className={`stage-tag st-${c.stage}`} title={t("cu.col.stage")}>
              <span>{t(`cu.stage.${c.stage}` as Key)}</span>
              <Icon name="chevronDown" size={11} />
              <select value={c.stage} onChange={(e) => update({ stage: e.target.value as CStage })} aria-label={t("cu.col.stage")} data-testid="cu-stage">
                {CSTAGES.map((s) => (
                  <option key={s} value={s}>
                    {t(`cu.stage.${s}` as Key)}
                  </option>
                ))}
              </select>
            </label>
            <input className="input title" value={c.name} onChange={(e) => update({ name: e.target.value })} aria-label={t("cu.name")} />
          </div>
        </div>
        <div className="row cu-actions">
          <VersionHistory entity="customer" id={c.id} className="btn" />
          <button className="btn accent" onClick={() => setInviting(true)} data-testid="cu-invite">
            + {t("iv.cta")}
          </button>
        </div>
      </section>
      {inviting && <InviteDialog customer={c} onClose={() => setInviting(false)} onDone={(m) => setToast(m)} />}

      <nav className="tabs cu-tabs" role="tablist">
        {/* abas fixadas (botão direito → Fixar) aparecem primeiro */}
        {[...pinnedTabs.filter((k) => TABS.includes(k)), ...TABS.filter((k) => !pinnedTabs.includes(k))].map((k) => (
          <WithMenu
            key={k}
            actions={[
              { title: t(`cu.tab.${k}` as Key) },
              { label: t("cm.open"), icon: <Icon name="next" size={13} />, onSelect: () => go(k) },
              pinnedTabs.includes(k)
                ? { label: t("cm.unpinTab"), icon: <Icon name="close" size={13} />, onSelect: () => pinTab(k, false) }
                : { label: t("cm.pinTab"), icon: <Icon name="flag" size={13} />, onSelect: () => pinTab(k, true) },
            ]}
          >
            <button role="tab" aria-selected={tab === k} className={`tab ${pinnedTabs.includes(k) ? "pinned" : ""}`} onClick={() => go(k)} data-testid={`cu-tab-${k}`} {...(k === "bin" ? { "data-bin-target": "" } : {})}>
              {pinnedTabs.includes(k) && <Icon name="flag" size={11} className="tab-pin" />}
              {t(`cu.tab.${k}` as Key)}
              {k === "content" && counts.review > 0 && <span className="cu-dot">{counts.review}</span>}
            </button>
          </WithMenu>
        ))}
      </nav>

      {tab === "portal" && (
        <section className="cu-portal">
          <p className="muted small" style={{ margin: "0 0 10px" }}>
            {t("cu.portalHint")}
          </p>
          <PortalPreview
            inline
            customer={c}
            posts={posts}
            settings={settings}
            onClose={() => go("overview")}
            onSaved={(m) => setToast(m)}
            onPostsChange={(p) => setPosts((l) => (l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [...l, p]))}
          />
        </section>
      )}

      {tab === "overview" && (
        <div className="widgets">
          <section className="w span-7 stack">
            <div className="row between">
              <span className="label muted">{t("cu.milestones")}</span>
              {pr.total > 0 && (
                <span className="mono small">
                  {pr.done}/{pr.total} · {pr.pct}%
                </span>
              )}
            </div>
            {isWorkStage(c.stage) ? (
              <>
                <span className="cu-bar big">
                  <i style={{ width: `${pr.pct}%` }} />
                </span>
                <ul className="ms">
                  {MILESTONES[c.stage].map((m) => {
                    const on = c.done.includes(m.code);
                    const mt = milestoneText(m, lang);
                    return (
                      <li key={m.code} className={on ? "done" : ""}>
                        <button className="check sm" role="checkbox" aria-checked={on} onClick={() => update({ done: on ? c.done.filter((x) => x !== m.code) : [...c.done, m.code] })} aria-label={mt.title} />
                        <span>
                          <span className="mono small muted">{m.code}</span> <b>{mt.title}</b>
                          <span className="muted small" style={{ display: "block" }}>
                            {mt.desc}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {pr.done === pr.total && (
                  <button className="btn accent" onClick={() => update({ stage: nextStage(c.stage) })}>
                    {t("cu.advance", { stage: t(`cu.stage.${nextStage(c.stage)}` as Key) })} <Icon name="next" size={14} />
                  </button>
                )}
              </>
            ) : (
              <p className="muted">{t(`cu.stage.${c.stage}` as Key)}</p>
            )}
            <span className="label muted" style={{ marginTop: 18 }}>
              {t("po.journey")}
            </span>
            <Journey stage={c.stage} />
          </section>

          <section className="w span-5 stack">
            <label className="field">
              <span>{t("cu.contact")}</span>
              <input className="input" value={c.contact} onChange={(e) => update({ contact: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("cu.email")}</span>
              <input className="input" type="email" value={c.email} onChange={(e) => update({ email: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("cu.phone")}</span>
              <input className="input" type="tel" value={c.phone} onChange={(e) => update({ phone: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("cu.handle")}</span>
              <input className="input" value={c.instagram.handle} onChange={(e) => update({ instagram: { ...c.instagram, handle: cleanHandle(e.target.value) } })} placeholder="mediamarques" />
            </label>
            <label className="field">
              <span>{t("cu.lang")}</span>
              <Select className="select" value={c.lang} onChange={(e) => update({ lang: e.target.value as Customer["lang"] })}>
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </Select>
            </label>
            <label className="row" style={{ gap: 10 }}>
              <button className="check sm" role="checkbox" aria-checked={c.contract_signed} onClick={() => update({ contract_signed: !c.contract_signed })} />
              {t("cu.contract")}
            </label>
            <BillingCard c={c} onChange={(billing) => update({ billing })} />
            <label className="field">
              <span>
                {t("cu.notes")} · {t("cu.notesHint")}
              </span>
              <textarea className="textarea" rows={4} value={c.notes} onChange={(e) => update({ notes: e.target.value })} />
            </label>
            <button className="btn ghost danger" onClick={remove} style={{ alignSelf: "flex-start" }}>
              {t("fin.delete")}
            </button>
          </section>
        </div>
      )}

      {tab === "content" && (
        <section className="w stack">
          <div className="row between">
            <div className="row" style={{ gap: 6 }}>
              <div className="seg" role="group">
                <button aria-pressed={cview === "board"} onClick={() => setCview("board")}>
                  {t("pr.kanban")}
                </button>
                <button aria-pressed={cview === "list"} onClick={() => setCview("list")}>
                  {t("pr.table")}
                </button>
              </div>
              {cview === "list" && <>
              <button className={`chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>
                {t("ct.all")} · {posts.length}
              </button>
              {POST_STATUSES.filter((s) => counts[s]).map((s) => (
                <button key={s} className={`chip ${filter === s ? "on" : ""}`} onClick={() => setFilter(s)}>
                  {t(`ct.status.${s}` as Key)} · {counts[s]}
                </button>
              ))}
              </>}
            </div>
            <div className="row" style={{ gap: 6 }}>
              {POST_TYPES.map((ty) => (
                <button key={ty} className="btn small" onClick={() => newPost(ty)}>
                  + {t(`ct.type.${ty}` as Key)}
                </button>
              ))}
            </div>
          </div>
          {cview === "board" ? (
            <ContentBoard
              posts={posts}
              onOpen={setEditing}
              onDelete={trash.remove}
              clientOf={() => ({ name: c.name, photo: c.cover || c.instagram.picture })}
              showOwner
              process={c.process}
              onMove={async (id, stage) => {
                const p = posts.find((x) => x.id === id);
                if (!p) return;
                const next = stageMove(p, stage, moveToPhase);
                setPosts((l) => l.map((x) => (x.id === id ? next : x)));
                await customerStore.savePost(next).catch((e) => setToast((e as Error).message));
              }}
              onCreate={async (stage, title, type) => {
                // cartão rápido na etapa escolhida (abre o editor para completar)
                const p = stageMove({ ...emptyPost(c.id, type), title, internal: true }, stage, moveToPhase);
                const saved = await customerStore.savePost(p).catch((e) => (setToast((e as Error).message), null));
                if (saved) setPosts((l) => (l.some((x) => x.id === saved.id) ? l.map((x) => (x.id === saved.id ? saved : x)) : [...l, saved]));
              }}
            />
          ) : shown.length === 0 ? (
            <p className="muted">{t("ct.empty")}</p>
          ) : (
            shown.map((p) => <PostRow key={p.id} p={p} onOpen={setEditing} onDelete={trash.remove} />)
          )}
        </section>
      )}

      {tab === "calendar" && (
        <section className="stack">
          <div className="seg" role="group" style={{ alignSelf: "flex-start" }}>
            <button aria-pressed={calView === "agenda"} onClick={() => setCalView("agenda")}>
              Agenda
            </button>
            <button aria-pressed={calView === "month"} onClick={() => setCalView("month")}>
              {t("cal.month")}
            </button>
          </div>
          {calView === "agenda" ? (
            <AgendaCalendar posts={posts} onOpen={setEditing} />
          ) : (
            <section className="w">
              <ContentCalendar posts={posts} onOpen={setEditing} onDay={(d) => newPost("reel", d)} />
            </section>
          )}
        </section>
      )}

      {tab === "grid" && (
        <section className="w">
          <GridPreview
            customer={c}
            posts={posts}
            onOpen={setEditing}
            onCover={async (p, f) => {
              try {
                const m = await uploadMedia(f, `customers/${c.id}`);
                await savePost({ ...p, cover: m.src });
                setToast(t("gr.coverSaved"));
              } catch (e) {
                setToast((e as Error).message);
              }
            }}
          />
        </section>
      )}

      {tab === "metrics" && (
        <section className="w">
          <Metrics ig={c.instagram} igConnect={!!status?.instagram} onSync={sync} busy={busy} />
        </section>
      )}

      {tab === "tasks" && (
        <TaskBoard
          tasks={c.tasks ?? []}
          people={[{ name: c.contact || c.name, email: c.email }, ...(c.billing?.email && c.billing.email !== c.email ? [{ name: c.billing.contact || c.name, email: c.billing.email }] : [])].filter((x) => x.email)}
          me={{ name: user?.name || "MediaMarques", email: user?.email || "contact@mediamarques.com" }}
          posts={posts}
          side="studio"
          onOpenPost={setEditing}
          onSave={async (changed) => {
            const next = { ...c, tasks: mergeTasks(c.tasks, changed) };
            setC(next);
            await customerStore.save(next).catch((e) => setToast(e.message));
          }}
        />
      )}

      {tab === "brand" && (
        <BrandEditor
          value={c.brand}
          name={c.name}
          onSave={async (b) => {
            const next = { ...c, brand: { ...b, updated_at: new Date().toISOString() } };
            setC(next);
            await customerStore.save(next);
          }}
        />
      )}

      {tab === "inspiration" && <ClientInspiration c={c} onChange={setC} />}

      {tab === "documents" && <DocumentsHub customerId={c.id} onToast={setToast} />}

      {tab === "process" && (
        <div className="stack" style={{ gap: "var(--gap)" }}>
          <ProcessEditor
            value={c.process}
            onSave={async (process) => {
              const next = { ...c, process };
              setC(next);
              await customerStore.save(next);
            }}
          />
          <ClientJsonImport
            customer={c}
            by={user?.name || "MediaMarques"}
            onApply={async (next, newPosts, parts) => {
              setC(next);
              await customerStore.save(next);
              for (const p of newPosts) await customerStore.savePost(p);
              await load();
              setToast(t("ij.done", { parts: parts.join(", ") }));
            }}
          />
        </div>
      )}

      {tab === "access" && (
        <div className="widgets">
          <PortalUsers customer={c} onChanged={load} onToast={setToast} />

          <section className="w span-5 stack">
            <div className="row between">
              <span className="label muted">{t("cu.plan")}</span>
              <span className={`label ${ps === "paid" ? "tone-ok" : ps === "due" ? "tone-warn" : "muted"}`}>{t(`cu.plan.${ps}` as Key)}</span>
            </div>
            <div className="num">
              {money(monthlyFee(c, settings))} <span className="muted small">{t("cu.perMonth")}</span>
            </div>
            <label className="row" style={{ gap: 10 }}>
              <button className="check sm" role="checkbox" aria-checked={c.plan.active} onClick={() => update({ plan: { ...c.plan, active: !c.plan.active } })} />
              {t("cu.planActive")}
            </label>
            <label className="field">
              <span>{t("cu.planPrice")}</span>
              <input
                className="input"
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                placeholder={t("cu.planDefault", { price: money(settings.price) })}
                value={c.plan.price ?? ""}
                onChange={(e) => update({ plan: { ...c.plan, price: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) } })}
              />
            </label>
            <label className="field">
              <span>{t("cu.paidUntil")}</span>
              <input className="input" type="date" value={c.plan.paid_until} onChange={(e) => update({ plan: { ...c.plan, paid_until: e.target.value } })} />
            </label>
            <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => update({ plan: { ...c.plan, since: c.plan.since || isoDay(), paid_until: addPaidMonth(c.plan.paid_until, isoDay()) } })}>
              {t("cu.markPaid")}
            </button>
          </section>
        </div>
      )}

      {editing && (
        <PostEditor
          post={editing}
          others={posts}
          settings={settings}
          canPublish={!!status?.instagram && c.instagram.connected}
          onSave={savePost}
          onDelete={removePost}
          onPublish={publish}
          account={{ handle: c.instagram.handle, picture: c.instagram.picture || c.cover }}
          moodboards={c.moodboards ?? []}
          onClose={() => {
            setEditing(null);
            if (postParam) router.replace(`/clientes/${id}?tab=content`, { scroll: false });
          }}
        />
      )}
      {tab === "bin" && (
        <section className="cu-bin" data-testid="client-bin">
          <BinView customerId={c.id} customers={[c]} onChange={load} />
        </section>
      )}
      {trash.modal}
      <Toast msg={toast} />
    </AppShell>
  );
}
