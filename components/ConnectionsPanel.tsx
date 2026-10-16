"use client";

// Definições → Ligações: apps que o assistente pode usar por MCP (Canva, Notion, servidores próprios).
// O login de cada app abre a página da própria app (OAuth); os tokens ficam cifrados no servidor.
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import type { ConnAuth, Preset, PublicConnection } from "@/lib/connections";
import { useT, type Key } from "@/lib/i18n";
import { isLocalMode } from "@/lib/store";

type List = { connections: PublicConnection[]; presets: Preset[]; configured: boolean };

async function api<T>(body?: unknown): Promise<T> {
  const r = await fetch("/api/connections", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `http_${r.status}`);
  return j as T;
}

export function ConnectionsPanel() {
  const { t } = useT();
  const [data, setData] = useState<List | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [custom, setCustom] = useState({ label: "", url: "", auth: "oauth" as ConnAuth });
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const reload = () => api<List>().then(setData).catch((e) => setMsg({ ok: false, text: t("cn.fail", { code: e.message }) }));
  useEffect(() => {
    if (isLocalMode) return;
    reload();
    // volta do login da app: ?conn=ok | código de erro
    const q = new URLSearchParams(location.search).get("conn");
    if (q) {
      setMsg(q === "ok" ? { ok: true, text: t("cn.ok") } : { ok: false, text: t("cn.fail", { code: q }) });
      history.replaceState(null, "", location.pathname + location.hash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      await api(body);
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: t("cn.fail", { code: (e as Error).message }) });
    }
    setBusy(false);
  }
  /** Adiciona e, se a app usa login, segue logo para a autorização. */
  async function add(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const { connection } = await api<{ connection: PublicConnection }>({ action: "add", ...body });
      if (connection.auth === "oauth") return void (location.href = `/api/connections/oauth?id=${connection.id}`);
      await reload();
      setCustom({ label: "", url: "", auth: "oauth" });
    } catch (e) {
      setMsg({ ok: false, text: t("cn.fail", { code: (e as Error).message }) });
    }
    setBusy(false);
  }

  if (isLocalMode) return <p className="muted small">{t("cn.local")}</p>;
  const added = new Set(data?.connections.map((c) => c.preset).filter(Boolean));

  return (
    <div className="cn stack" data-testid="connections">
      <p className="muted small" style={{ margin: 0 }}>{t("cn.hint")}</p>
      {data && !data.configured && <p className="note small">{t("cn.vaultMissing")}</p>}
      {msg && <p className={`note small ${msg.ok ? "tone-ok" : "tone-danger"}`}>{msg.text}</p>}

      <ul className="cn-list">
        {data?.connections.length === 0 && <li className="muted small">{t("cn.empty")}</li>}
        {data?.connections.map((c) => (
          <li key={c.id} className="cn-row" data-testid="cn-row">
            <span className="cn-ic"><Icon name="link" size={16} /></span>
            <span className="cn-main">
              <b>{c.label}</b>
              <span className="mono small muted cn-url">{c.url}</span>
              {c.error && <span className="small tone-danger">{c.error}</span>}
            </span>
            <span className={`label ${c.connected ? (c.enabled ? "tone-ok" : "muted") : "muted"}`}>{c.connected ? (c.enabled ? t("cn.connected") : t("cn.paused")) : t("cn.notConnected")}</span>
            <span className="cn-acts">
              {c.connected && (
                <label className="row small" style={{ gap: 6 }}>
                  <input type="checkbox" checked={c.enabled} disabled={busy} onChange={(e) => act({ action: "toggle", id: c.id, enabled: e.target.checked })} /> {t("cn.useInChat")}
                </label>
              )}
              {c.auth === "oauth" && (
                <a className={`btn small ${c.connected ? "ghost" : "accent"}`} href={`/api/connections/oauth?id=${c.id}`}>
                  {c.connected ? t("cn.reconnect") : t("cn.connect")}
                </a>
              )}
              {c.auth === "token" && !c.connected && (
                <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                  <input className="input small" type="password" autoComplete="off" placeholder={t("cn.tokenPh")} value={tokens[c.id] ?? ""} onChange={(e) => setTokens({ ...tokens, [c.id]: e.target.value })} />
                  <button className="btn small accent" disabled={busy || !tokens[c.id]?.trim()} onClick={() => act({ action: "token", id: c.id, token: tokens[c.id] }).then(() => setTokens({ ...tokens, [c.id]: "" }))}>
                    {t("cn.saveToken")}
                  </button>
                </span>
              )}
              {c.connected && c.auth !== "none" && (
                <button className="btn ghost small" disabled={busy} onClick={() => act({ action: "disconnect", id: c.id })}>
                  {t("cn.disconnect")}
                </button>
              )}
              <button className="iconbtn" disabled={busy} onClick={() => confirm(`${t("cn.remove")} ${c.label}?`) && act({ action: "remove", id: c.id })} aria-label={t("cn.remove")}>
                <Icon name="trash" size={15} />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="cn-presets">
        {data?.presets.map((p) => (
          <button key={p.id} className="cn-preset" disabled={busy || added.has(p.id)} onClick={() => add({ preset: p.id })} data-testid={`cn-preset-${p.id}`}>
            <Icon name="plus" size={15} />
            <span>
              <b>{p.label}</b>
              <span className="muted small">{added.has(p.id) ? t("cn.connected") : p.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <form
        className="cn-custom"
        onSubmit={(e) => {
          e.preventDefault();
          add({ label: custom.label, url: custom.url, auth: custom.auth });
        }}
      >
        <span className="tile-t">{t("cn.custom")}</span>
        <span className="muted small">{t("cn.customHint")}</span>
        <div className="cn-custom-row">
          <input className="input" placeholder={t("cn.name")} value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} aria-label={t("cn.name")} />
          <input className="input" placeholder={t("cn.url")} value={custom.url} onChange={(e) => setCustom({ ...custom, url: e.target.value })} aria-label={t("cn.url")} inputMode="url" />
          <Select className="select" value={custom.auth} onChange={(e) => setCustom({ ...custom, auth: e.target.value as ConnAuth })} aria-label="auth">
            {(["oauth", "token", "none"] as const).map((a) => (
              <option key={a} value={a}>
                {t(`cn.auth.${a}` as Key)}
              </option>
            ))}
          </Select>
          <button className="btn accent" type="submit" disabled={busy || !custom.label.trim() || !/^https?:\/\//.test(custom.url.trim())}>
            <Icon name="plus" size={14} /> {t("cn.add")}
          </button>
        </div>
      </form>
    </div>
  );
}
