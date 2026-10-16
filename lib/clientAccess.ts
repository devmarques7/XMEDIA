// Clientes: estado do acesso ao portal (convite enviado / por enviar / ativo / expirado / revogado), frequência de
// trabalho (recorrente · uma demanda · sem projetos) e etiquetas. Funções puras.
import { phaseOf, type ContentPost, type Customer } from "./customer";

export type Frequency = NonNullable<Customer["frequency"]>;
export const FREQUENCIES: Frequency[] = ["recurring", "one_off", "none"];
export type AccessState = "active" | "invited" | "expired" | "not_sent" | "disabled";

const DAY = 86_400_000;

/** Frequência: a escolhida à mão ou, por omissão, pelos conteúdos (plano ativo ou ≥ 3 conteúdos em 120 dias = recorrente). */
export function frequencyOf(c: Customer, posts: ContentPost[], now = new Date()): { value: Frequency; auto: boolean } {
  if (c.frequency) return { value: c.frequency, auto: false };
  const mine = posts.filter((p) => p.customer_id === c.id);
  const recent = mine.filter((p) => now.getTime() - new Date(p.created_at || p.phase_since || 0).getTime() < 120 * DAY);
  const value: Frequency = c.plan.active || recent.length >= 3 ? "recurring" : mine.length ? "one_off" : "none";
  return { value, auto: true };
}

export function accessOf(c: Customer, now = new Date()): AccessState {
  const s = c.portal.status;
  if (s === "disabled") return "disabled";
  if (s === "active") return "active";
  if (s === "invited") return c.portal.invite_expires_at && new Date(c.portal.invite_expires_at) < now ? "expired" : "invited";
  return "not_sent";
}

/** Sem dashboard mas a trabalhar com frequência: são os primeiros a convidar. */
export const shouldInvite = (c: Customer, posts: ContentPost[]) => accessOf(c) === "not_sent" && frequencyOf(c, posts).value === "recurring";

export const allTags = (cs: Customer[]) => [...new Set(cs.flatMap((c) => c.tags ?? []))].sort((a, b) => a.localeCompare(b));

export const openWork = (c: Customer, posts: ContentPost[]) => posts.filter((p) => p.customer_id === c.id && phaseOf(p) !== "published").length;
