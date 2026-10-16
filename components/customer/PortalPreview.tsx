"use client";

// Pré-visualização do portal do cliente (admin): à esquerda os dados do cliente (fáceis de preencher), à direita o
// portal exatamente como o cliente o vê — as mesmas 6 abas (início, produção, calendário, tarefas, marca, conta). Dados de demonstração só na pré-visualização.
import { flyToBin, useTrash } from "./Trash";
import { Select } from "@/components/Select";
import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { BrandBookView, BrandEditor } from "@/components/brand/BrandEditor";
import type { BrandStep } from "@/lib/brand";
import { mergeTasks } from "@/lib/tasks";
import { ProcessSummary } from "./PortalHome";
import { TaskBoard } from "./TaskBoard";
import { Logo } from "@/components/Logo";
import { CSTAGES, DEFAULT_SETTINGS, cleanHandle, emptyPost, monthlyFee, moveToPhase, type CStage, type ContentPost, type Customer, type PortalSettings } from "@/lib/customer";
import { customerStore } from "@/lib/customerStore";
import { demoInstagram, demoPosts, isDemoPost } from "@/lib/demo";
import { PreviewPost } from "./PreviewPost";
import { PostEditor } from "./PostEditor";
import { LANGS, useT, type Key } from "@/lib/i18n";
import type { PortalData } from "@/lib/portalApi";
import { AgendaCalendar } from "./AgendaCalendar";
import { ContentBoard } from "./ContentBoard";
import { stageMove } from "@/lib/clientProcess";
import { PortalDashboard } from "./PortalDashboard";

// as mesmas abas do portal do cliente
type Tab = "home" | "production" | "calendar" | "tasks" | "brand" | "account";
const PV_TABS: { k: Tab; icon: IconName }[] = [
  { k: "home", icon: "home" },
  { k: "production", icon: "board" },
  { k: "calendar", icon: "calendar" },
  { k: "tasks", icon: "task" },
  { k: "brand", icon: "palette" },
  { k: "account", icon: "user" },
];

/**
 * Vista do portal tal como o cliente a vê. Em modal (pré-visualização com formulário) ou inline na ficha do cliente
 * (inline): o admin trabalha na mesma disposição do portal, com arrastar entre etapas e edição dos conteúdos.
 */
