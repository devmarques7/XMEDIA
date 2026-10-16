"use client";

// Estúdio → Materiais: tudo o que há para produzir, de um cliente ou de todos, agrupado por tipo (Reels,
// Carrosséis, Posts, Stories). Vistas: grelha, tabela e campanha (tipo × etapa: em que etapa está cada vídeo).
// Criar um ou vários rascunhos de uma vez — para um cliente ou "sem cliente" (fica nas definições e pode ser
// atribuído a um cliente depois, ou ficar como modelo).
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { Avatar } from "@/components/team/Avatar";
import { BoardCard } from "@/components/customer/ContentBoard";
import { Cover, StatusLabel, TypeIcon } from "@/components/customer/parts";
import type { useStudio } from "@/components/team/useStudio";
import { LOOSE, POST_TYPES, assignLoose, emptyPost, phaseOf, thumbOf, deadline, type ContentPost, type Customer, type Phase, type PostType } from "@/lib/customer";
import { customerStore } from "@/lib/customerStore";
import { useT, type Key } from "@/lib/i18n";

type S = ReturnType<typeof useStudio>;
type Mat = "todo" | "client" | "ready";
type View = "grid" | "table" | "campaign";
const CAMPAIGN: Phase[] = ["idea", "editing", "client_review", "changes", "approved", "scheduled", "published"];
const GROUP_LIMIT = 8;

const matOf = (p: ContentPost): Mat => {
  const ph = phaseOf(p);
  return ph === "client_review" ? "client" : ph === "approved" || ph === "scheduled" ? "ready" : "todo";
};
const readView = (): View => {
  try {
    const v = localStorage.getItem("xmedia:st:matView");
    return v === "table" || v === "campaign" ? v : "grid";
  } catch {
    return "grid";
  }
};

