"use client";

// Menu de clique direito no padrão do shadcn/ui (Radix Context Menu): ContextMenu, ContextMenuTrigger,
// ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuLabel. Estilos com os tokens da app.
import * as CM from "@radix-ui/react-context-menu";
import type { ComponentProps, ReactNode } from "react";

export const ContextMenu = CM.Root;
export const ContextMenuTrigger = CM.Trigger;

export function ContextMenuContent({ className = "", ...props }: ComponentProps<typeof CM.Content>) {
  return (
    <CM.Portal>
      <CM.Content className={`cm ${className}`} collisionPadding={8} {...props} />
    </CM.Portal>
  );
}

export function ContextMenuItem({ className = "", icon, shortcut, children, ...props }: ComponentProps<typeof CM.Item> & { icon?: ReactNode; shortcut?: string }) {
  return (
    <CM.Item className={`cm-item ${className}`} {...props}>
      {icon && <span className="cm-ic">{icon}</span>}
      <span className="cm-t">{children}</span>
      {shortcut && <span className="cm-k">{shortcut}</span>}
    </CM.Item>
  );
}

export const ContextMenuSeparator = (p: ComponentProps<typeof CM.Separator>) => <CM.Separator className="cm-sep" {...p} />;
export const ContextMenuLabel = (p: ComponentProps<typeof CM.Label>) => <CM.Label className="cm-label" {...p} />;

/** Atalho: envolve um elemento com um menu de clique direito a partir de uma lista de ações. */
export type MenuAction = { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; shortcut?: string } | "sep" | { title: string };
export function WithMenu({ actions, children, asChild = true }: { actions: MenuAction[]; children: ReactNode; asChild?: boolean }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild={asChild}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {actions.map((a, i) =>
          a === "sep" ? (
            <ContextMenuSeparator key={i} />
          ) : "title" in a ? (
            <ContextMenuLabel key={i}>{a.title}</ContextMenuLabel>
          ) : (
            <ContextMenuItem key={i} icon={a.icon} shortcut={a.shortcut} onSelect={a.onSelect} className={a.danger ? "danger" : ""}>
              {a.label}
            </ContextMenuItem>
          )
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
