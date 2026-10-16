// Próximos passos sugeridos pelo assistente: a última linha "[[ações: A | B]]" vira botões.
/** Separa o texto mostrado das ações (máx. 4). */
const ACTIONS_RE = /\[\[\s*(?:ações|acoes|actions|acties)\s*:\s*([^\]]*)\]\]\s*$/i;
export function splitActions(text: string): { text: string; actions: string[] } {
  const m = ACTIONS_RE.exec(text);
  if (!m) return { text, actions: [] };
  return { text: text.slice(0, m.index).trimEnd(), actions: m[1].split("|").map((x) => x.trim()).filter(Boolean).slice(0, 4) };
}
