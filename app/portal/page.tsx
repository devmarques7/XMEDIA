"use client";

import { DraftPlanner } from "@/components/customer/DraftPlanner";
import { ProductionHistory } from "@/components/customer/ProductionHistory";
import { VaultView } from "@/components/vault/VaultView";
import { PortalDocuments } from "@/components/docs/PortalDocuments";
import { LangMenu } from "@/components/LangMenu";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useErr } from "@/components/customer/PortalChrome";
import { Review } from "@/components/customer/Review";
import { AgendaCalendar } from "@/components/customer/AgendaCalendar";
import { ContentBoard } from "@/components/customer/ContentBoard";
import { PortalDashboard } from "@/components/customer/PortalDashboard";
import { ACCOUNT_SECTIONS, PortalAccount, type AccountSection } from "@/components/customer/PortalAccount";
import { ProcessSummary } from "@/components/customer/PortalHome";
import { TaskBoard } from "@/components/customer/TaskBoard";
import { ValidationPanel } from "@/components/customer/Validation";
import { BrandBookView, BrandEditor } from "@/components/brand/BrandEditor";
import { BRAND_STEPS, type BrandStep } from "@/lib/brand";
import { Tour } from "@/components/Tour";
import { Inspiration } from "@/components/inspiration/ReferenceChannel";
import { EMPTY_REFS } from "@/lib/references";
import type { Task } from "@/lib/tasks";
import { StatusLabel, TypeIcon, useWhen } from "@/components/customer/parts";
import { Icon, type IconName } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { Toast, useToast } from "@/components/ui";
import { canReview, clientReview, openNotes, type ContentPost } from "@/lib/customer";
import { clientDropAction, stageName } from "@/lib/clientProcess";
import { useT, type Key } from "@/lib/i18n";
import { ApiError, portalApi, type PortalData } from "@/lib/portalApi";

// navegação mínima: o dia a dia do cliente (início, produção, calendário) + conta (perfil, equipa, contrato, pagamento)
type Tab = "home" | "production" | "calendar" | "tasks" | "brand" | "inspiration" | "documents" | "vault" | "account";
const TABS: { k: Tab; icon: IconName }[] = [
  { k: "home", icon: "home" },
  { k: "production", icon: "board" },
  { k: "calendar", icon: "calendar" },
  { k: "tasks", icon: "task" },
  { k: "brand", icon: "palette" },
  { k: "inspiration", icon: "layers" },
  { k: "documents", icon: "page" },
  { k: "vault", icon: "key" },
  { k: "account", icon: "user" },
];
/** Links antigos (?tab=content|grid|metrics) continuam a funcionar. */
const LEGACY: Record<string, Tab> = { content: "production", grid: "home", metrics: "home" };

export default function Page() {
  return (
    <Suspense>
      <Portal />
    </Suspense>
  );
}

