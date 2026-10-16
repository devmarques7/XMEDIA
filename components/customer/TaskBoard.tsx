"use client";

// Tarefas (to-dos) do cliente e do estúdio: criar com @menções, ligar a um conteúdo, prazo, marcar feita.
// Mesmo componente no portal (cliente) e na ficha do cliente (estúdio, com tarefas internas).
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { useMemo, useState } from "react";
import type { ContentPost } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { newTask, parseMentions, type Task } from "@/lib/tasks";

type Person = { name: string; email: string };
type Filter = "open" | "mine" | "done" | "all";

export function TaskBoard({ tasks, people, me, posts, side, readOnly, onSave, onOpenPost }: { tasks: Task[]; people: Person[]; me: Person; posts: ContentPost[]; side: Task["side"]; readOnly?: boolean; onSave: (changed: Task[]) => Promise<unknown>; onOpenPost?: (p: ContentPost) => void }) {
  const { t, locale } = useT();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [postId, setPostId] = useState("");
  const [internal, setInternal] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const [busy, setBusy] = useState(false);
  const visible = tasks.filter((x) => !x.deleted);
  const mineKey = me.email.toLowerCase();
  const shown = useMemo(
    () => visible.filter((x) => (filter === "open" ? !x.done : filter === "done" ? x.done : filter === "mine" ? !x.done && x.mentions.includes(mineKey) : true)),
    [visible, filter, mineKey]
  );
  const suggest = useMemo(() => {
    const m = /@([\p{L}\p{N}._-]*)$/u.exec(title);
    if (!m) return [];
    const q = m[1].toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().startsWith(q)).slice(0, 5);
  }, [title, people]);

  async function save(changed: Task[]) {
    setBusy(true);
    try {
      await onSave(changed.map((x) => ({ ...x, updated: new Date().toISOString() })));
    } finally {
      setBusy(false);
    }
  }
  async function add() {
    if (!title.trim()) return;
    const task = newTask({ title, by: me.name || me.email, side, due, post_id: postId, mentions: parseMentions(title, people), ...(internal ? { internal: true } : {}) });
    setTitle("");
    setDue("");
    setPostId("");
    await save([task]);
  }
  const who = (email: string) => people.find((p) => p.email.toLowerCase() === email)?.name || email.split("@")[0];
  const postOf = (id: string) => posts.find((p) => p.id === id);

  return (
    <section className="widgets" style={{ padding: 0 }}>
      <div className="w span-12 stack">
        <div className="row between">
          <div>
            <span className="tile-t">{t("tk.title")}</span>
            <p className="muted small" style={{ margin: "6px 0 0" }}>
              {t("tk.sub")}
            </p>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {(["open", "mine", "done", "all"] as Filter[]).map((f) => (
              <button key={f} className={`cb-chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
                {t(`tk.${f}` as Key)}{" "}
                <span className="muted">{f === "open" ? visible.filter((x) => !x.done).length : f === "done" ? visible.filter((x) => x.done).length : f === "mine" ? visible.filter((x) => !x.done && x.mentions.includes(mineKey)).length : visible.length}</span>
              </button>
            ))}
          </div>
        </div>

        {readOnly ? null : (
          <div className="tk-new">
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !suggest.length && add()} placeholder={t("tk.new")} data-testid="tk-title" />
              {suggest.length > 0 && (
                <div className="menu" style={{ top: "100%", left: 0, right: "auto" }}>
                  {suggest.map((p) => (
                    <button key={p.email} onClick={() => setTitle(title.replace(/@[\p{L}\p{N}._-]*$/u, `@${p.email.split("@")[0]} `))}>
                      @{p.email.split("@")[0]} <span className="muted small">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label={t("tk.due")} style={{ width: 150 }} />
            <Select className="select" value={postId} onChange={(e) => setPostId(e.target.value)} aria-label={t("tk.post")} style={{ width: 200 }}>
              <option value="">
                {t("tk.post")}: {t("tk.none")}
              </option>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || t(`ct.type.${p.type}` as Key)}
                </option>
              ))}
            </Select>
            {side === "studio" && (
              <label className="row small" style={{ gap: 6 }}>
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> {t("tk.studio")} <Icon name="lock" size={14} />
              </label>
            )}
            <button className="btn accent" onClick={add} disabled={busy || !title.trim()} data-testid="tk-add">
              + {t("tk.add")}
            </button>
          </div>
        )}

        <div className="tk-list">
          {!shown.length && <p className="muted small">{t("tk.empty")}</p>}
          {shown.map((x) => {
            const p = x.post_id ? postOf(x.post_id) : undefined;
            const late = !x.done && x.due && x.due < new Date().toISOString().slice(0, 10);
            return (
              <article key={x.id} className={`tk-item ${x.done ? "done" : ""}`} data-testid="tk-item">
                <button className="check sm" role="checkbox" aria-checked={x.done} aria-label={x.title} disabled={readOnly || busy} onClick={() => save([{ ...x, done: !x.done }])} />
                <span className="tk-body">
                  <b>{x.title}</b>
                  <span className="tk-meta">
                    <span className={`label ${x.side === "studio" ? "" : "muted"}`}>{x.side === "studio" ? t("tk.studio") : t("tk.client")}</span>
                    {x.internal && <span className="label"><Icon name="lock" size={14} /></span>}
                    <span className="muted small">{x.by}</span>
                    {x.mentions.map((m) => (
                      <span key={m} className={`tk-at ${m === mineKey ? "me" : ""}`}>
                        @{who(m)}
                      </span>
                    ))}
                    {p && (
                      <button className={`tk-post ty-${p.type}`} onClick={() => onOpenPost?.(p)}>
                        <Icon name="images" size={14} /> {p.title || t(`ct.type.${p.type}` as Key)}
                      </button>
                    )}
                  </span>
                </span>
                {x.due && <span className={`mono small ${late ? "accent" : "muted"}`}>{new Date(x.due + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "short" })}</span>}
                {!readOnly && (
                  <button className="btn ghost small" onClick={() => save([{ ...x, deleted: true }])} aria-label={t("tk.delete")}>
                    <Icon name="close" size={14} />
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
