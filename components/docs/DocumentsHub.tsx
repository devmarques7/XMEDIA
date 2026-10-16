"use client";

// Documentos (admin): visão geral com pastas (Internos · Clientes → cada cliente · Modelos), separadores por estado,
// pesquisa e filtros, carregar por drag & drop e cartões com o estado da assinatura. Também embebido na ficha do
// cliente (customerId fixo).
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { Icon } from "@/components/Icon";
import { Avatar, AvatarStack } from "@/components/team/Avatar";
import { customerStore } from "@/lib/customerStore";
import type { Customer } from "@/lib/customer";
import { colorOf, newDoc, statusOf, type Doc, type DocStatus } from "@/lib/documents";
import { docApi, docLocal, type DocRow } from "@/lib/docApi";
import { useT, type Key } from "@/lib/i18n";
import { resolveMedia } from "@/lib/media";

type Tab = "all" | "waiting" | "completed" | "draft" | "problem" | "templates";
const TABS: Tab[] = ["all", "waiting", "completed", "draft", "problem", "templates"];
const inTab = (d: Doc, tab: Tab) => {
  const s = statusOf(d);
  if (tab === "templates") return !!d.template;
  if (d.template) return false;
  return tab === "all" || (tab === "waiting" && (s === "sent" || s === "partially_signed")) || (tab === "completed" && s === "completed") || (tab === "draft" && s === "draft") || (tab === "problem" && (s === "declined" || s === "expired" || s === "voided"));
};

