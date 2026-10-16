"use client";

// "Criar tarefa" rápido (menu de clique direito): título + dia, gravada no cliente (ou interna), opcionalmente ligada a
// um conteúdo. Fica no Hoje de quem a criou.
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { customerStore } from "@/lib/customerStore";
import { useT } from "@/lib/i18n";
import { mergeTasks, newTask } from "@/lib/tasks";
import { team } from "@/lib/team";
import { isoDay } from "@/lib/util";

export function QuickTask({ customer, post, onClose, onDone }: { customer: { id: string; name: string }; post?: { id: string; title: string }; onClose: () => void; onDone: (msg: string) => void }) {
  const { t } = useT();
  const [title, setTitle] = useState(post ? `${post.title}` : "");
  const [due, setDue] = useState(isoDay());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const me = (await team.me().catch(() => ({ email: "" }))).email;
      const task = newTask({ title: title.trim(), by: "MediaMarques", side: "studio", internal: true, due, post_id: post?.id ?? "", assignee: me || undefined, mentions: me ? [me] : [], progress: "todo" });
      const c = await customerStore.get(customer.id);
      if (!c) throw new Error("not_found");
      await customerStore.save({ ...c, tasks: mergeTasks(c.tasks, [task]) });
      onDone(t("qt.created", { name: customer.name }));
      onClose();
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog qt" role="dialog" aria-modal="true" aria-label={t("cm.newTask")} onSubmit={save} data-testid="qt">
        <header className="row between">
          <b>
            {t("cm.newTask")} · <span className="muted">{customer.name}</span>
          </b>
          <button type="button" className="btn ghost small" onClick={onClose} aria-label={t("close")}>
            <Icon name="close" size={14} />
          </button>
        </header>
        {post && (
          <span className="muted small">
            <Icon name="link" size={12} /> {t("qt.linked", { title: post.title })}
          </span>
        )}
        <input ref={input} className="input big" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("qt.ph")} data-testid="qt-title" />
        <label className="field">
          <span>{t("qt.due")}</span>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        {err && <p className="tone-danger small">{err}</p>}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="btn accent" disabled={busy || !title.trim()} data-testid="qt-save">
            <Icon name="plus" size={13} /> {t("cm.newTask")}
          </button>
        </div>
      </form>
    </div>
  );
}
