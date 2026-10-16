"use client";

// Estúdio: o portal do produtor XMEDIA. Toda a produção de todos os clientes num só sítio — tarefas e vídeos,
// quem faz o quê, prazos, o que está parado, comentários por resolver — com filtro por cliente (avatares) e o
// envio da avaliação mensal a todos os clientes.
import { PostEditor } from "@/components/customer/PostEditor";
import { flyToBin, useTrash } from "@/components/customer/Trash";
import { Materials } from "@/components/studio/Materials";
import { Cover, StatusLabel, TypeIcon } from "@/components/customer/parts";
import { DayPlanner } from "@/components/team/DayPlanner";
import Link from "next/link";
import { BoardCard } from "@/components/customer/ContentBoard";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/Shell";
import { Tile } from "@/components/bento";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { Toast, useToast } from "@/components/ui";
import { Avatar } from "@/components/team/Avatar";
import { TaskKanban } from "@/components/team/TaskKanban";
import { WorkloadGrid } from "@/components/team/Workload";
import { TodayList } from "@/components/team/TodayList";
import { isInternal } from "@/lib/today";
import { useStudio } from "@/components/team/useStudio";
import { LOOSE, deadline, isEmptyPost, patchNote, phaseOf, type ContentPost } from "@/lib/customer";
import { feedbackApi } from "@/lib/feedbackApi";
import { roundOf } from "@/lib/feedback";
import { useT, type Key } from "@/lib/i18n";
import { commentStats, daysInPhase, stalled, unresolved, ymd } from "@/lib/studio";

