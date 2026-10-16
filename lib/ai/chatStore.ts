"use client";

// Estado do assistente fora do React: a conversa continua a correr com o painel minimizado e ao mudar de página
// (o AppShell de cada página volta a montar o AiChat, mas o pedido em curso e o histórico vivem aqui).
import type Anthropic from "@anthropic-ai/sdk";
import { useSyncExternalStore } from "react";
import { ToolInputError } from "./apply";
import { commitWrite, prepareWrite, runRead, type PreparedWrite } from "./exec";
import { WRITE_TOOLS } from "./tools";
import { isLocalMode } from "../store";
import { isoDay } from "../util";

export type Msg = Anthropic.Beta.BetaMessageParam;
type ToolUse = Anthropic.Beta.BetaToolUseBlock;
type Result = Anthropic.Beta.BetaToolResultBlockParam;
export type Pending = { use: ToolUse; prep: PreparedWrite | null; error?: string };
type Reply = { content: Anthropic.Beta.BetaContentBlock[]; stop_reason: string | null; stop_details: { explanation?: string } | null; error?: string };

const LS_HISTORY = "xmedia:ai:history";
export const LS_CODE = "xmedia:ai:code";
const MAX_STEPS = 10;

export type ChatState = {
  history: Msg[];
  busy: boolean;
  /** Código do erro (ai.err.*) ou "refusal". */
  error: string;
  needCode: boolean;
  pending: Pending[] | null;
  /** O que está a fazer agora (uma linha, substituída a cada passo): ferramenta em curso e/ou a frase intermédia. */
  activity: { tool?: string; text?: string };
  open: boolean;
  /** Resposta ou pedido de confirmação chegou com o painel minimizado. */
  unread: boolean;
};

let state: ChatState = { history: [], busy: false, error: "", needCode: false, pending: null, activity: {}, open: false, unread: false };
let loaded = false;
const listeners = new Set<() => void>();
const set = (patch: Partial<ChatState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
let pendingResults: Result[] = [];

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    set({ history: JSON.parse(localStorage.getItem(LS_HISTORY) || "[]") });
  } catch {}
}

function commit(h: Msg[]) {
  set({ history: h });
  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(h.slice(-120)));
  } catch {}
}

/** Fim de um passo visível: se o painel estiver minimizado, marca como não lido (o botão avisa). */
const done = (patch: Partial<ChatState>) => set({ ...patch, busy: false, activity: {}, unread: !state.open });

async function ask(): Promise<Reply> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const c = localStorage.getItem(LS_CODE);
    if (c) headers["x-xmedia-ai-code"] = c;
  } catch {}
  const r = await fetch("/api/ai/chat", { method: "POST", headers, body: JSON.stringify({ messages: state.history }) });
  const j = await r.json().catch(() => ({ error: `http_${r.status}` }));
  if (!r.ok) return { content: [], stop_reason: null, stop_details: null, error: j.error ?? `http_${r.status}` };
  return j;
}

/** Ciclo: pedido → ferramentas de leitura → (pausa para confirmar escritas) → … */
async function loop() {
  set({ busy: true, error: "", activity: {} });
  for (let step = 0; step < MAX_STEPS; step++) {
    let res: Reply;
    try {
      res = await ask();
    } catch {
      res = { content: [], stop_reason: null, stop_details: null, error: "network" };
    }
    if (res.error) {
      if (res.error === "unauthorized" && isLocalMode) set({ needCode: true });
      return done({ error: res.error });
    }
    commit([...state.history, { role: "assistant", content: res.content as Msg["content"] }]);
    if (res.stop_reason === "refusal") return done({ error: "refusal" });
    if (res.stop_reason !== "tool_use") return done({});

    const uses = res.content.filter((b): b is ToolUse => b.type === "tool_use");
    const said = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text.trim()).filter(Boolean).at(-1);
    set({ activity: { tool: uses.at(-1)?.name, text: said?.split("\n")[0] } });
    const results: Result[] = [];
    const writes: Pending[] = [];
    for (const use of uses) {
      const inp = (use.input ?? {}) as Record<string, unknown>;
      try {
        if (WRITE_TOOLS.has(use.name)) writes.push({ use, prep: await prepareWrite(use.name, inp, isoDay()) });
        else results.push({ type: "tool_result", tool_use_id: use.id, content: await runRead(use.name, inp) });
      } catch (e) {
        const msg = e instanceof ToolInputError ? e.message : (e as Error).message;
        if (WRITE_TOOLS.has(use.name)) writes.push({ use, prep: null, error: msg });
        else results.push({ type: "tool_result", tool_use_id: use.id, content: msg, is_error: true });
      }
    }
    if (writes.length) {
      // espera pela decisão do utilizador; decide() continua o ciclo
      pendingResults = results;
      return done({ pending: writes });
    }
    commit([...state.history, { role: "user", content: results }]);
  }
  done({});
}

export const chat = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    ensureLoaded(); // avisa quem acabou de subscrever (histórico guardado)
    return () => listeners.delete(l);
  },
  setOpen(open: boolean) {
    set({ open, ...(open ? { unread: false } : {}) });
  },
  setNeedCode(v: boolean) {
    set({ needCode: v });
  },
  async send(text: string, ctx: string) {
    if (!text.trim() || state.busy || state.pending) return;
    commit([...state.history, { role: "user", content: [{ type: "text", text: text.trim() }, { type: "text", text: ctx }] }]);
    await loop();
  },
  async decide(approve: boolean) {
    const pending = state.pending;
    if (!pending) return;
    const results = [...pendingResults];
    set({ pending: null, busy: true });
    for (const p of pending) {
      if (!p.prep) results.push({ type: "tool_result", tool_use_id: p.use.id, content: p.error ?? "invalid input", is_error: true });
      else if (!approve) results.push({ type: "tool_result", tool_use_id: p.use.id, content: "The user rejected this change. Nothing was saved.", is_error: true });
      else {
        try {
          results.push({ type: "tool_result", tool_use_id: p.use.id, content: await commitWrite(p.prep) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: p.use.id, content: (e as Error).message, is_error: true });
        }
      }
    }
    pendingResults = [];
    commit([...state.history, { role: "user", content: results }]);
    await loop();
  },
  reset() {
    if (state.busy) return;
    pendingResults = [];
    set({ pending: null, error: "", activity: {} });
    commit([]);
  },
};

export function useChat() {
  return useSyncExternalStore(chat.subscribe, chat.get, chat.get);
}
