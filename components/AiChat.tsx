"use client";

import { Icon } from "@/components/Icon";
import type Anthropic from "@anthropic-ai/sdk";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ToolInputError } from "@/lib/ai/apply";
import { commitWrite, prepareWrite, runRead, type PreparedWrite } from "@/lib/ai/exec";
import { WRITE_TOOLS } from "@/lib/ai/tools";
import { splitActions } from "@/lib/ai/actions";
import { useT } from "@/lib/i18n";
import { invoiceStore } from "@/lib/invoiceStore";
import { proposalStore } from "@/lib/proposalStore";
import { isLocalMode } from "@/lib/store";
import { isoDay } from "@/lib/util";

type Msg = Anthropic.Beta.BetaMessageParam;
type ToolUse = Anthropic.Beta.BetaToolUseBlock;
type Result = Anthropic.Beta.BetaToolResultBlockParam;
type Pending = { use: ToolUse; prep: PreparedWrite | null; error?: string };
type Reply = { content: Anthropic.Beta.BetaContentBlock[]; stop_reason: string | null; stop_details: { explanation?: string } | null; error?: string };

const LS_HISTORY = "xmedia:ai:history";
const LS_CODE = "xmedia:ai:code";
const MAX_STEPS = 10;

function lastActions(h: Msg[]): string[] {
  const m = h[h.length - 1];
  if (!m || m.role !== "assistant" || typeof m.content === "string") return [];
  const texts = m.content.filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text");
  return texts.length ? splitActions(texts[texts.length - 1].text).actions : [];
}

const load = (): Msg[] => {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
  } catch {
    return [];
  }
};

