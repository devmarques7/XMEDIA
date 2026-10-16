"use client";

import { Icon } from "@/components/Icon";
import type Anthropic from "@anthropic-ai/sdk";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { splitActions } from "@/lib/ai/actions";
import { LS_CODE, chat, useChat, type Msg } from "@/lib/ai/chatStore";
import { useT } from "@/lib/i18n";
import { invoiceStore } from "@/lib/invoiceStore";
import { proposalStore } from "@/lib/proposalStore";
import { isLocalMode } from "@/lib/store";
import { team } from "@/lib/team";
import { isoDay } from "@/lib/util";
import { Avatar } from "@/components/team/Avatar";
import { useTeamDirectory } from "@/components/team/useTeamDirectory";

type TextBlock = Anthropic.Beta.BetaTextBlockParam;

function lastActions(h: Msg[]): string[] {
  const m = h[h.length - 1];
  if (!m || m.role !== "assistant" || typeof m.content === "string") return [];
  const texts = m.content.filter((b): b is TextBlock => b.type === "text");
  return texts.length ? splitActions(texts[texts.length - 1].text).actions : [];
}

const blocksOf = (m: Msg) => (typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : m.content);
const userText = (m: Msg) => {
  if (m.role !== "user") return null;
  const b = blocksOf(m).find((x) => x.type === "text" && "text" in x && !x.text.startsWith("[context]"));
  return b && "text" in b ? b.text : null;
};

/**
 * Turnos: cada pergunta + a resposta FINAL do assistente (a última frase do turno). Frases intermédias e ferramentas
 * não ficam empilhadas por baixo — enquanto trabalha mostra-se uma linha de estado com o ícone de carregamento.
 */
function turns(h: Msg[]) {
  const out: { q: string | null; a: string | null; key: number }[] = [];
  for (let i = 0; i < h.length; i++) {
    const q = userText(h[i]);
    if (q !== null) {
      out.push({ q, a: null, key: i });
      continue;
    }
    if (h[i].role === "assistant") {
      const txt = blocksOf(h[i])
        .filter((b): b is TextBlock => b.type === "text" && "text" in b)
        .map((b) => splitActions(b.text).text.trim())
        .filter(Boolean)
        .at(-1);
      if (!out.length) out.push({ q: null, a: null, key: i });
      if (txt) out[out.length - 1].a = txt;
    }
  }
  return out;
}