export function PortalPreview({ customer, posts, settings = DEFAULT_SETTINGS, onClose, onSaved, inline, onPostsChange }: { customer: Customer; posts: ContentPost[]; settings?: PortalSettings; onClose: () => void; onSaved: (msg: string) => void; inline?: boolean; onPostsChange?: (p: ContentPost) => void }) {
  const { t, lang } = useT();
  const [c, setC] = useState<Customer>(customer);
  const [demo, setDemo] = useState(false);
  const [followers, setFollowers] = useState(8400);
  const [reach, setReach] = useState(15200);
  const [tab, setTab] = useState<Tab>("home");
  const [brandEdit, setBrandEdit] = useState<{ step?: BrandStep } | null>(null);
  const go = (to: string) => {
    const [k, sec] = to.split(":");
    setTab((PV_TABS.some((x) => x.k === k) ? k : "home") as Tab);
    if (k === "brand") setBrandEdit(sec === "edit" ? {} : null);
  };
  const saveCustomer = async (next: Customer) => {
    setC(next);
    await customerStore.save({ ...customer, ...next, instagram: customer.instagram });
  };
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<ContentPost[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  // apagar: vazio = de vez; com conteúdo = confirmar e lixo (15 dias)
  const trash = useTrash((p, kind) => {
    setRemoved((l) => [...l, p.id]);
    setOpenPost(null);
    onSaved(kind === "trash" ? t("bin.moved") : t("bin.purged"));
  });
  const mine = useMemo(() => [...posts.filter((p) => p.customer_id === customer.id), ...created.filter((x) => !posts.some((p) => p.id === x.id))].filter((p) => !removed.includes(p.id)), [posts, customer.id, created, removed]);
  const [edits, setEdits] = useState<Record<string, ContentPost>>({});
  const [openPost, setOpenPost] = useState<ContentPost | null>(null);
  const [collapsed, setCollapsed] = useState(!!inline);
  useEffect(() => setC(customer), [customer]);
  /** Guarda a alteração: demo só na pré-visualização; conteúdo real grava no cliente. */
  const changePost = async (p: ContentPost) => {
    setEdits((e) => ({ ...e, [p.id]: p }));
    if (!mine.some((x) => x.id === p.id) && !isDemoPost(p)) setCreated((l) => [...l, p]);
    onPostsChange?.(p);
    // grava tudo o que existe no cliente (mesmo conteúdos de exemplo criados); só os de demonstração gerados ficam na vista
    if (!isDemoPost(p) || mine.some((x) => x.id === p.id)) {
      const saved = await customerStore.savePost(p).catch((e) => (onSaved((e as Error).message), null));
      // responsável posto por uma regra de automação
      if (saved && saved.assignee !== p.assignee) setEdits((e) => ({ ...e, [p.id]: { ...p, assignee: saved.assignee } }));
      return saved ?? undefined;
    }
  };

  useEffect(() => {
    if (inline) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, inline]);

  const data: PortalData = useMemo(() => {
    const ig = demo ? demoInstagram(c.instagram.handle, c.name, { followers, reach }) : c.instagram;
    const ps = (demo && !mine.length ? demoPosts(c.id) : mine).filter((p) => !removed.includes(p.id)).map((p) => edits[p.id] ?? p);
    const { notes: _n, ...pc } = c;
    return {
      customer: { ...pc, instagram: ig },
      me: { id: "preview", name: c.contact || c.name, email: c.email, role: "owner" },
      posts: ps.map((p) => ({ ...p, notes: p.notes.filter((n) => n.by === "client" && !n.deleted) })),
      info: { studio_hours: settings.studio_hours, contact_email: settings.contact_email, contact_phone: settings.contact_phone, delivery_days: settings.delivery_days, fee: monthlyFee(c, settings), currency: "EUR", igConnect: true },
    };
  }, [c, demo, followers, reach, mine, settings, edits, removed]);

  const set = (p: Partial<Customer>) => setC((x) => ({ ...x, ...p }));
  async function apply() {
    setBusy(true);
    try {
      await customerStore.save({ ...customer, name: c.name, contact: c.contact, email: c.email, phone: c.phone, lang: c.lang, stage: c.stage, instagram: { ...customer.instagram, handle: c.instagram.handle } });
      onSaved(t("pv.applied"));
    } catch (e) {
      onSaved((e as Error).message);
    }
    setBusy(false);
  }
  async function createDemoPosts() {
    setBusy(true);
    try {
      const list = demoPosts(customer.id);
      for (const p of list) await customerStore.savePost(p);
      onSaved(t("pv.demoPostsDone", { n: list.length }));
    } catch (e) {
      onSaved((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <Wrap inline={inline} onClose={onClose}>
      <div className={`pvw ${inline ? "inline" : ""} ${collapsed ? "collapsed" : ""}`} role={inline ? "region" : "dialog"} aria-modal={inline ? undefined : true} aria-label={t("pv.title")}>
        <aside className="pvw-form">
          <div className="row between">
            <span className="tile-t">{t("pv.title")}</span>
            {inline ? (
              <button className="btn ghost" onClick={() => setCollapsed(true)} aria-label={t("pv.collapse")}>
                <Icon name="collapse" />
              </button>
            ) : (
              <button className="btn ghost" onClick={onClose} aria-label={t("close")}>
                <Icon name="close" />
              </button>
            )}
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            {t("pv.hint")}
          </p>
          <label className="field">
            <span>{t("cu.col.name")}</span>
            <input className="input" value={c.name} onChange={(e) => set({ name: e.target.value })} data-testid="pv-name" />
          </label>
          <label className="field">
            <span>{t("cu.contact")}</span>
            <input className="input" value={c.contact} onChange={(e) => set({ contact: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("cu.email")}</span>
            <input className="input" type="email" value={c.email} onChange={(e) => set({ email: e.target.value })} />
          </label>
          <div className="grid4" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
            <label className="field">
              <span>{t("cu.phone")}</span>
              <input className="input" value={c.phone} onChange={(e) => set({ phone: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("cu.lang")}</span>
              <Select className="select" value={c.lang} onChange={(e) => set({ lang: e.target.value as Customer["lang"] })}>
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <label className="field">
            <span>{t("cu.handle")}</span>
            <input className="input" value={c.instagram.handle} onChange={(e) => set({ instagram: { ...c.instagram, handle: cleanHandle(e.target.value) } })} placeholder="marca" />
          </label>
          <label className="field">
            <span>{t("cu.col.stage")}</span>
            <Select className="select" value={c.stage} onChange={(e) => set({ stage: e.target.value as CStage })}>
              {CSTAGES.map((s) => (
                <option key={s} value={s}>
                  {t(`cu.stage.${s}` as Key)}
                </option>
              ))}
            </Select>
          </label>

          <div className="pvw-demo stack">
            <label className="row small" style={{ gap: 8 }}>
              <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} data-testid="pv-demo" /> {t("pv.demo")}
            </label>
            {demo && (
              <div className="grid4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <label className="field">
                  <span>{t("pv.followers")}</span>
                  <input className="input mono" type="number" value={followers} onChange={(e) => setFollowers(Math.max(0, +e.target.value))} />
                </label>
                <label className="field">
                  <span>{t("pv.reach")}</span>
                  <input className="input mono" type="number" value={reach} onChange={(e) => setReach(Math.max(0, +e.target.value))} />
                </label>
              </div>
            )}
          </div>

          <div className="stack" style={{ marginTop: "auto" }}>
            <button className="btn accent" onClick={apply} disabled={busy} data-testid="pv-apply">
              <Icon name="check" size={14} /> {t("pv.apply")}
            </button>
            {!mine.length && (
              <button className="btn" onClick={createDemoPosts} disabled={busy} data-testid="pv-demo-posts">
                + {t("pv.addDemoPosts")}
              </button>
            )}
          </div>
        </aside>

        <section className="pvw-portal" data-lang={lang}>
          {/* na ficha do cliente (inline) o menu é o do admin (abas da ficha): sem um segundo menu aqui */}
          {!inline && (
          <header className="po-top pvw-top">
            <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
              <button className="pvw-toggle" onClick={() => setCollapsed((x) => !x)} aria-label={collapsed ? t("pv.expand") : t("pv.collapse")} title={collapsed ? t("pv.expand") : t("pv.collapse")} data-testid="pv-collapse">
                <Icon name={collapsed ? "expand" : "collapse"} size={16} />
              </button>
              <span className="po-brand">
                <Logo size={20} />
                <b>XMEDIA</b>
              </span>
            </span>
            <nav className="po-tabs pvw-tabs" aria-label="preview">
              {PV_TABS.map(({ k, icon }) => (
                <button key={k} aria-current={tab === k ? "page" : undefined} onClick={() => go(k)} data-testid={`pv-tab-${k}`}>
                  <Icon name={icon} size={16} />
                  <span>{t(`po.tab.${k}` as Key)}</span>
                </button>
              ))}
            </nav>
            <span className="po-me">
              <span className="po-me-t hide-sm">
                <b>{c.contact || c.name}</b>
                <span className="muted">{c.name}</span>
              </span>
              <span className="cl-av">{(c.contact || c.name).slice(0, 2).toUpperCase()}</span>
            </span>
          </header>
          )}
          <div className="po-wrap" style={{ paddingTop: 12, paddingBottom: 24 }}>
            {tab === "home" && (
              <>
                <section className="po-hero">
                  <span className="label muted">{c.name}</span>
                  <h1 className="po-name">{t("po.hello", { name: (c.contact || c.name).split(" ")[0] || "—" })}</h1>
                </section>
                <PortalDashboard data={data} onOpen={setOpenPost} go={go} />
              </>
            )}
            {tab === "production" && (
              <>
                <ProcessSummary posts={data.posts} process={c.process} />
                <ContentBoard
                  posts={data.posts}
                  process={c.process}
                  onOpen={setOpenPost}
                  clientOf={() => ({ name: c.name, photo: c.cover || c.instagram.picture })}
                  showOwner
                  onDelete={(p) => {
                    // exemplo da pré-visualização: não está guardado — sai só da vista
                    if (isDemoPost(p) && !mine.some((x) => x.id === p.id)) {
                      flyToBin(p.id);
                      setRemoved((l) => [...l, p.id]);
                      return onSaved(t("bin.demoRemoved"));
                    }
                    trash.remove(p);
                  }}
                  hideEmpty={!inline}
                  onCreate={async (stage, title, type) => {
                    const p = stageMove({ ...emptyPost(customer.id, type), title, internal: true }, stage, moveToPhase);
                    await changePost(p);
                  }}
                  onMove={(id, stage) => {
                    const p = data.posts.find((x) => x.id === id);
                    if (p) changePost(stageMove(edits[id] ?? mine.find((x) => x.id === id) ?? p, stage, moveToPhase));
                  }}
                />
              </>
            )}
            {tab === "calendar" && <AgendaCalendar posts={data.posts} onOpen={setOpenPost} />}
            {tab === "tasks" && (
              <TaskBoard
                tasks={c.tasks ?? []}
                people={[{ name: c.contact || c.name, email: c.email }].filter((x) => x.email)}
                me={{ name: "MediaMarques", email: settings.contact_email }}
                posts={data.posts}
                side="studio"
                onSave={async (changed) => saveCustomer({ ...c, tasks: mergeTasks(c.tasks, changed) })}
              />
            )}
            {tab === "brand" &&
              (brandEdit ? (
                <BrandEditor value={c.brand} name={c.name} initialStep={brandEdit.step} onView={() => setBrandEdit(null)} onSave={async (b) => saveCustomer({ ...c, brand: { ...b, updated_at: new Date().toISOString() } })} />
              ) : (
                <BrandBookView value={c.brand} name={c.name} canEdit onEdit={(step) => setBrandEdit({ step })} />
              ))}
            {tab === "account" && <AccountSummary c={c} data={data} />}
          </div>
          {openPost &&
            (isDemoPost(openPost) ? (
              <PreviewPost
                key={openPost.id}
                post={data.posts.find((x) => x.id === openPost.id) ?? openPost}
                ig={data.customer.instagram}
                as="client"
                onChange={changePost}
                onClose={() => setOpenPost(null)}
              />
            ) : (
              // conteúdo real: o editor padrão — upload/entrega de nova versão, revisão com feedback e ajustes, agendamento
              <PostEditor
                key={openPost.id}
                post={edits[openPost.id] ?? mine.find((x) => x.id === openPost.id) ?? openPost}
                others={mine}
                settings={settings}
                canPublish={false}
                onSave={async (p) => {
                  const saved = await changePost(p);
                  onSaved(t("ct.saved"));
                  return saved;
                }}
                onDelete={(p) => trash.remove(p)}
                onPublish={async () => undefined}
                account={{ handle: c.instagram.handle, picture: c.instagram.picture || c.cover }}
                moodboards={c.moodboards ?? []}
                onClose={() => setOpenPost(null)}
              />
            ))}
          {trash.modal}
        </section>
      </div>
    </Wrap>
  );
}

function Wrap({ inline, onClose, children }: { inline?: boolean; onClose: () => void; children: React.ReactNode }) {
  if (inline) return <>{children}</>;
  return (
    <div className="overlay pvw-ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

/** Conta (vista do admin na pré-visualização): empresa, contrato e plano, como o cliente os vê. */
function AccountSummary({ c, data }: { c: Customer; data: PortalData }) {
  const { t, locale } = useT();
  const b = c.billing;
  const money = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(v);
  return (
    <section className="widgets" style={{ padding: 0 }}>
      <div className="w span-6 stack">
        <span className="tile-t">{t("ac.company")}</span>
        <span className="label muted">{c.kind === "person" ? t("ac.kindPerson") : t("ac.kindCompany")}</span>
        {[
          [t("ac.legal"), b?.company],
          ["KVK", b?.kvk],
          ["VAT / BTW", b?.vat],
          [t("cu.billAddress"), b?.address],
          [t("ac.website"), b?.website],
          [t("cu.billEmail"), b?.email],
        ].map(([k, v]) => (
          <div key={k} className="statrow">
            <span className="muted">{k}</span>
            <b style={{ marginLeft: "auto", whiteSpace: "pre-line", textAlign: "right", fontWeight: 400 }}>{v || "—"}</b>
          </div>
        ))}
      </div>
      <div className="w span-6 stack">
        <span className="tile-t">{t("ac.contract")}</span>
        <div className="statrow">
          <span className="muted">{t("ac.contract")}</span>
          <b style={{ marginLeft: "auto", fontWeight: 400 }}>{c.contract_signed ? t("ac.signed") : t("ac.unsigned")}</b>
        </div>
        <div className="statrow">
          <span className="muted">{t("ac.plan")}</span>
          <b style={{ marginLeft: "auto", fontWeight: 400 }}>
            {money(data.info.fee)} {t("cu.perMonth")}
          </b>
        </div>
        <div className="statrow">
          <span className="muted">{t("ac.delivery")}</span>
          <b style={{ marginLeft: "auto", fontWeight: 400 }}>{t("ac.deliveryN", { n: data.info.delivery_days })}</b>
        </div>
      </div>
    </section>
  );
}