export function Materials({
  S,
  client,
  customers,
  onEdit,
  onDelete,
  onToast,
  flash,
}: {
  S: S;
  /** "all" | id do cliente | LOOSE ("" = sem cliente) */
  client: string;
  customers: Customer[];
  onEdit: (p: ContentPost) => void;
  onDelete: (p: ContentPost) => void;
  onToast: (m: string) => void;
  flash?: boolean;
}) {
  const { t, locale } = useT();
  const [mat, setMat] = useState<Mat>("todo");
  const [view, setViewState] = useState<View>(readView);
  const [grouped, setGrouped] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const setView = (v: View) => {
    setViewState(v);
    setPage(0);
    try {
      localStorage.setItem("xmedia:st:matView", v);
    } catch {}
  };
  const cust = (id: string) => customers.find((c) => c.id === id);
  const loose = (S.settings.loose_drafts ?? []).filter((p) => !p.deleted_at);
  const isLoose = client === LOOSE;
  // conteúdos do filtro: um cliente, todos, ou os sem cliente
  const all = isLoose ? loose : S.posts.filter((p) => client === "all" || p.customer_id === client);
  const live = all.filter((p) => phaseOf(p) !== "published");
  const list = (isLoose ? all : live.filter((p) => matOf(p) === mat)).sort((a, b) => (deadline(a, S.settings.process).due || "9").localeCompare(deadline(b, S.settings.process).due || "9"));
  const count = (k: Mat) => live.filter((p) => matOf(p) === k).length;
  const person = (e?: string) => S.people.find((p) => p.email === (e ?? "").toLowerCase());

  const assignSelect = (p: ContentPost) => {
    const who = person(p.assignee);
    return (
      <span className="st-mat-who" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} data-no-drag>
        {who ? <Avatar name={who.name} photo={who.photo} size={22} /> : <Icon name="user" size={14} />}
        <Select className="select" value={(p.assignee ?? "").toLowerCase()} onChange={(e) => (isLoose ? saveLoose({ ...p, assignee: e.target.value || undefined }) : S.savePost({ ...p, assignee: e.target.value || undefined }))} aria-label={t("st.assignTo")} data-testid="st-mat-assign">
          <option value="">{t("st.nobody")}</option>
          {S.people.map((x) => (
            <option key={x.email} value={x.email}>
              {x.name}
            </option>
          ))}
        </Select>
      </span>
    );
  };

  // ---------- rascunhos sem cliente ----------
  async function saveLoose(p: ContentPost) {
    const cur = S.settings.loose_drafts ?? [];
    const next = cur.some((x) => x.id === p.id) ? cur.map((x) => (x.id === p.id ? p : x)) : [...cur, p];
    await S.patchSettings({ loose_drafts: next });
  }
  async function moveToClient(p: ContentPost, customerId: string) {
    if (!customerId) return;
    const { post, keep } = assignLoose(p, customerId);
    await customerStore.savePost(post);
    if (!keep) await S.patchSettings({ loose_drafts: (S.settings.loose_drafts ?? []).filter((x) => x.id !== p.id) });
    onToast(t(keep ? "loose.copied" : "loose.moved", { c: cust(customerId)?.name ?? "" }));
    S.reload();
  }
  const looseActions = (p: ContentPost) => (
    <span className="st-loose" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} data-no-drag>
      <Select className="select" value="" onChange={(e) => moveToClient(p, e.target.value)} aria-label={t("loose.assign")} data-testid="loose-assign">
        <option value="">{p.template ? t("loose.useFor") : t("loose.assign")}</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <button className={`cb-chip ${p.template ? "on" : ""}`} onClick={() => saveLoose({ ...p, template: !p.template })} aria-pressed={!!p.template} title={t("loose.templateHint")} data-testid="loose-template">
        <Icon name="layers" size={12} /> {t("loose.template")}
      </button>
    </span>
  );
  const extra = (p: ContentPost) => (
    <>
      {isLoose ? looseActions(p) : null}
      {assignSelect(p)}
    </>
  );
  const card = (p: ContentPost) => (
    <BoardCard key={p.id} p={p} clientInfo={!isLoose && cust(p.customer_id) ? { name: cust(p.customer_id)!.name, photo: cust(p.customer_id)!.cover || cust(p.customer_id)!.instagram.picture } : undefined} onOpen={onEdit} onDelete={onDelete} extra={extra(p)} className={p.template ? "is-template" : ""} />
  );

  // ---------- paginação (vista sem grupos e tabela) ----------
  const PAGE = view === "table" ? 20 : 12;
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const pageItems = list.slice(cur * PAGE, cur * PAGE + PAGE);
  const groups = POST_TYPES.map((ty) => ({ ty, items: list.filter((p) => p.type === ty) })).filter((g) => g.items.length);

  return (
    <section className={`w span-12 stack ${flash ? "st-flash" : ""}`} id="st-materials" data-testid="st-materials">
      <div className="row between st-mat-head">
        <span className="tile-t">
          {t("st.mat.title")}
          {client !== "all" && <span className="muted"> · {isLoose ? t("loose.title") : cust(client)?.name}</span>}
        </span>
        <span className="row" style={{ gap: 8 }}>
          {!isLoose && view !== "campaign" && (
            <div className="seg" role="group" aria-label={t("st.mat.title")}>
              {(["todo", "client", "ready"] as const).map((k) => (
                <button key={k} aria-pressed={mat === k} onClick={() => (setMat(k), setPage(0))} data-testid={`st-mat-${k}`}>
                  {t(`st.mat.${k}` as Key)} <span className="muted">{count(k)}</span>
                </button>
              ))}
            </div>
          )}
          {view !== "campaign" && (
            <button className={`cb-chip ${grouped ? "on" : ""}`} onClick={() => setGrouped((g) => !g)} aria-pressed={grouped} data-testid="st-group">
              <Icon name="layers" size={12} /> {t("st.groupByType")}
            </button>
          )}
          <div className="seg" role="group" aria-label={t("pr.table")}>
            <button aria-pressed={view === "grid"} onClick={() => setView("grid")} aria-label={t("pr.kanban")} title={t("pr.kanban")} data-testid="st-view-grid">
              <Icon name="board" size={14} />
            </button>
            <button aria-pressed={view === "table"} onClick={() => setView("table")} aria-label={t("pr.table")} title={t("pr.table")} data-testid="st-view-table">
              <Icon name="menu" size={14} />
            </button>
            {!isLoose && (
              <button aria-pressed={view === "campaign"} onClick={() => setView("campaign")} aria-label={t("st.campaign")} title={t("st.campaign")} data-testid="st-view-campaign">
                <Icon name="flag" size={14} />
              </button>
            )}
          </div>
          <button className="btn small accent" onClick={() => setCreating(true)} data-testid="st-new">
            <Icon name="plus" size={13} /> {t("st.newContent")}
          </button>
        </span>
      </div>

      {creating && <CreateBox S={S} customers={customers} client={client} onClose={() => setCreating(false)} onDone={(n, first) => (setCreating(false), onToast(t("st.created", { n })), S.reload(), n === 1 && first && onEdit(first))} />}

      {view === "campaign" ? (
        <Campaign posts={all} onOpen={onEdit} clientName={client === "all" ? (id) => cust(id)?.name : undefined} />
      ) : !list.length ? (
        <p className="muted small">{isLoose ? t("loose.empty") : t("st.mat.empty")}</p>
      ) : view === "table" ? (
        <MatTable items={pageItems} isLoose={isLoose} cust={cust} onEdit={onEdit} onDelete={onDelete} assign={assignSelect} looseActions={looseActions} locale={locale} />
      ) : grouped ? (
        <div className="st-groups">
          {groups.map(({ ty, items }) => {
            const more = items.length > GROUP_LIMIT && !open[ty];
            return (
              <section key={ty} className="st-group" data-testid={`st-group-${ty}`}>
                <header className="st-group-head">
                  <TypeIcon type={ty} /> <b>{t(`st.group.${ty}` as Key)}</b> <span className="mono small muted">{String(items.length).padStart(2, "0")}</span>
                </header>
                <div className="st-mats">{(more ? items.slice(0, GROUP_LIMIT) : items).map(card)}</div>
                {items.length > GROUP_LIMIT && (
                  <button className="btn ghost small" onClick={() => setOpen((o) => ({ ...o, [ty]: !o[ty] }))}>
                    {open[ty] ? t("st.showLess") : t("st.showAll", { n: items.length })}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="st-mats">{pageItems.map(card)}</div>
      )}

      {view !== "campaign" && (!grouped || view === "table") && pages > 1 && (
        <nav className="st-pager" aria-label={t("st.pages")}>
          <button className="iconbtn" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label={t("cal.prev")}>
            <Icon name="back" size={14} />
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} className={`st-pg ${i === cur ? "on" : ""}`} onClick={() => setPage(i)} aria-current={i === cur ? "page" : undefined} data-testid="st-page">
              {i + 1}
            </button>
          ))}
          <button className="iconbtn" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label={t("cal.next")}>
            <Icon name="next" size={14} />
          </button>
          <span className="muted small">{t("st.showing", { a: cur * PAGE + 1, b: Math.min(list.length, (cur + 1) * PAGE), n: list.length })}</span>
        </nav>
      )}
    </section>
  );
}

/** Criar um ou vários rascunhos de uma vez (um título por linha), para um cliente ou sem cliente. */
function CreateBox({ S, customers, client, onClose, onDone }: { S: S; customers: Customer[]; client: string; onClose: () => void; onDone: (n: number, first?: ContentPost) => void }) {
  const { t } = useT();
  const [target, setTarget] = useState(client === "all" ? customers[0]?.id ?? LOOSE : client);
  const [type, setType] = useState<PostType>("reel");
  const [titles, setTitles] = useState("");
  const [n, setN] = useState(1);
  const [busy, setBusy] = useState(false);
  const lines = titles
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const total = lines.length || n;
  async function create() {
    setBusy(true);
    const made: ContentPost[] = [];
    const looseNew: ContentPost[] = [];
    for (let i = 0; i < total; i++) {
      const title = lines[i] ?? (total > 1 ? `${t(`ct.type.${type}` as Key)} ${i + 1}` : "");
      const p: ContentPost = { ...emptyPost(target || LOOSE, type), title, internal: true };
      if (target === LOOSE) looseNew.push(p);
      else made.push(await customerStore.savePost(p));
    }
    if (looseNew.length) await S.patchSettings({ loose_drafts: [...(S.settings.loose_drafts ?? []), ...looseNew] });
    setBusy(false);
    onDone(total, made[0] ?? looseNew[0]);
  }
  return (
    <div className="st-create" data-testid="st-create">
      <label className="field">
        <span>{t("st.client")}</span>
        <Select className="select" value={target} onChange={(e) => setTarget(e.target.value)} data-testid="st-create-client">
          <option value={LOOSE}>{t("loose.title")}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="field">
        <span>{t("dp.type")}</span>
        <Select className="select" value={type} onChange={(e) => setType(e.target.value as PostType)}>
          {POST_TYPES.map((x) => (
            <option key={x} value={x}>
              {t(`ct.type.${x}` as Key)}
            </option>
          ))}
        </Select>
      </label>
      <label className="field st-create-n">
        <span>{t("st.howMany")}</span>
        <input className="input" type="number" min={1} max={20} value={lines.length || n} disabled={lines.length > 0} onChange={(e) => setN(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
      </label>
      <label className="field st-create-titles">
        <span>{t("st.titlesHint")}</span>
        <textarea className="textarea" rows={3} value={titles} onChange={(e) => setTitles(e.target.value)} placeholder={t("st.titlesPh")} data-testid="st-create-titles" />
      </label>
      <div className="row" style={{ gap: 8, alignSelf: "flex-end" }}>
        <button className="btn ghost small" onClick={onClose} disabled={busy}>
          {t("cancel")}
        </button>
        <button className="btn small accent" onClick={create} disabled={busy} data-testid="st-create-go">
          <Icon name="plus" size={13} /> {total > 1 ? t("st.createN", { n: total }) : t("st.createOne")}
        </button>
      </div>
      {target === LOOSE && <p className="muted small st-create-note">{t("loose.hint")}</p>}
    </div>
  );
}

/** Campanha: linhas = tipo, colunas = etapa. Em cada célula, os conteúdos dessa etapa. */
function Campaign({ posts, onOpen, clientName }: { posts: ContentPost[]; onOpen: (p: ContentPost) => void; clientName?: (id: string) => string | undefined }) {
  const { t } = useT();
  const types = POST_TYPES.filter((ty) => posts.some((p) => p.type === ty));
  if (!types.length) return <p className="muted small">{t("st.mat.empty")}</p>;
  return (
    <div className="st-camp" data-testid="st-campaign" style={{ ["--cols" as string]: CAMPAIGN.length }}>
      <div className="st-camp-row head">
        <span />
        {CAMPAIGN.map((ph) => (
          <span key={ph} className="st-camp-ph">
            {t(`pl.phase.${ph}` as Key)} <b className="mono">{posts.filter((p) => phaseOf(p) === ph).length}</b>
          </span>
        ))}
      </div>
      {types.map((ty) => (
        <div key={ty} className="st-camp-row">
          <span className="st-camp-type">
            <TypeIcon type={ty} /> {t(`st.group.${ty}` as Key)}
          </span>
          {CAMPAIGN.map((ph) => {
            const items = posts.filter((p) => p.type === ty && phaseOf(p) === ph);
            return (
              <div key={ph} className={`st-camp-cell ${items.length ? "" : "empty"}`}>
                {items.map((p) => (
                  <button key={p.id} className="st-camp-item" onClick={() => onOpen(p)} title={p.title} data-post-card={p.id}>
                    <span className="st-camp-th">
                      <Cover src={thumbOf(p)} />
                    </span>
                    <span className="st-camp-t">
                      {p.title || t(`ct.type.${p.type}` as Key)}
                      {clientName && <span className="muted"> · {clientName(p.customer_id)}</span>}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MatTable({ items, isLoose, cust, onEdit, onDelete, assign, looseActions, locale }: { items: ContentPost[]; isLoose: boolean; cust: (id: string) => Customer | undefined; onEdit: (p: ContentPost) => void; onDelete: (p: ContentPost) => void; assign: (p: ContentPost) => React.ReactNode; looseActions: (p: ContentPost) => React.ReactNode; locale: string }) {
  const { t } = useT();
  return (
    <div className="st-mtable" role="table" data-testid="st-mtable">
      <div className="st-mrow head" role="row">
        <span />
        <span>{t("ph.content")}</span>
        <span>{isLoose ? t("loose.assign") : t("st.client")}</span>
        <span>{t("ph.status")}</span>
        <span>{t("pe.dueFinish")}</span>
        <span>{t("st.assignTo")}</span>
        <span />
      </div>
      {[...items].sort((a, b) => POST_TYPES.indexOf(a.type) - POST_TYPES.indexOf(b.type)).map((p) => (
        <div key={p.id} className="st-mrow" role="row" data-post-card={p.id} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" ? onEdit(p) : (e.key === "Delete" || e.key === "Backspace") && e.target === e.currentTarget && (e.preventDefault(), onDelete(p)))} data-testid="st-mrow">
          <button className="st-mthumb" onClick={() => onEdit(p)} aria-label={t("ct.edit")}>
            <Cover src={thumbOf(p)} />
          </button>
          <button className="st-mtitle" onClick={() => onEdit(p)}>
            <b>{p.title || t(`ct.type.${p.type}` as Key)}</b>
            <span className="muted small">
              <TypeIcon type={p.type} /> {t(`ct.type.${p.type}` as Key)} {p.template && <span className="label muted">{t("loose.template")}</span>}
            </span>
          </button>
          <span className="small">{isLoose ? looseActions(p) : cust(p.customer_id)?.name}</span>
          <span>
            <StatusLabel status={p.status} />
          </span>
          <span className="mono small">{p.due_finish ? new Date(p.due_finish + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "short" }) : "—"}</span>
          <span>{assign(p)}</span>
          <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
            <button className="iconbtn" onClick={() => onEdit(p)} aria-label={t("ct.edit")} title={t("ct.edit")}>
              <Icon name="edit" size={14} />
            </button>
            <button className="iconbtn" onClick={() => onDelete(p)} aria-label={t("bin.delete")} title={t("bin.deleteHint")} data-testid="st-mdel">
              <Icon name="trash" size={14} />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