/** Assistente Claude: painel lateral; a conversa vive em lib/ai/chatStore (continua minimizada e entre páginas). */
export function AiChat() {
  const { t, lang } = useT();
  const path = usePathname();
  const S = useChat();
  const [input, setInput] = useState("");
  const [me, setMe] = useState("");
  const { who } = useTeamDirectory();
  const endRef = useRef<HTMLDivElement>(null);
  const turnsList = turns(S.history);
  const last = turnsList.at(-1);

  useEffect(() => {
    team.me().then((m) => setMe(m.email)).catch(() => {});
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [S.history, S.pending, S.busy, S.open, S.activity]);

  async function send(e?: React.FormEvent, override?: string) {
    e?.preventDefault();
    const text = (override ?? input).trim();
    if (!text || S.busy || S.pending) return;
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
    await chat.send(text, ctx);
  }

  function errorText(code: string) {
    if (code === "refusal") return t("ai.refusal");
    const k = `ai.err.${code}` as "ai.err.api_error";
    const s = t(k);
    return s === k ? `${t("ai.err.api_error")} (${code})` : s;
  }

  const meP = who(me);
  const userAv = <Avatar name={meP?.name || me || "?"} photo={meP?.photo} size={26} className="aiav" />;
  const botAv = (
    <span className="aiav bot" aria-hidden>
      ✦
    </span>
  );
  const activity = S.activity.tool ? t(`ai.tool.${S.activity.tool}` as "ai.tool.update_invoice") : S.activity.text || t("ai.thinking");

  return (
    <>
      <button
        className={`aifab ${S.open ? "on" : ""} ${S.busy ? "busy" : ""}`}
        onClick={() => chat.setOpen(!S.open)}
        aria-expanded={S.open}
        aria-label={S.busy ? `${t("ai.title")} · ${t("ai.thinking")}` : t("ai.title")}
        data-testid="ai-fab"
      >
        {S.busy && !S.open ? <span className="aispin" aria-hidden /> : <span aria-hidden>✦</span>}
        <span className="aifab-label">{S.busy && !S.open ? t("ai.working") : t("ai.title")}</span>
        {S.unread && !S.open && <i className="aifab-dot" aria-label={S.pending ? t("ai.confirm") : t("ai.newReply")} data-testid="ai-unread" />}
      </button>

      {S.open && (
        <aside className="aipanel" role="dialog" aria-label={t("ai.title")}>
          <header className="aipanel-head">
            <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
              {botAv}
              <span>
                <span className="label">{t("ai.title")}</span>
                <span className="muted small"> · Claude</span>
              </span>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
              {!isLocalMode && (
                <Link href="/definicoes#ligacoes" className="btn ghost small" title={t("ai.connections")} onClick={() => chat.setOpen(false)}>
                  <Icon name="link" size={14} /> {t("ai.apps")}
                </Link>
              )}
              <button className="btn ghost small" onClick={() => chat.reset()} disabled={S.busy || !S.history.length}>
                {t("ai.new")}
              </button>
              <button className="btn ghost small" onClick={() => chat.setOpen(false)} aria-label={t("ai.minimize")} title={t("ai.minimize")} data-testid="ai-min">
                <Icon name="chevronDown" size={14} />
              </button>
            </div>
          </header>

          <div className="aipanel-body">
            {S.history.length === 0 && (
              <div className="aiempty">
                <p className="muted">{t("ai.intro")}</p>
                <div className="aiquick" data-testid="ai-quick">
                  {(["ai.qa.week", "ai.qa.invoice", "ai.qa.proposal", "ai.qa.unpaid", "ai.qa.canva"] as const).map((k) => (
                    <button key={k} className="aiact" onClick={() => send(undefined, t(k))} disabled={S.busy}>
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

            {turnsList.map((tn, i) => (
              <div key={tn.key} className="aiturn">
                {tn.q !== null && (
                  <div className="airow user">
                    <div className="aimsg user">{tn.q}</div>
                    {userAv}
                  </div>
                )}
                {tn.a && !(S.busy && i === turnsList.length - 1) && (
                  <div className="airow bot">
                    {botAv}
                    <div className="aimsg bot">{tn.a}</div>
                  </div>
                )}
              </div>
            ))}

            {S.busy && (
              <div className="airow bot" data-testid="ai-thinking">
                {botAv}
                <div className="aithink" role="status" aria-live="polite">
                  <span className="aispin" aria-hidden />
                  <span className="aithink-t">{activity}</span>
                </div>
              </div>
            )}

            {S.pending && (
              <div className="aiconfirm">
                <span className="label">{t("ai.confirm")}</span>
                {S.pending.map((p) => (
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
                  <button className="btn accent" onClick={() => chat.decide(true)} disabled={!S.pending.some((p) => p.prep)}>
                    <Icon name="check" size={14} /> {t("ai.apply")}
                  </button>
                  <button className="btn ghost" onClick={() => chat.decide(false)}>
                    {t("ai.reject")}
                  </button>
                </div>
              </div>
            )}

            {!S.busy && !S.pending && last?.a && lastActions(S.history).length > 0 && (
              <div className="aiquick" data-testid="ai-next">
                {lastActions(S.history).map((a) => (
                  <button key={a} className="aiact" onClick={() => send(undefined, a)}>
                    <Icon name="next" size={13} /> {a}
                  </button>
                ))}
              </div>
            )}

            {S.error && <p className="tone-danger small">{errorText(S.error)}</p>}
            {S.needCode && <CodeBox onSaved={() => chat.setNeedCode(false)} />}
            <div ref={endRef} />
          </div>

          <form className="aipanel-input" onSubmit={send}>
            {userAv}
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
            <button className="btn accent" type="submit" disabled={S.busy || !!S.pending || !input.trim()}>
              <Icon name="upload" size={14} />
            </button>
          </form>
        </aside>
      )}
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
