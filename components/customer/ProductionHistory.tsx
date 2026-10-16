"use client";

// Portal · Histórico: quanto foi produzido por mês (entregues = aprovados, agendados e publicados), os rascunhos
// planeados, e a lista do mês — exportável em PDF (impressão do browser → "Guardar como PDF").
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { phaseOf, type ContentPost } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { StatusLabel, TypeIcon } from "./parts";

const DELIVERED = ["approved", "scheduled", "published"];
const monthOf = (p: ContentPost) => (p.published_at || p.scheduled_at || p.phase_since || p.updated_at || "").slice(0, 7);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function ProductionHistory({ posts, customer }: { posts: ContentPost[]; customer: string }) {
  const { t, locale } = useT();
  const delivered = useMemo(() => posts.filter((p) => DELIVERED.includes(phaseOf(p))), [posts]);
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }, []);
  const [month, setMonth] = useState(months[5]);
  const count = (m: string) => delivered.filter((p) => monthOf(p) === m).length;
  const max = Math.max(1, ...months.map(count));
  const list = delivered.filter((p) => monthOf(p) === month).sort((a, b) => (a.published_at || a.scheduled_at || "").localeCompare(b.published_at || b.scheduled_at || ""));
  const drafts = posts.filter((p) => p.client_draft && (p.client_draft.at ?? "").slice(0, 7) === month).length;
  const label = (m: string, o: Intl.DateTimeFormatOptions = { month: "short" }) => new Date(m + "-15T12:00:00").toLocaleDateString(locale, o);
  const when = (p: ContentPost) => {
    const w = p.published_at || p.scheduled_at;
    return w ? new Date(w).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : "—";
  };
  const byType = list.reduce<Record<string, number>>((a, p) => ((a[p.type] = (a[p.type] ?? 0) + 1), a), {});

  function exportPdf() {
    const rows = list.map((p) => `<tr><td>${esc(when(p))}</td><td>${esc(t(`ct.type.${p.type}` as Key))}</td><td>${esc(p.title || "—")}</td><td>${esc(t(`ct.status.${p.status}` as Key))}</td></tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(customer)} · ${esc(label(month, { month: "long", year: "numeric" }))}</title>
<style>body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;margin:40px}h1{font-size:28px;margin:0 0 4px;letter-spacing:-.02em}.k{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#ff5a1f}
.m{color:#666;font-size:13px;margin-bottom:24px}.s{display:flex;gap:24px;margin:16px 0 24px}.s div{border-top:2px solid #111;padding-top:8px}.s b{font-size:28px;display:block}
table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#888;border-bottom:1px solid #111;padding:8px 6px}td{padding:9px 6px;border-bottom:1px solid #e6e6e6}
.f{margin-top:32px;font-size:11px;color:#888}</style></head><body>
<div class="k">XMEDIA · ${esc(t("ph.title"))}</div><h1>${esc(customer)}</h1><div class="m">${esc(label(month, { month: "long", year: "numeric" }))}</div>
<div class="s"><div><b>${list.length}</b>${esc(t("ph.produced"))}</div>${Object.entries(byType).map(([k, v]) => `<div><b>${v}</b>${esc(t(`ct.type.${k}` as Key))}</div>`).join("")}<div><b>${drafts}</b>${esc(t("ph.drafts"))}</div></div>
<table><thead><tr><th>${esc(t("dp.date"))}</th><th>${esc(t("dp.type"))}</th><th>${esc(t("ph.content"))}</th><th>${esc(t("ph.status"))}</th></tr></thead><tbody>${rows || `<tr><td colspan="4">${esc(t("ph.none"))}</td></tr>`}</tbody></table>
<div class="f">MediaMarques · Brand Elevation Studio · ${new Date().toLocaleDateString(locale)}</div>
<script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <section className="ph">
      <div className="ph-head">
        <div className="ph-bars" role="list" aria-label={t("ph.title")}>
          {months.map((m) => (
            <button key={m} role="listitem" className={`ph-bar ${m === month ? "on" : ""}`} onClick={() => setMonth(m)} data-testid="ph-month">
              <span className="mono small">{count(m)}</span>
              <span className="ph-col">
                <i style={{ height: `${(count(m) / max) * 100}%` }} />
              </span>
              <span className="mono small muted">{label(m)}</span>
            </button>
          ))}
        </div>
        <div className="ph-kpis">
          <div>
            <span className="tile-num sm">{String(list.length).padStart(2, "0")}</span>
            <span className="tile-t muted">{t("ph.produced")}</span>
          </div>
          <div>
            <span className="tile-num sm">{String(drafts).padStart(2, "0")}</span>
            <span className="tile-t muted">{t("ph.drafts")}</span>
          </div>
          <button className="btn" onClick={exportPdf} data-testid="ph-pdf">
            <Icon name="download" size={14} /> {t("ph.pdf")}
          </button>
        </div>
      </div>
      <h3 className="ph-month">{label(month, { month: "long", year: "numeric" })}</h3>
      {!list.length && <p className="muted small">{t("ph.none")}</p>}
      <ul className="ph-list">
        {list.map((p) => (
          <li key={p.id} className="ph-row" data-testid="ph-row">
            <span className="mono small muted">{when(p)}</span>
            <span className="ph-type">
              <TypeIcon type={p.type} /> {t(`ct.type.${p.type}` as Key)}
            </span>
            <b className="ph-t">{p.title || p.caption.split("\n")[0] || "—"}</b>
            <StatusLabel status={p.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
