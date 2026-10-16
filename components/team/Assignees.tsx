"use client";

// Responsáveis de uma tarefa: avatares empilhados; clicar abre a lista da equipa para marcar/desmarcar e permite
// registar outra pessoa por email. Guardado em task.mentions (todos) e task.assignee (o primeiro = principal).
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useMenu } from "@/components/LangMenu";
import { useT } from "@/lib/i18n";
import type { Person } from "@/lib/studio";
import { PlusIcon } from "lucide-react";
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

/**
 * Responsável ÚNICO (tarefas, conteúdos, regras): grupo de avatares como no shadcn (AvatarGroup + AvatarGroupCount com
 * PlusIcon) — o avatar de quem é responsável e um "+" que abre a equipa para escolher. Escolher fecha o menu.
 */
export function AssigneePicker({
  value,
  people,
  onChange,
  size = 26,
  allowNone = true,
  label,
}: {
  value?: string;
  people: { email: string; name: string; photo?: string; role?: string }[];
  onChange: (email: string | undefined) => void;
  size?: number;
  /** "Sem responsável" (as regras de automação exigem alguém). */
  allowNone?: boolean;
  label?: string;
}) {
  const { t } = useT();
  const { open, setOpen, ref } = useMenu();
  const [email, setEmail] = useState("");
  const cur = (value ?? "").toLowerCase();
  const person = (e: string) => people.find((p) => p.email.toLowerCase() === e) ?? { email: e, name: e.split("@")[0], photo: "", role: "" };
  const who = cur ? person(cur) : null;
  const pick = (e: string | undefined) => {
    onChange(e);
    setOpen(false);
  };
  const list = [...people, ...(cur && !people.some((p) => p.email.toLowerCase() === cur) ? [person(cur)] : [])];

  return (
    <div className="menuwrap asg asg1" ref={ref} data-no-drag onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="asg1-group"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label ?? t("asg.title")}: ${who?.name ?? t("st.nobody")}`}
        title={who ? `${who.name}${who.role ? ` · ${who.role}` : ""}` : t("st.nobody")}
        data-testid="asg1"
      >
        {who && <Avatar name={who.name} photo={who.photo} size={size} />}
        <span className="asg1-count" style={{ width: size, height: size }} aria-hidden>
          <PlusIcon size={Math.round(size * 0.5)} strokeWidth={2} />
        </span>
      </button>
      {open && (
        <div className="menu asg-menu" role="menu">
          <span className="tile-t" style={{ padding: "4px 8px" }}>
            {label ?? t("asg.title")}
          </span>
          {list.map((p) => (
            <button key={p.email} role="menuitemradio" aria-checked={cur === p.email.toLowerCase()} onClick={() => pick(p.email.toLowerCase())} data-testid="asg1-opt">
              <Avatar name={p.name} photo={p.photo} size={20} /> <span className="asg-name">{p.name}</span>
              {p.role && <span className="label muted">{p.role}</span>}
              {cur === p.email.toLowerCase() && (
                <span className="menu-check">
                  <Icon name="check" size={14} />
                </span>
              )}
            </button>
          ))}
          {allowNone && cur && (
            <button role="menuitemradio" aria-checked={false} onClick={() => pick(undefined)} data-testid="asg1-none">
              <span className="asg-empty" style={{ width: 20, height: 20 }}>
                <Icon name="close" size={11} />
              </span>
              <span className="asg-name">{t("st.nobody")}</span>
            </button>
          )}
          <form
            className="asg-add"
            onSubmit={(e) => {
              e.preventDefault();
              const v = email.trim().toLowerCase();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return;
              setEmail("");
              pick(v);
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
