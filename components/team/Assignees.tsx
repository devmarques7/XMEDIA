"use client";

// Responsáveis de uma tarefa: avatares empilhados; clicar abre a lista da equipa para marcar/desmarcar e permite
// registar outra pessoa por email. Guardado em task.mentions (todos) e task.assignee (o primeiro = principal).
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useMenu } from "@/components/LangMenu";
import { useT } from "@/lib/i18n";
import type { Person } from "@/lib/studio";
import { Avatar } from "./Avatar";

export function Assignees({ value, people, onChange, size = 22, labeled }: { value: string[]; people: Person[]; onChange: (emails: string[]) => void; size?: number; /** Mostra os nomes (mais claro numa lista). */ labeled?: boolean }) {
  const { t } = useT();
  const { open, setOpen, ref } = useMenu();
  const [email, setEmail] = useState("");
  const list = [...new Set(value.map((e) => e.toLowerCase()).filter(Boolean))];
  const person = (e: string) => people.find((p) => p.email === e) ?? { email: e, name: e.split("@")[0], photo: "", role: "" };
  const toggle = (e: string) => onChange(list.includes(e) ? list.filter((x) => x !== e) : [...list, e]);
  const others = list.filter((e) => !people.some((p) => p.email === e));

  return (
    <div className="menuwrap asg" ref={ref} data-no-drag>
      <button type="button" className="asg-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t("asg.title")} title={list.map((e) => person(e).name).join(", ") || t("st.nobody")} data-testid="asg-btn">
        {list.length ? (
          <span className={labeled ? "asg-chips" : "av-stack"}>
            {list.slice(0, labeled ? 2 : 3).map((e) =>
              labeled ? (
                <span key={e} className={`asg-chip ${list[0] === e ? "main" : ""}`}>
                  <Avatar name={person(e).name} photo={person(e).photo} size={18} />
                  {person(e).name.split(" ")[0]}
                </span>
              ) : (
                <Avatar key={e} name={person(e).name} photo={person(e).photo} size={size} />
              )
            )}
            {list.length > (labeled ? 2 : 3) && <span className={labeled ? "asg-chip more" : "av av-more"} style={labeled ? undefined : { width: size, height: size }}>+{list.length - (labeled ? 2 : 3)}</span>}
            {labeled && (
              <span className="asg-plus" aria-hidden>
                <Icon name="userPlus" size={12} />
              </span>
            )}
          </span>
        ) : labeled ? (
          <span className="asg-chip none">
            <Icon name="userPlus" size={13} /> {t("asg.assign")}
          </span>
        ) : (
          <span className="asg-empty" style={{ width: size, height: size }}>
            <Icon name="userPlus" size={13} />
          </span>
        )}
      </button>
      {open && (
        <div className="menu asg-menu" role="menu">
          <span className="tile-t" style={{ padding: "4px 8px" }}>
            {t("asg.title")}
          </span>
          {[...people, ...others.map(person)].map((p) => (
            <button key={p.email} role="menuitemcheckbox" aria-checked={list.includes(p.email)} onClick={() => toggle(p.email)}>
              <Avatar name={p.name} photo={p.photo} size={20} /> <span className="asg-name">{p.name}</span>
              {list[0] === p.email && <span className="label muted">{t("asg.main")}</span>}
              {list.includes(p.email) && (
                <span className="menu-check">
                  <Icon name="check" size={14} />
                </span>
              )}
            </button>
          ))}
          <form
            className="asg-add"
            onSubmit={(e) => {
              e.preventDefault();
              const v = email.trim().toLowerCase();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return;
              onChange([...list.filter((x) => x !== v), v]);
              setEmail("");
            }}
          >
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("asg.addPh")} aria-label={t("asg.addPh")} />
            <button className="btn small" aria-label={t("asg.add")}>
              <Icon name="plus" size={13} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