/** Portal do cliente: jornada, conteúdos (rascunhos, para aprovar, agendados), calendário, grid e métricas. */
function Portal() {
  const { t, locale } = useT();
  const tErr = useErr();
  const when = useWhen();
  const router = useRouter();
  const sp = useSearchParams();
  const raw = sp.get("tab") ?? "home";
  const tab = (TABS.some((x) => x.k === raw) ? raw : LEGACY[raw] ?? "home") as Tab;
  const section = (ACCOUNT_SECTIONS.includes(sp.get("s") as AccountSection) ? sp.get("s") : "profile") as AccountSection;
  const [toast, setToast] = useToast();
  const [data, setData] = useState<PortalData | null>(null);
  const [open, setOpen] = useState<ContentPost | null>(null);
  const [busy, setBusy] = useState(false);
  const [prodTab, setProdTab] = useState<"board" | "plan" | "history">("board");

  const load = useCallback(async () => {
    try {
      const d = await portalApi.me();
      setData(d);
      return d;
    } catch (e) {
      if (e instanceof ApiError && e.message === "unauthorized") router.replace("/portal/login");
      else setToast(tErr(e));
    }
  }, [router, setToast, tErr]);

  useEffect(() => {
    load();
    const ig = sp.get("ig");
    if (ig) setToast(ig === "connected" ? t("mt.connected") : ig === "not_configured" ? t("mt.notConfigured") : t("mt.errorMsg"));
    if (sp.get("saved") === "passcode") setToast(t("po.passcodeSaved"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Navega para um separador (ou "account:company" para uma secção da conta). */
  const go = (to: string) => {
    const [k0, sec] = to.split(":");
    const k = (LEGACY[k0] ?? k0) as Tab;
    router.replace(k === "home" ? "/portal" : `/portal?tab=${k}${sec ? `&s=${sec}` : ""}`, { scroll: false });
    window.scrollTo({ top: 0 });
  };

  const posts = useMemo(() => data?.posts ?? [], [data]);
  const review = posts.filter((p) => p.status === "review");

  if (!data) return <main className="po" />;
  const c = data.customer;

  async function sync() {
    setBusy(true);
    try {
      await portalApi.syncInstagram();
      await load();
    } catch (e) {
      setToast(tErr(e));
    }
    setBusy(false);
  }

  return (
    <main className="po">
      <header className="po-top">
        <button className="po-brand" onClick={() => go("home")} aria-label="XMEDIA">
          <Logo size={20} />
          <b>XMEDIA</b>
        </button>
        <nav className="po-tabs" aria-label="portal" data-tour="nav">
          {TABS.map(({ k, icon }) => (
            <button key={k} aria-current={tab === k ? "page" : undefined} onClick={() => go(k)} data-testid={`tab-${k}`}>
              <Icon name={icon} size={17} />
              <span>{t(`po.tab.${k}` as Key)}</span>
              {k === "production" && review.length > 0 && <i className="cu-dot">{review.length}</i>}
            </button>
          ))}
        </nav>
        <span className="po-right">
          <LangMenu />
          {data.me.role === "viewer" && (
            <a className="po-reader" href={`mailto:${data.info.contact_email}?subject=${encodeURIComponent(`${t("po.reqEditSubject")} · ${c.name}`)}&body=${encodeURIComponent(t("po.reqEditBody", { name: data.me.name || data.me.email }))}`} title={t("po.reqEdit")} data-testid="po-reader">
              <Icon name="eye" size={13} /> <span className="hide-sm">{t("po.reader")}</span> <Icon name="edit" size={12} />
            </a>
          )}
          <button className="po-me" onClick={() => go("account")} title={t("po.tab.account")}>
            <span className="po-me-t hide-sm">
              <b>{data.me.name || data.me.email.split("@")[0]}</b>
              <span className="muted">{c.name}</span>
            </span>
            <span className="cl-av">{(data.me.name || data.me.email).slice(0, 2).toUpperCase()}</span>
          </button>
        </span>
      </header>
      <SetupDot data={data} />

      <div className="po-wrap">
        {tab === "home" && (
          <>
            <section className="po-hero">
              <span className="label muted">{c.name}</span>
              <h1 className="po-name">{t("po.hello", { name: (data.me.name || c.contact || c.name).split(" ")[0] })}</h1>
            </section>
            <PortalDashboard data={data} onOpen={setOpen} go={go} />
            <Tour
              id="portal-home"
              steps={[
                { target: "process", title: t("tour.home.process.t"), text: t("tour.home.process.x") },
                { target: "tiles", title: t("tour.home.tiles.t"), text: t("tour.home.tiles.x") },
                { target: "nav", title: t("tour.home.nav.t"), text: t("tour.home.nav.x") },
              ]}
            />
          </>
        )}

        {tab === "production" && (
          <>
            <section className="po-hero">
              <span className="label muted">{t("ps.title")}</span>
              <h1 className="po-name">{t("po.tab.production")}</h1>
            </section>
            <nav className="td-tabs" role="tablist" style={{ marginBottom: 12 }}>
              {(["board", "plan", "history"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={prodTab === k} onClick={() => setProdTab(k)} data-testid={`prod-${k}`}>
                  {t(`pp2.${k}` as Key)}
                </button>
              ))}
            </nav>
            {prodTab === "board" && (
              <>
                <ProcessSummary posts={posts} process={data.customer.process} />
                <ContentBoard
                  posts={posts}
                  process={data.customer.process}
                  onOpen={setOpen}
                  hideEmpty
                  canMove={(p, to) => !!clientDropAction(p, to)}
              canCreate={(st) => canReview(data.me.role) && st.phases.includes("idea")}
              onCreate={async (_st, title, type) => {
                try {
                  await portalApi.saveDraft({ type, title, caption: "" });
                  setToast(t("dp.saved", { n: 1 }));
                  load();
                } catch (e) {
                  setToast(tErr(e));
                }
              }}
                  onMove={async (id, to) => {
                    const p = posts.find((x) => x.id === id);
                    const action = p && clientDropAction(p, to);
                    if (!p || !action) return;
                    if (action === "changes" && !openNotes(p).some((n) => n.by === "client")) {
                      setOpen(p);
                      return setToast(t("kb.changesWhy"));
                    }
                    setData((d) => d && { ...d, posts: d.posts.map((x) => (x.id === id ? { ...clientReview(x, action, ""), stage: to.id } : x)) });
                    try {
                      await portalApi.review(id, action, "");
                      setToast(t("kb.moved", { col: stageName(to, t) }));
                    } catch (e) {
                      setToast(tErr(e));
                    }
                    load();
                  }}
                />
              </>
            )}
            {prodTab === "plan" && <DraftPlanner posts={posts} readOnly={!canReview(data.me.role)} onSaved={load} onToast={setToast} moodboards={c.moodboards ?? []} />}
            {prodTab === "history" && <ProductionHistory posts={posts} customer={c.name} />}
          </>
        )}

        {tab === "calendar" && (
          <>
            <section className="po-hero" style={{ paddingBottom: 0 }} />
            <AgendaCalendar posts={posts} onOpen={setOpen} />
          </>
        )}

        {tab === "tasks" && (
          <>
            <section className="po-hero">
              <span className="label muted">{c.name}</span>
              <h1 className="po-name">{t("po.tab.tasks")}</h1>
            </section>
            <PortalTasks data={data} onOpen={setOpen} onToast={setToast} reload={load} />
          </>
        )}

        {tab === "brand" && (
          <>
            <section className="po-hero">
              <span className="label muted">{c.name}</span>
              <h1 className="po-name">{t("po.tab.brand")}</h1>
            </section>
{sp.get("s") === "edit" ? (
              <BrandEditor
                value={c.brand}
                name={c.name}
                readOnly={data.me.role === "viewer"}
                initialStep={(BRAND_STEPS as readonly string[]).includes(sp.get("step") ?? "") ? (sp.get("step") as BrandStep) : undefined}
                onView={() => go("brand:view")}
                onSave={async (b) => {
                  await portalApi.saveBrand(b);
                  await load();
                }}
              />
            ) : (
              <BrandBookView value={c.brand} name={c.name} canEdit={data.me.role !== "viewer"} onEdit={(step) => router.replace(`/portal?tab=brand&s=edit${step ? `&step=${step}` : ""}`, { scroll: false })} />
            )}
          </>
        )}

        {tab === "vault" && (
          <>
            <section className="po-hero">
              <span className="label muted">{c.name}</span>
              <h1 className="po-name">{t("po.tab.vault")}</h1>
            </section>
            <VaultView side="portal" onToast={setToast} />
          </>
        )}

        {tab === "documents" && (
          <>
            <section className="po-hero">
              <span className="label muted">{c.name}</span>
              <h1 className="po-name">{t("po.tab.documents")}</h1>
            </section>
            <PortalDocuments email={data.me.email} readOnly={data.me.role === "viewer"} onToast={setToast} />
          </>
        )}

        {tab === "inspiration" && (
          <>
            <section className="po-hero">
              <span className="label muted">{c.name}</span>
              <h1 className="po-name">{t("po.tab.inspiration")}</h1>
            </section>
            <Inspiration
              boards={c.moodboards ?? []}
              refs={c.references ?? EMPTY_REFS}
              readOnly={data.me.role === "viewer"}
              me={data.me.name || data.me.email}
              io={{ upload: (f) => portalApi.upload(f), preview: (u) => portalApi.linkPreview(u) }}
              onSaveBoards={async (b) => {
                const boards = await portalApi.saveBoards(b);
                setData((d) => (d ? { ...d, customer: { ...d.customer, moodboards: boards } } : d));
              }}
              onSaveRefs={async (r) => {
                const references = await portalApi.saveRefs(r);
                setData((d) => (d ? { ...d, customer: { ...d.customer, references } } : d));
              }}
            />
          </>
        )}

        {tab === "account" && (
          <>
            <section className="po-hero">
              <span className="label muted">{c.name}</span>
              <h1 className="po-name">{t("po.tab.account")}</h1>
            </section>
            <PortalAccount
              data={data}
              section={section}
              onSection={(s2) => router.replace(`/portal?tab=account&s=${s2}`, { scroll: false })}
              onToast={setToast}
              reload={load}
              onSync={sync}
              busy={busy}
            />
          </>
        )}
      </div>

      {open && (
        <PostView
          post={open}
          canAct={canReview(data.me.role)}
          onClose={() => setOpen(null)}
          onDone={async (msg) => {
            setOpen(null);
            setToast(msg);
            await load();
          }}
          when={when}
        />
      )}
      <Toast msg={toast} />
    </main>
  );
}

/**
 * Detalhe de um conteúdo para o cliente: comentar no ponto exato da imagem ou no frame do vídeo
 * (como no Figma), e aprovar ou pedir alterações.
 */
function PostView({ post, canAct, onClose, onDone, when }: { post: ContentPost; canAct: boolean; onClose: () => void; onDone: (msg: string) => void; when: (iso: string) => string }) {
  const { t } = useT();
  const tErr = useErr();
  const [p, setP] = useState(post);
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pins = p.notes.filter((n) => !n.done).length;

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && !(e.target instanceof HTMLTextAreaElement) && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  async function act(action: "approve" | "changes") {
    setBusy(true);
    setErr("");
    try {
      await portalApi.review(p.id, action, text);
      onDone(action === "approve" ? t("ct.approvedMsg") : t("ct.changesMsg"));
    } catch (e) {
      setErr(tErr(e));
      setBusy(false);
    }
  }
  const run = async (f: () => Promise<ContentPost>) => {
    setErr("");
    try {
      setP(await f());
    } catch (e) {
      setErr(tErr(e));
    }
  };

  return (
    <div className="overlay ov-top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog pv" role="dialog" aria-modal="true">
        <header className="row between">
          <span className="row" style={{ gap: 8 }}>
            <TypeIcon type={p.type} /> <b>{p.title || t(`ct.type.${p.type}` as Key)}</b> <StatusLabel status={p.status} />
          </span>
          <button className="btn ghost" onClick={onClose} aria-label={t("ct.close")}>
            <Icon name="close" />
          </button>
        </header>

        <Review
          post={p}
          mode="client"
          canAdd={canAct && p.status === "review"}
          onAdd={(n) => run(() => portalApi.note(p.id, n))}
          onRemove={(n) => run(() => portalApi.removeNote(p.id, n.id))}
          onMove={canAct && p.status === "review" ? (n, to) => run(() => portalApi.moveNote(p.id, n.id, to)) : undefined}
        />
        {p.status === "review" && (
          <ValidationPanel
            post={p}
            canAct={canAct}
            onValidate={async (key, value) => {
              try {
                const validation = await portalApi.validate(p.id, key, value);
                setP((x) => ({ ...x, validation }));
              } catch (e) {
                setErr(tErr(e));
              }
            }}
            onNote={(text) => run(() => portalApi.note(p.id, { text, media: 0 }))}
          />
        )}
        {canAct && p.status === "review" && (
          <Tour
            id="portal-review"
            steps={[
              { target: "rv-media", title: t("tour.review.media.t"), text: t("tour.review.media.x") },
              { target: "rv-check", title: t("tour.review.check.t"), text: t("tour.review.check.x") },
              { target: "rv-act", title: t("tour.review.act.t"), text: t("tour.review.act.x") },
            ]}
          />
        )}

        <div className="stack">
          <span className="label muted">
            <Icon name="clock" size={13} /> {p.status === "published" ? when(p.published_at || p.scheduled_at) : p.scheduled_at ? when(p.scheduled_at) : t("ct.noDate")}
          </span>
          {p.caption && <p className="pv-caption">{p.caption}</p>}
          {p.first_comment && (
            <p className="muted small">
              {t("ct.firstComment")}: {p.first_comment}
            </p>
          )}
          {p.permalink && (
            <a className="btn ghost" href={p.permalink} target="_blank" rel="noreferrer">
              {t("ct.viewOnIg")} <Icon name="arrow" size={14} />
            </a>
          )}
          {p.feedback.filter((f) => f.text).length > 0 && (
            <section className="stack">
              <span className="label muted">{t("ct.feedback")}</span>
              {p.feedback
                .filter((f) => f.text)
                .map((f) => (
                  <div key={f.id} className={`fb ${f.by}`}>
                    <span className="label muted">
                      {f.by === "client" ? f.author || t("ct.client") : t("ct.studio")} · {when(f.at)}
                    </span>
                    <p>{f.text}</p>
                  </div>
                ))}
            </section>
          )}
          {canAct && p.status === "review" && (
            <section className="stack pv-actions" data-tour="rv-act">
              {asking && <textarea className="textarea" rows={3} placeholder={t("ct.changesPh")} value={text} onChange={(e) => setText(e.target.value)} autoFocus />}
              <div className="row">
                <button className="btn accent" onClick={() => act("approve")} disabled={busy}>
                  <Icon name="check" size={14} /> {t("ct.approve")}
                </button>
                {asking || pins > 0 ? (
                  <button className="btn" onClick={() => act("changes")} disabled={busy || (!text.trim() && pins === 0)}>
                    {pins > 0 ? t("rv.sendChanges", { n: pins }) : t("ct.changes")} <Icon name="next" size={14} />
                  </button>
                ) : (
                  <button className="btn" onClick={() => setAsking(true)}>
                    {t("ct.changes")}
                  </button>
                )}
                {pins > 0 && !asking && (
                  <button className="btn ghost small" onClick={() => setAsking(true)}>
                    + {t("rv.generalNote")}
                  </button>
                )}
              </div>
            </section>
          )}
          {err && <p className="note tone-danger">{err}</p>}
        </div>
      </div>
    </div>
  );
}

/** Tarefas no portal: as do cliente e as partilhadas pelo estúdio; menções às pessoas da equipa. */
function PortalTasks({ data, onOpen, onToast, reload }: { data: PortalData; onOpen: (p: ContentPost) => void; onToast: (m: string) => void; reload: () => Promise<unknown> }) {
  const tErr = useErr();
  const [people, setPeople] = useState<{ name: string; email: string }[]>([]);
  const [tasks, setTasks] = useState<Task[]>(data.customer.tasks ?? []);
  useEffect(() => setTasks(data.customer.tasks ?? []), [data]);
  useEffect(() => {
    portalApi
      .team()
      .then((u) => setPeople([...u.map((x) => ({ name: x.name || x.email, email: x.email })), { name: "MediaMarques", email: data.info.contact_email }]))
      .catch(() => {});
  }, [data.info.contact_email]);
  return (
    <TaskBoard
      tasks={tasks}
      people={people}
      me={{ name: data.me.name || data.me.email, email: data.me.email }}
      posts={data.posts}
      side="client"
      readOnly={data.me.role === "viewer"}
      onOpenPost={onOpen}
      onSave={async (changed) => {
        try {
          setTasks(await portalApi.saveTasks(changed));
          reload();
        } catch (e) {
          onToast(tErr(e));
        }
      }}
    />
  );
}

/** Registo por concluir (email Google / Instagram): bolinha discreta no canto inferior direito; abre ao clicar. */
function SetupDot({ data }: { data: PortalData }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const email = !data.me.email_verified;
  const ig = data.me.role === "owner" && !data.customer.instagram.connected;
  if (!email && !ig) return null;
  return (
    <div className={`po-dot ${open ? "open" : ""}`} data-testid="ob-dot">
      {open && (
        <div className="po-dot-card" role="dialog" aria-label={t("ob.finishTitle")}>
          <b>{t("ob.finishTitle")}</b>
          <span className="muted small">{email ? t("ob.finishEmail") : t("ob.finishIg")}</span>
          <span className="row" style={{ gap: 6 }}>
            {email && (
              <a className="btn small accent" href="/portal/bem-vindo">
                {t("ob.verifyEmail")}
              </a>
            )}
            {ig && (
              <a className="btn small" href="/portal/bem-vindo?step=ig">
                <Icon name="instagram" size={14} /> {t("mt.connect")}
              </a>
            )}
          </span>
        </div>
      )}
      <button className="po-dot-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("ob.finishTitle")} title={t("ob.finishTitle")}>
        {open ? <Icon name="close" size={14} /> : <i />}
      </button>
    </div>
  );
}