/** Assistente Claude: painel lateral com chat, ferramentas e confirmação de alterações. */
export function AiChat() {
  const { t, lang } = useT();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [pending, setPending] = useState<Pending[] | null>(null);
  const historyRef = useRef<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = load();
    historyRef.current = h;
    setHistory(h);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [history, pending, busy, open]);

  const commit = useCallback((h: Msg[]) => {
    historyRef.current = h;
    setHistory(h);
    try {
      localStorage.setItem(LS_HISTORY, JSON.stringify(h.slice(-120)));
    } catch {}
  }, []);

  async function ask(): Promise<Reply> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    try {
      const c = localStorage.getItem(LS_CODE);
      if (c) headers["x-xmedia-ai-code"] = c;
    } catch {}
    const r = await fetch("/api/ai/chat", { method: "POST", headers, body: JSON.stringify({ messages: historyRef.current }) });
    const j = await r.json().catch(() => ({ error: `http_${r.status}` }));
    if (!r.ok) return { content: [], stop_reason: null, stop_details: null, error: j.error ?? `http_${r.status}` };
    return j;
  }

  /** Corre o ciclo: pedido → ferramentas de leitura → (pausa para confirmar escritas) → … */
  const loop = useCallback(async () => {
    setBusy(true);
    setError("");
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await ask();
      if (res.error) {
        if (res.error === "unauthorized" && isLocalMode) setNeedCode(true);
        setError(errorText(res.error));
        // retira a última pergunta sem resposta para manter o histórico válido (só o utilizador a enviou)
        break;
      }
      commit([...historyRef.current, { role: "assistant", content: res.content as Msg["content"] }]);
      if (res.stop_reason === "refusal") {
        setError(t("ai.refusal"));
        break;
      }
      if (res.stop_reason !== "tool_use") break;

      const uses = res.content.filter((b): b is ToolUse => b.type === "tool_use");
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
        pendingResults.current = results;
        setPending(writes);
        setBusy(false);
        return;
      }
      commit([...historyRef.current, { role: "user", content: results }]);
    }
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, t]);

  const pendingResults = useRef<Result[]>([]);

  async function decide(approve: boolean) {
    if (!pending) return;
    const results = [...pendingResults.current];
    for (const p of pending) {
      if (!p.prep) {
        results.push({ type: "tool_result", tool_use_id: p.use.id, content: p.error ?? "invalid input", is_error: true });
      } else if (!approve) {
        results.push({ type: "tool_result", tool_use_id: p.use.id, content: "The user rejected this change. Nothing was saved.", is_error: true });
      } else {
        try {
          results.push({ type: "tool_result", tool_use_id: p.use.id, content: await commitWrite(p.prep) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: p.use.id, content: (e as Error).message, is_error: true });
        }
      }
    }
    setPending(null);
    pendingResults.current = [];
    commit([...historyRef.current, { role: "user", content: results }]);
    await loop();
  }

  async function send(e?: React.FormEvent, override?: string) {
    e?.preventDefault();
    const text = (override ?? input).trim();
    if (!text || busy || pending) return;
    // contexto variável (data, página, invoice aberta) num bloco à parte, depois da pergunta
    let ctx = `[context] today=${isoDay()} ui_language=${lang} page=${path}`;
    const m = /^\/financas\/([\w-]+)/.exec(path);
    if (m) {
      const inv = await invoiceStore.get(m[1]).catch(() => null);
      if (inv) ctx += ` open_invoice_id=${inv.id} open_invoice_number="${inv.number}"`;
    }
    const mp = /^\/propostas\/([\w-]+)/.exec(path);
    if (mp) {
      const pr = await proposalStore.get(mp[1]).catch(() => null);
      if (pr) ctx += ` open_proposal_id=${pr.id} open_proposal_title="${pr.title}"`;
    }
    if (!override) setInput("");
    commit([...historyRef.current, { role: "user", content: [{ type: "text", text }, { type: "text", text: ctx }] }]);
    await loop();
  }

  function reset() {
    if (busy) return;
    setPending(null);
    setError("");
    commit([]);
  }

  function errorText(code: string) {
    const k = `ai.err.${code}` as "ai.err.api_error";
    const s = t(k);
    return s === k ? `${t("ai.err.api_error")} (${code})` : s;
  }

  return (
    <>
      <button className={`aifab ${open ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("ai.title")}>
        <span aria-hidden>✦</span>
        <span className="aifab-label">{t("ai.title")}</span>
      </button>

      {open && (
        <aside className="aipanel" role="dialog" aria-label={t("ai.title")}>
          <header className="aipanel-head">
            <div>
              <span className="label">✦ {t("ai.title")}</span>
              <span className="muted small"> · Claude</span>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
              {!isLocalMode && (
                <Link href="/definicoes#ligacoes" className="btn ghost small" title={t("ai.connections")} onClick={() => setOpen(false)}>
                  <Icon name="link" size={14} /> {t("ai.apps")}
                </Link>
              )}
              <button className="btn ghost small" onClick={reset} disabled={busy || !history.length}>
                {t("ai.new")}
              </button>
              <button className="btn ghost small" onClick={() => setOpen(false)} aria-label={t("close")}>
                <Icon name="close" size={14} />
              </button>
            </div>
          </header>

          <div className="aipanel-body">
            {history.length === 0 && (
              <div className="aiempty">
                <p className="muted">{t("ai.intro")}</p>
                <div className="aiquick" data-testid="ai-quick">
                  {(["ai.qa.week", "ai.qa.invoice", "ai.qa.proposal", "ai.qa.unpaid", "ai.qa.canva"] as const).map((k) => (
                    <button key={k} className="aiact" onClick={() => send(undefined, t(k))} disabled={busy}>
                      <Icon name="next" size={13} /> {t(k)}
                    </button>
                  ))}
                </div>
                {[t("ai.ex1"), t("ai.ex2"), t("ai.ex3")].map((ex) => (
                  <button key={ex} className="aiex" onClick={() => setInput(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            )}

            {history.map((m, i) => (
              <Turn key={i} msg={m} />
            ))}

            {pending && (
              <div className="aiconfirm">
                <span className="label">{t("ai.confirm")}</span>
                {pending.map((p) => (
                  <div key={p.use.id} className="aichange">
                    <b className="small">{t(`ai.tool.${p.use.name}` as "ai.tool.update_invoice")}</b>
                    {p.prep ? (
                      <ul>
                        {p.prep.lines.map((l, k) => (
                          <li key={k}>{l}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="tone-danger small">{p.error}</p>
                    )}
                  </div>
                ))}
                <div className="row">
                  <button className="btn accent" onClick={() => decide(true)} disabled={!pending.some((p) => p.prep)}>
                    <Icon name="check" size={14} /> {t("ai.apply")}
                  </button>
                  <button className="btn ghost" onClick={() => decide(false)}>
                    {t("ai.reject")}
                  </button>
                </div>
              </div>
            )}

            {!busy && !pending && lastActions(history).length > 0 && (
              <div className="aiquick" data-testid="ai-next">
                {lastActions(history).map((a) => (
                  <button key={a} className="aiact" onClick={() => send(undefined, a)}>
                    <Icon name="next" size={13} /> {a}
                  </button>
                ))}
              </div>
            )}

            {busy && <div className="aityping label muted">{t("ai.thinking")}</div>}
            {error && <p className="tone-danger small">{error}</p>}
            {needCode && <CodeBox onSaved={() => setNeedCode(false)} />}
            <div ref={endRef} />
          </div>

          <form className="aipanel-input" onSubmit={send}>
            <textarea
              className="textarea"
              rows={2}
              value={input}
              placeholder={t("ai.placeholder")}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              aria-label={t("ai.placeholder")}
              data-testid="ai-input"
            />
            <button className="btn accent" type="submit" disabled={busy || !!pending || !input.trim()}>
              <Icon name="upload" size={14} />
            </button>
          </form>
        </aside>
      )}
    </>
  );
}

/** Mostra uma mensagem do histórico: texto do utilizador, texto do Claude e atividade das ferramentas. */
function Turn({ msg }: { msg: Msg }) {
  const { t } = useT();
  const blocks = typeof msg.content === "string" ? [{ type: "text" as const, text: msg.content }] : msg.content;
  if (msg.role === "user") {
    const text = blocks.find((b) => b.type === "text" && !("text" in b && b.text.startsWith("[context]")));
    if (text && "text" in text) return <div className="aimsg user">{text.text}</div>;
    const results = blocks.filter((b) => b.type === "tool_result") as Result[];
    if (!results.length) return null;
    return (
      <div className="aitools">
        {results.map((r) => (
          <span key={r.tool_use_id} className={`chip ${r.is_error ? "tone-danger" : ""}`}>
            {r.is_error ? "✕" : ""}{" "}
            {(() => {
              const c = typeof r.content === "string" ? r.content : "";
              if (c.includes('"applied":true')) return t("ai.applied");
              if (c.startsWith("The user rejected")) return t("ai.rejected");
              return r.is_error ? t("ai.toolFailed") : t("ai.toolRead");
            })()}
          </span>
        ))}
      </div>
    );
  }
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "text" && "text" in b) {
          const txt = splitActions(b.text).text;
          return txt.trim() ? <div key={i} className="aimsg bot">{txt}</div> : null;
        }
        if (b.type === "mcp_tool_use" && "server_name" in b)
          return (
            <div key={i} className="aitools">
              <span className="chip"><Icon name="link" size={14} /> {b.server_name} · {b.name.replace(/[-_]/g, " ")}</span>
            </div>
          );
        if (b.type === "mcp_tool_result" && "is_error" in b && b.is_error)
          return (
            <div key={i} className="aitools">
              <span className="chip tone-danger">✕ {t("ai.toolFailed")}</span>
            </div>
          );
        if (b.type === "tool_use" && "name" in b)
          return (
            <div key={i} className="aitools">
              <span className="chip"><Icon name="settings" size={14} /> {t(`ai.tool.${b.name}` as "ai.tool.update_invoice")}</span>
            </div>
          );
        return null;
      })}
    </>
  );
}

function CodeBox({ onSaved }: { onSaved: () => void }) {
  const { t } = useT();
  const [v, setV] = useState("");
  return (
    <form
      className="aicode"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          localStorage.setItem(LS_CODE, v.trim());
        } catch {}
        onSaved();
      }}
    >
      <span className="small">{t("ai.codeHint")}</span>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input className="input" type="password" autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} aria-label={t("ai.code")} placeholder={t("ai.code")} />
        <button className="btn" type="submit" disabled={!v.trim()}>
          OK
        </button>
      </div>
      <Link href="/tutorial#assistente" className="small arrow">
        {t("nav.tutorial")}
      </Link>
    </form>
  );
}
