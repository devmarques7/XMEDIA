// Estado do convite de um membro da equipa — uma regra única para a lista, o separador "Convites" e o perfil.
import type { Member } from "./team";

export const INVITE_STATES = ["not_invited", "pending", "expired", "registered", "active", "disabled"] as const;
export type InviteState = (typeof INVITE_STATES)[number];

type M = Pick<Member, "status" | "active" | "email" | "invited_at" | "invite_expires_at" | "registered_at" | "last_login_at">;

/**
 * not_invited: nunca recebeu convite · pending: convidado, ainda não se registou, link válido · expired: link caducou sem
 * registo · registered: registou-se mas ainda não entrou · active: já entrou na plataforma · disabled: desativado.
 */
export function inviteState(m: M, now = new Date()): InviteState {
  if (m.status === "disabled" || m.active === false) return "disabled";
  if (m.last_login_at) return "active";
  if (m.registered_at || m.status === "active") return "registered";
  if (!m.invited_at && m.status !== "invited") return "not_invited";
  if (m.invite_expires_at && new Date(m.invite_expires_at) < now) return "expired";
  return "pending";
}

/** Precisa de ação do admin (enviar, reenviar ou lembrar). */
export const needsInviteAction = (s: InviteState) => s === "not_invited" || s === "pending" || s === "expired" || s === "registered";
export const INVITE_TONE: Record<InviteState, string> = { not_invited: "muted", pending: "tone-warn", expired: "tone-danger", registered: "tone-warn", active: "tone-ok", disabled: "muted" };