export function DocumentsHub({ customerId, onToast }: { customerId?: string; onToast: (m: string) => void }) {
  const { t, locale } = useT();
  const [rows, setRows] = useState<DocRow[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [scope, setScope] = useState<string>(customerId ?? "all"); // "all" | "" (internos) | customer id
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r, cs] = await Promise.all([docApi.list(customerId ?? "all"), customerStore.list()]);
    setRows(r.filter((x) => !x.doc.deleted));
    setCustomers(cs);
  }, [customerId]);
  useEffect(() => {
    load().catch((e) => (onToast((e as Error).message), setRows([])));
  }, [load, onToast]);

  const cname = (id: string) => customers.find((c) => c.id === id);
  const shown = useMemo(
    () =>
      (rows ?? []).filter(
        ({ doc }) => inTab(doc, tab) && (scope === "all" || doc.customer_id === scope) && (!q.trim() || `${doc.title} ${doc.folder} ${doc.file.name} ${doc.tags.join(" ")} ${cname(doc.customer_id)?.name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, tab, scope, q, customers]
  );
  const count = (tb: Tab) => (rows ?? []).filter(({ doc }) => inTab(doc, tb) && (scope === "all" || doc.customer_id === scope)).length;
  const byCustomer = useMemo(() => {
    const m = new Map<string, number>();
    for (const { doc } of rows ?? []) if (!doc.template) m.set(doc.customer_id, (m.get(doc.customer_id) ?? 0) + 1);
    return m;
  }, [rows]);
  const stats = useMemo(() => {
    const live = (rows ?? []).map((r) => r.doc).filter((d) => !d.template);
    const month = new Date().toISOString().slice(0, 7);
    return { total: live.length, waiting: live.filter((d) => ["sent", "partially_signed"].includes(statusOf(d))).length, done: live.filter((d) => statusOf(d) === "completed" && d.updated_at.startsWith(month)).length, client: live.filter((d) => d.uploaded_by === "client").length };
  }, [rows]);

  async function upload(files: File[]) {
    setBusy(true);
    try {
      const target = scope === "all" ? "" : scope;
      for (const f of files) {
        const file = await docApi.upload(f, target);
        await docApi.save(newDoc({ title: f.name.replace(/\.[^.]+$/, ""), file, customer_id: target, shared: !!target }));
      }
      onToast(t("dd.uploaded", { n: files.length }));
      await load();
    } catch (e) {
      onToast((e as Error).message);
    }
    setBusy(false);
  }
  async function useTemplate(tpl: Doc) {
    const target = scope === "all" || scope === "" ? "" : scope;
    const c = cname(target);
    const d: Doc = {
      ...tpl,
      id: crypto.randomUUID(),
      template: false,
      customer_id: target,
      title: tpl.title.replace(` · ${t("dd.template")}`, ""),
      status: "draft",
      shared: !!target,
      audit: [{ at: new Date().toISOString(), action: "created", by: "studio", detail: `template ${tpl.id.slice(0, 8)}` }],
      recipients: tpl.recipients.map((r, i) => ({ ...r, ...(i === 0 && c ? { name: c.contact || c.name, email: c.billing?.email || c.email, company: c.billing?.company || c.name } : {}), status: "pending" })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await docApi.save(d);
    location.href = `/documentos/${d.id}?c=${target}`;
  }
  async function open(d: Doc, which: "original" | "signed" = "original") {
    const url = docApi.fileUrl(d, which);
    window.open(docLocal ? await resolveMedia(url) : url, "_blank", "noopener");
  }

  return (
    <div className={`dh ${customerId ? "embedded" : ""}`}>
      {!customerId && (
        <aside className="dh-rail">
          <span className="tile-t">{t("dd.folders")}</span>
          <button className={`dh-folder ${scope === "all" ? "on" : ""}`} onClick={() => setScope("all")}>
            <Icon name="layers" size={15} /> {t("dd.all")} <span className="mono">{stats.total}</span>
          </button>
          <button className={`dh-folder ${scope === "" ? "on" : ""}`} onClick={() => setScope("")}>
            <Icon name="lock" size={15} /> {t("dd.internal")} <span className="mono">{byCustomer.get("") ?? 0}</span>
          </button>
          <span className="tile-t" style={{ marginTop: 10 }}>
            {t("dd.clients")}
          </span>
          {customers.map((c) => (
            <button key={c.id} className={`dh-folder ${scope === c.id ? "on" : ""}`} onClick={() => setScope(c.id)}>
              <Avatar name={c.name} photo={c.cover || c.instagram.picture} size={20} /> <span className="dh-fn">{c.name}</span> <span className="mono">{byCustomer.get(c.id) ?? 0}</span>
            </button>
          ))}
        </aside>
      )}

      <section className="dh-main">
        {!customerId && (
          <div className="dh-stats">
            {(
              [
                ["dd.st.total", stats.total],
                ["dd.st.waiting", stats.waiting],
                ["dd.st.done", stats.done],
                ["dd.st.client", stats.client],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="dh-stat">
                <span className="tile-num sm">{String(v).padStart(2, "0")}</span>
                <span className="tile-t muted">{t(k)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="dh-bar">
          <h2 className="dh-h">
            {scope === "all" ? t("dd.all") : scope === "" ? t("dd.internal") : cname(scope)?.name} <small className="mono muted">{shown.length}</small>
          </h2>
          <span className="dh-search">
            <Icon name="search" size={15} />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("dd.search")} aria-label={t("dd.search")} />
          </span>
        </div>
        <nav className="td-tabs" role="tablist">
          {TABS.map((x) => (
            <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)} data-testid={`dh-tab-${x}`}>
              {t(`dd.tab.${x}` as Key)} <span className="mono">{count(x)}</span>
            </button>
          ))}
        </nav>

        <DropZone target="document" onFiles={upload} busy={busy} testId="dh-drop" />

        {rows && !shown.length && <p className="muted small">{tab === "templates" ? t("dd.noTemplates") : t("dd.empty")}</p>}
        <div className="dh-grid">
          {shown.map(({ doc: d }) => {
            const c = cname(d.customer_id);
            const s = statusOf(d);
            const signers = d.recipients.filter((r) => r.role !== "viewer");
            const signed = signers.filter((r) => r.status === "signed").length;
            return (
              <article key={d.id} className={`dh-card s-${s}`} data-testid="dh-card">
                <header className="dh-card-h">
                  {c ? <Avatar name={c.name} photo={c.cover || c.instagram.picture} size={36} /> : <span className="av" style={{ width: 36, height: 36 }}><Icon name="lock" size={15} /></span>}
                  <span className="dh-card-who">
                    <b>{c?.name ?? t("dd.internal")}</b>
                    <span className="muted small">{d.folder || (d.uploaded_by === "client" ? t("dd.fromClient") : t("dd.studio"))}</span>
                  </span>
                  <Link className="dh-go" href={`/documentos/${d.id}?c=${d.customer_id}`} aria-label={t("dd.prepare")}>
                    <Icon name="arrow" size={16} />
                  </Link>
                </header>
                <div className="dh-card-b">
                  <span className="dh-ic">
                    <Icon name={d.kind === "signature" || d.recipients.length ? "edit" : d.file.mime.startsWith("image/") ? "image" : "page"} size={22} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <b className="dh-title">{d.title}</b>
                    <span className="muted small">
                      {new Date(d.updated_at).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })} · {(d.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </span>
                </div>
                <footer className="dh-card-f">
                  <span className={`dh-st s-${s}`}>
                    {t(`dd.s.${d.template ? "template" : s}` as Key)}
                    {signers.length > 0 && !d.template && <span className="mono"> {signed}/{signers.length}</span>}
                  </span>
                  {signers.length > 0 && <AvatarStack list={signers.map((r) => ({ name: r.name || r.email }))} size={22} />}
                  <span className="dh-acts">
                    {d.template ? (
                      <button className="btn small accent" onClick={() => useTemplate(d)}>
                        <Icon name="plus" size={13} /> {t("dd.useTemplate")}
                      </button>
                    ) : (
                      <>
                        <button className="iconbtn" onClick={() => open(d)} title={t("dd.open")} aria-label={t("dd.open")}>
                          <Icon name="eye" size={15} />
                        </button>
                        {d.signed && (
                          <button className="iconbtn" onClick={() => open(d, "signed")} title={t("dd.signedPdf")} aria-label={t("dd.signedPdf")}>
                            <Icon name="download" size={15} />
                          </button>
                        )}
                        {d.customer_id && (
                          <button className={`iconbtn ${d.shared ? "on" : ""}`} onClick={async () => (await docApi.save({ ...d, shared: !d.shared }), load())} title={d.shared ? t("dd.sharedOn") : t("dd.sharedOff")} aria-label={t("dd.share")}>
                            <Icon name={d.shared ? "globe" : "lock"} size={15} />
                          </button>
                        )}
                      </>
                    )}
                    <button className="iconbtn" onClick={async () => confirm(t("ra.confirmDelete", { name: d.title })) && (await docApi.remove(d), load())} aria-label={t("ra.delete")}>
                      <Icon name="trash" size={15} />
                    </button>
                  </span>
                </footer>
                {d.recipients.length > 0 && !d.template && (
                  <div className="dh-recs">
                    {d.recipients.map((r) => (
                      <span key={r.id} className={`dh-rec rs-${r.status}`} style={{ ["--rc" as string]: colorOf(d, r.id) }}>
                        <i /> {r.name || r.email} · {t(`de.rs.${r.status}` as Key)}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
