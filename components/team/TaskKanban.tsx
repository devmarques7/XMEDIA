"use client";

// Kanban de tarefas (A fazer · Em curso · Revisão · Feito) com arrastar entre colunas, responsável e prazo.
// Usado na ficha de cada membro (as tarefas dele) e no Estúdio (todas as tarefas de todos os clientes).
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { useT, type Key } from "@/lib/i18n";
import { newTask } from "@/lib/tasks";
import { TASK_COLS, colOf, taskOwner, withCol, ymd, type Person, type StudioTask, type TaskCol } from "@/lib/studio";
import type { Customer } from "@/lib/customer";
import { useBoardDrag } from "@/lib/useBoardDrag";
import { COMPANY } from "@/lib/today";
import { Avatar } from "./Avatar";
import { AssigneePicker } from "./Assignees";

export function TaskKanban({
  tasks,
  people,
  customers,
  onSave,
  defaultAssignee,
  me,
  compact,
}: {
  tasks: StudioTask[];
  people: Person[];
  customers: Customer[];
  onSave: (t: StudioTask) => Promise<unknown>;
  defaultAssignee?: string;
  me: string;
  compact?: boolean;
}) {
  const { t, locale } = useT();
  const [title, setTitle] = useState("");
  const [cust, setCust] = useState(customers.length === 1 ? customers[0].id : COMPANY);
  const [who, setWho] = useState(defaultAssignee ?? "");
  const [due, setDue] = useState("");
  const today = ymd(new Date());
  const dnd = useBoardDrag({
    onDrop: (id, to) => {
      const x = tasks.find((y) => y.id === id);
      if (x) onSave({ ...x, ...withCol(x, to as TaskCol) });
    },
  });
  const person = (e: string) => people.find((p) => p.email === e);

  async function add() {
    const c = cust === COMPANY ? { id: COMPANY, name: "XMEDIA" } : customers.find((x) => x.id === cust);
    if (!title.trim() || !c) return;
    const task = newTask({ title, by: person(me)?.name || me, side: "studio", due, internal: true, assignee: who || undefined, mentions: who ? [who] : [], progress: "todo" });
    setTitle("");
    setDue("");
    await onSave({ ...task, customer_id: c.id, customer: c.name });
  }

  return (
    <section className="tkb">
      <form
        className="tkb-new"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("tk.new")} data-testid="tkb-title" />
        <Select className="select" value={cust} onChange={(e) => setCust(e.target.value)} aria-label={t("st.client")} style={{ width: 170 }}>
          <option value={COMPANY}>{t("td.internal")}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {!defaultAssignee && (
          <Select className="select" value={who} onChange={(e) => setWho(e.target.value)} aria-label={t("st.assignee")} style={{ width: 160 }}>
            <option value="">{t("st.nobody")}</option>
            {people.map((p) => (
              <option key={p.email} value={p.email}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label={t("tk.due")} style={{ width: 150 }} />
        <button className="btn accent" disabled={!title.trim()} data-testid="tkb-add">
          <Icon name="plus" size={14} /> {t("tk.add")}
        </button>
      </form>

      <div className={`tkb-board ${dnd.board} ${compact ? "compact" : ""}`} data-kb-scroll>
        {TASK_COLS.map((col) => {
          const items = tasks.filter((x) => colOf(x) === col).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
          return (
            <section key={col} {...dnd.col(col)} className={`tkb-col c-${col} ${dnd.col(col).className}`}>
              <header className="tkb-head">
                <span className="tile-t">{t(`st.col.${col}` as Key)}</span>
                <span className="mono small muted">{String(items.length).padStart(2, "0")}</span>
              </header>
              {dnd.over === col && dnd.canDropHere(col) && <div className="kb-slot">{t("kb.dropHere")}</div>}
              {items.map((x) => {
                const owner = person(taskOwner(x));
                const late = !x.done && x.due && x.due < today;
                return (
                  <article key={x.id} className={`tkb-card kb-card ${dnd.card(x.id, col).className} ${late ? "late" : ""}`} data-kb-card={x.id} onPointerDown={dnd.card(x.id, col).onPointerDown} data-testid="tkb-card">
                    <span className="label muted">{x.customer}</span>
                    <b>{x.title}</b>
                    <div className="row between" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <span className={`mono small ${late ? "accent" : "muted"}`}>
                        {x.due ? (
                          <>
                            <Icon name="calendar" size={12} /> {new Date(x.due + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                      <span data-no-drag>
                        <AssigneePicker
                          value={taskOwner(x)}
                          people={people}
                          size={22}
                          onChange={(e) => onSave({ ...x, assignee: e, mentions: e ? [...new Set([e, ...x.mentions])] : x.mentions, updated: new Date().toISOString() })}
                        />
                      </span>
                      {owner && <Avatar name={owner.name} photo={owner.photo} size={24} />}
                    </div>
                  </article>
                );
              })}
              {!items.length && <span className="cb-empty">{t("bd.empty")}</span>}
            </section>
          );
        })}
      </div>
    </section>
  );
}
