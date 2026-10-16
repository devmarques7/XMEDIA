"use client";

// Select ao estilo shadcn/ui (Radix Select): o mesmo uso que o <select> nativo — filhos <option value>texto</option>
// e onChange(e) com e.target.value — para trocar em todo o sistema sem reescrever cada formulário.
import * as RS from "@radix-ui/react-select";
import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { Icon } from "./Icon";

type Opt = { value: string; label: ReactNode; disabled?: boolean };
const EMPTY = "__empty__";
const enc = (v: unknown) => (v === "" || v === undefined || v === null ? EMPTY : String(v));
const dec = (v: string) => (v === EMPTY ? "" : v);

/** Lê os <option> (também dentro de fragmentos, arrays e <optgroup>). */
function readOptions(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  const walk = (n: ReactNode) =>
    Children.forEach(n, (c) => {
      if (!isValidElement(c)) return;
      const el = c as ReactElement<{ value?: unknown; children?: ReactNode; disabled?: boolean }>;
      if (el.type === "option") {
        const label = el.props.children;
        out.push({ value: enc(el.props.value ?? (typeof label === "string" ? label : "")), label, disabled: el.props.disabled });
      } else if (el.type === Fragment || el.type === "optgroup") walk(el.props.children);
    });
  walk(children);
  return out;
}

type Props = {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  "data-testid"?: string;
  onClick?: (e: React.MouseEvent) => void;
  id?: string;
  name?: string;
};

export function Select({ value, defaultValue, onChange, children, className = "", style, disabled, placeholder, onClick, id, name, ...rest }: Props) {
  const opts = readOptions(children);
  const v = value === undefined ? undefined : enc(value);
  return (
    <RS.Root value={v} defaultValue={defaultValue === undefined ? undefined : enc(defaultValue)} onValueChange={(x) => onChange?.({ target: { value: dec(x) } })} disabled={disabled} name={name}>
      <RS.Trigger className={`sx-trigger ${className}`} style={style} aria-label={rest["aria-label"]} data-testid={rest["data-testid"]} onClick={onClick} onPointerDown={(e) => e.stopPropagation()} id={id}>
        <RS.Value placeholder={placeholder ?? "—"} />
        <RS.Icon className="sx-chev">
          <Icon name="chevronDown" size={15} />
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content className="sx-content" position="popper" sideOffset={6} onClick={(e) => e.stopPropagation()}>
          <RS.ScrollUpButton className="sx-scroll">
            <Icon name="chevronDown" size={14} className="flip-y" />
          </RS.ScrollUpButton>
          <RS.Viewport className="sx-viewport">
            {opts.map((o) => (
              <RS.Item key={o.value} value={o.value} disabled={o.disabled} className="sx-item">
                <RS.ItemText>{o.label}</RS.ItemText>
                <RS.ItemIndicator className="sx-check">
                  <Icon name="check" size={14} />
                </RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
          <RS.ScrollDownButton className="sx-scroll">
            <Icon name="chevronDown" size={14} />
          </RS.ScrollDownButton>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