export default function StudioPage() {
  const { t, locale, lang } = useT();
  const [toast, setToast] = useToast();
  const S = useStudio();
  const [client, setClient] = useState<string>("all");
  const [onlyStalled, setOnlyStalled] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [internalOnly, setInternalOnly] = useState(false);
  const [teamPlan, setTeamPlan] = useState(false);
  const [editing, setEditing] = useState<ContentPost | null>(null);
  // KPI → leva à secção e destaca-a
  const [flash, setFlash] = useState("");
  const goTo = (id: string, key: string) => {
    setFlash(key);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => setFlash(""), 1800);
  };
  // rascunhos sem cliente: ficam nas definições (sem lixo próprio — pergunta antes de apagar)
  const removeAny = (p: ContentPost) => {
    if (p.customer_id !== LOOSE) return trash.remove(p);
    if (!isEmptyPost(p) && !confirm(t("loose.deleteAsk"))) return;
    flyToBin(p.id);
    S.patchSettings({ loose_drafts: (S.settings.loose_drafts ?? []).filter((x) => x.id !== p.id) });
    setEditing(null);
  };
  const trash = useTrash((_, kind) => {
    setEditing(null);
    setToast(kind === "trash" ? t("bin.moved") : t("bin.purged"));
    S.reload();
  });

  const customers = useMemo(() => S.customers ?? [], [S.customers]);
  // clientes ativos: plano ativo ou com conteúdos em produção
  const active = customers.filter((c) => c.plan.active || S.posts.some((p) => p.customer_id === c.id && phaseOf(p) !== "published"));
  const pick = <T extends { customer_id: string }>(xs: T[]) => (client === "all" ? xs : xs.filter((x) => x.customer_id === client));
  const posts = pick(S.posts);
  const tasks = pick(S.tasks);
  const inProd = posts.filter((p) => !["published"].includes(phaseOf(p)));
  const stalledList = inProd.filter((p) => stalled(p, S.settings.process));
  const notes = unresolved(posts);
  const today = ymd(new Date());
  const name = (id: string) => customers.find((c) => c.id === id);
  const person = (e?: string) => S.people.find((p) => p.email === (e ?? "").toLowerCase());
  const videos = (onlyStalled ? stalledList : inProd).sort((a, b) => (deadline(a, S.settings.process).due || "9").localeCompare(deadline(b, S.settings.process).due || "9"));

  // avaliação mensal: quem pode receber agora
  const round = roundOf();
  const targets = active.map((c) => ({ c, email: c.billing?.email || c.email, answered: (c.feedback?.requests ?? []).some((r) => r.round === round && r.used_at), last: (c.feedback?.requests ?? []).map((r) => r.sent_at).sort().pop() }));
  const sendable = targets.filter((x) => x.email && !x.answered);

  async function sendMonthly() {
    setSending(true);
    let sent = 0;
    let skipped = targets.length - sendable.length;
    for (const x of sendable) {
      try {
        const r = await feedbackApi.send(x.c, { email: x.email, name: x.c.contact || x.c.name, lang: (x.c.lang as typeof lang) || lang, send: true });
        if (r.sent) sent++;
        else skipped++;
      } catch {
        skipped++;
      }
    }
    setSending(false);
    setConfirm(false);
    setToast(t("st.monthly.done", { sent, skipped }));
    S.reload();
  }

  async function resolve(p: ContentPost, noteId: string) {
    await S.savePost(patchNote(p, noteId, { done: true }));
    setToast(t("st.resolved"));
  }

  if (!S.customers) return <AppShell>{null}</AppShell>;

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("st.sub")}</span>
          <h1 className="h1">{t("st.title")}</h1>
        </div>
      </section>

      {/* filtro por cliente: avatares redondos */}
      <nav className="st-clients" aria-label={t("st.client")}>
        <button className={`st-client ${client === "all" ? "on" : ""}`} onClick={() => setClient("all")} aria-pressed={client === "all"}>
          <span className="av" style={{ width: 44, height: 44 }}>
            <Icon name="grid" size={18} />
          </span>
          <span>{t("st.allClients")}</span>
        </button>
        <button className={`st-client ${client === LOOSE ? "on" : ""}`} onClick={() => setClient(client === LOOSE ? "all" : LOOSE)} aria-pressed={client === LOOSE} data-testid="st-client-loose">
          <span className="st-client-av">
            <span className="av st-loose-av" style={{ width: 44, height: 44 }}>
              <Icon name="layers" size={18} />
            </span>
            {(S.settings.loose_drafts ?? []).length > 0 && <i className="mono">{(S.settings.loose_drafts ?? []).length}</i>}
          </span>
          <span>{t("loose.title")}</span>
        </button>
        {active.map((c) => {
          const n = S.posts.filter((p) => p.customer_id === c.id && phaseOf(p) !== "published").length;
          const late = S.posts.some((p) => p.customer_id === c.id && stalled(p, S.settings.process));
          return (
            <button key={c.id} className={`st-client ${client === c.id ? "on" : ""}`} onClick={() => setClient(client === c.id ? "all" : c.id)} aria-pressed={client === c.id} data-testid="st-client">
              <span className="st-client-av">
                <Avatar name={c.name} photo={c.cover || c.instagram.picture} size={44} ring={late} />
                {n > 0 && <i className="mono">{n}</i>}
              </span>
              <span>{c.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="widgets" style={{ paddingTop: 0 }}>
        <Tile title={t("st.kpi.open")} span={3} className="st-kpi" onClick={() => goTo("st-tasks", "tasks")} value={String(tasks.filter((x) => !x.done).length).padStart(2, "0")} of={`${inProd.length} ${t("st.videos")}`} />
        <Tile title={t("st.kpi.late")} span={2} onClick={() => goTo("st-today", "today")} className={`st-kpi ${tasks.some((x) => !x.done && x.due && x.due < today) ? "st-alert" : ""}`} value={String(tasks.filter((x) => !x.done && x.due && x.due < today).length).padStart(2, "0")} />
        <Tile title={t("st.kpi.stalled")} span={2} className={`st-kpi ${stalledList.length ? "st-alert" : ""}`} value={String(stalledList.length).padStart(2, "0")} onClick={() => (setOnlyStalled(true), goTo("st-videos", "videos"))} />
        <Tile title={t("st.kpi.review")} span={2} className="st-kpi" onClick={() => goTo("st-materials", "materials")} value={String(posts.filter((p) => p.status === "review").length).padStart(2, "0")} />
        <Tile title={t("st.kpi.comments")} span={3} className="st-kpi" onClick={() => goTo("st-comments", "comments")} value={String(notes.length).padStart(2, "0")} of={posts.filter((p) => commentStats(p).open).length + " " + t("st.videos")} />

        {/* materiais do cliente (ou de todos): o que está disponível para fazer, com quem faz */}
        <Materials S={S} client={client} customers={customers} onEdit={setEditing} onDelete={removeAny} onToast={setToast} flash={flash === "materials"} />
        <section className={`w span-12 stack ${flash === "today" ? "st-flash" : ""}`} id="st-today" data-testid="st-today">
          <div className="row between">
            <span className="tile-t">{t("td.widget")}</span>
            <Link href="/tarefas" className="btn ghost small">
              {t("td.open")} <Icon name="arrow" size={14} />
            </Link>
          </div>
          <TodayList S={S} compact max={6} clientId={client === "all" ? undefined : client} />
        </section>

        <section className="w span-12 stack">
          <div className="row between">
            <span className="tile-t">{t("st.team")}</span>
            <button className="btn small accent" onClick={() => setTeamPlan(true)} data-testid="st-plan-team">
              <Icon name="sparkles" size={13} /> {t("dpl.planTeam")}
            </button>
            <Link href="/equipa" className="btn ghost small">
              {t("nav.team")} <Icon name="arrow" size={14} />
            </Link>
          </div>
          <WorkloadGrid people={S.people} posts={S.posts} tasks={S.tasks} entries={S.entries} week={S.week} />
        </section>

        {/* projetos e vídeos */}
        <section className={`w span-8 stack ${flash === "videos" ? "st-flash" : ""}`} id="st-videos">
          <div className="row between">
            <span className="tile-t">{t("st.videosTitle")}</span>
            <button className={`cb-chip ${onlyStalled ? "on" : ""}`} onClick={() => setOnlyStalled((x) => !x)} aria-pressed={onlyStalled}>
              <Icon name="alert" size={13} /> {t("st.onlyStalled")} <span className="muted">{stalledList.length}</span>
            </button>
          </div>
          {!videos.length && <p className="muted small">{t("st.noVideos")}</p>}
          <div className="st-videos">
            {videos.map((p) => {
              const c = name(p.customer_id);
              const d = deadline(p, S.settings.process);
              const cs = commentStats(p);
              const isStalled = stalled(p, S.settings.process);
              const who = person(p.assignee);
              return (
                <article key={p.id} className={`st-video ${isStalled ? "late" : ""}`} data-testid="st-video">
                  <Avatar name={c?.name ?? "?"} photo={c?.cover || c?.instagram.picture} size={34} />
                  <Link href={`/clientes/${p.customer_id}?tab=content&post=${p.id}`} className="st-video-main">
                    <b>{p.title || t(`ct.type.${p.type}` as Key)}</b>
                    <span className="muted small">
                      {c?.name} · {t(`ct.type.${p.type}` as Key)} · {t("st.inPhase", { n: daysInPhase(p) })}
                    </span>
                  </Link>
                  <span className="label muted">{t(`pl.phase.${phaseOf(p)}` as Key)}</span>
                  {d.due && <span className={`mono small ${d.state === "late" ? "accent" : d.state === "warn" ? "tone-warn" : "muted"}`}>{new Date(d.due).toLocaleDateString(locale, { day: "2-digit", month: "short" })}</span>}
                  {cs.all > 0 && (
                    <span className={`mono small ${cs.open ? "tone-warn" : "muted"}`}>
                      <Icon name="chat" size={12} /> {cs.all - cs.open}/{cs.all}
                    </span>
                  )}
                  {isStalled && <span className="label tone-danger">{t("st.stalled")}</span>}
                  <span className="st-who">
                    {who && <Avatar name={who.name} photo={who.photo} size={24} />}
                    <Select className="select" value={(p.assignee ?? "").toLowerCase()} onChange={(e) => S.savePost({ ...p, assignee: e.target.value || undefined })} aria-label={t("st.assignTo")}>
                      <option value="">{t("st.nobody")}</option>
                      {S.people.map((x) => (
                        <option key={x.email} value={x.email}>
                          {x.name}
                        </option>
                      ))}
                    </Select>
                  </span>
                </article>
              );
            })}
          </div>
        </section>

        {/* comentários por resolver */}
        <section className={`w span-4 stack ${flash === "comments" ? "st-flash" : ""}`} id="st-comments">
          <span className="tile-t">{t("st.commentsTitle")}</span>
          {!notes.length && <p className="muted small">{t("st.noComments")}</p>}
          <div className="st-notes">
            {notes.slice(0, 30).map(({ p, n }) => (
              <div key={n.id} className="st-note">
                <span className="muted small">
                  {name(p.customer_id)?.name} · {p.title || t(`ct.type.${p.type}` as Key)}
                  {typeof n.t === "number" && <span className="mono"> · {Math.floor(n.t / 60)}:{String(Math.floor(n.t % 60)).padStart(2, "0")}</span>}
                </span>
                <span>{n.text}</span>
                <span className="row between">
                  <span className="label muted">{n.by === "client" ? t("tk.client") : t("tk.studio")}</span>
                  <button className="btn small" onClick={() => resolve(p, n.id)} data-testid="st-resolve">
                    <Icon name="check" size={13} /> {t("st.resolve")}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* todas as tarefas */}
        <section className={`w span-12 stack ${flash === "tasks" ? "st-flash" : ""}`} id="st-tasks">
          <div className="row between">
            <span className="tile-t">{internalOnly ? t("td.internalTasks") : t("st.allTasks")}</span>
            <div className="seg" role="group" aria-label={t("st.allTasks")}>
              <button aria-pressed={!internalOnly} onClick={() => setInternalOnly(false)}>
                {t("td.f.all")}
              </button>
              <button aria-pressed={internalOnly} onClick={() => setInternalOnly(true)} data-testid="st-internal">
                {t("td.f.internal")}
              </button>
            </div>
          </div>
          <TaskKanban tasks={internalOnly ? S.tasks.filter(isInternal) : tasks} people={S.people} customers={client === "all" ? customers : customers.filter((c) => c.id === client)} me={S.me} onSave={S.saveTask} />
        </section>

        {/* avaliação mensal */}
        <section className="w span-12 st-monthly">
          <div style={{ minWidth: 0 }}>
            <span className="tile-t">{t("st.monthly.title")}</span>
            <p className="muted small" style={{ margin: "6px 0 0" }}>
              {t("st.monthly.sub")}
            </p>
          </div>
          <button className="btn accent" onClick={() => setConfirm(true)} disabled={!sendable.length} data-testid="st-monthly">
            <Icon name="mail" size={14} /> {t("st.monthly.send", { n: sendable.length })}
          </button>
        </section>
      </div>

      {confirm && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !sending && setConfirm(false)}>
          <div className="dialog stack" role="dialog" aria-modal="true" aria-label={t("st.monthly.title")}>
            <span className="tile-t">{t("st.monthly.title")}</span>
            <p style={{ margin: 0 }}>{t("st.monthly.confirm")}</p>
            <ul className="st-targets">
              {targets.map(({ c, email, answered, last }) => (
                <li key={c.id} className={!email || answered ? "muted" : ""}>
                  <Avatar name={c.name} photo={c.cover || c.instagram.picture} size={24} />
                  <b>{c.name}</b>
                  <span className="small">{email || t("st.monthly.noEmail")}</span>
                  {answered && <span className="label muted">{t("st.monthly.answered")}</span>}
                  {last && <span className="mono small muted">{t("st.monthly.last", { date: new Date(last).toLocaleDateString(locale, { day: "2-digit", month: "short" }) })}</span>}
                </li>
              ))}
            </ul>
            <div className="row between">
              <button className="btn ghost" onClick={() => setConfirm(false)} disabled={sending}>
                {t("cancel")}
              </button>
              <button className="btn accent" onClick={sendMonthly} disabled={sending || !sendable.length} data-testid="st-monthly-go">
                <Icon name="send" size={14} /> {t("st.monthly.go")}
              </button>
            </div>
          </div>
        </div>
      )}
      {teamPlan && <DayPlanner S={S} onClose={() => setTeamPlan(false)} />}
      {editing && (
        <PostEditor
          post={editing}
          others={S.posts}
          settings={S.settings}
          canPublish={false}
          onSave={async (p) => {
            if (p.customer_id === LOOSE) {
              const cur = S.settings.loose_drafts ?? [];
              await S.patchSettings({ loose_drafts: cur.some((x) => x.id === p.id) ? cur.map((x) => (x.id === p.id ? p : x)) : [...cur, p] });
              setToast(t("ct.saved"));
              return;
            }
            const saved = await S.savePost(p);
            setToast(t("ct.saved"));
            return saved;
          }}
          onDelete={removeAny}
          onPublish={async () => undefined}
          account={{ handle: name(editing.customer_id)?.instagram.handle, picture: name(editing.customer_id)?.instagram.picture || name(editing.customer_id)?.cover }}
          moodboards={name(editing.customer_id)?.moodboards ?? []}
          onClose={() => setEditing(null)}
        />
      )}
      {trash.modal}
      <Toast msg={toast || S.err} />
    </AppShell>
  );
}

