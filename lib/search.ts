// Pesquisa global: indexa projetos, propostas, invoices, equipa e tarefas e devolve
// cada resultado com o excerto do texto onde a pesquisa aparece. Funções puras (testadas).
import type { ContentPost, Customer } from "./customer";
import type { Invoice } from "./invoice";
import type { Proposal, Slide } from "./proposal";
import type { Service } from "./services";
import type { Member } from "./team";
import type { Project, Task } from "./types";

export type SearchKind = "page" | "project" | "customer" | "service" | "proposal" | "invoice" | "member" | "task";
export type Field = { label: string; text: string; href?: string };
export type SearchDoc = { kind: SearchKind; id: string; title: string; subtitle: string; href: string; fields: Field[] };
export type SearchHit = { doc: SearchDoc; field: Field; snippet: { before: string; match: string; after: string }; score: number };

export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clean = (s: string) => s.replace(/\*\*?|\s+/g, (m) => (m.trim() ? "" : " ")).trim();

function slideText(s: Slide): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "id" && k !== "type" && k !== "src" && k !== "kind") walk(x);
  };
  walk(s);
  return out.filter(Boolean);
}

const slideTitle = (s: Slide) => ("title" in s && s.title) || ("statement" in s && s.statement.slice(0, 40)) || s.type;

export function buildIndex(d: {
  projects?: Project[];
  proposals?: Proposal[];
  invoices?: Invoice[];
  members?: Member[];
  tasks?: Task[];
  customers?: Customer[];
  posts?: ContentPost[];
  services?: Service[];
  pages?: { href: string; label: string }[];
}): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const p of d.pages ?? []) docs.push({ kind: "page", id: p.href, title: p.label, subtitle: p.href, href: p.href, fields: [] });

  for (const p of d.projects ?? []) {
    const href = `/p/${p.id}`;
    const f: Field[] = [
      { label: "Cliente", text: p.data.client },
      { label: "Descrição", text: p.data.description },
      ...p.data.definitions.map((x) => ({ label: x.label || "Definição", text: x.value })),
      ...p.data.reels.flatMap((r) => [
        { label: "Reel", text: r.title, href: `${href}?tab=reels` },
        { label: `Reel · ${r.title}`, text: r.concept, href: `${href}?tab=reels` },
      ]),
      ...p.data.locations.map((l) => ({ label: `Local · ${l.name}`, text: [l.name, l.address, l.notes].filter(Boolean).join(" — "), href: `${href}?tab=locais` })),
      ...p.data.sessions.flatMap((s) => [
        { label: "Sessão", text: [s.label, s.notes].filter(Boolean).join(" — "), href: `${href}?tab=sessoes` },
        ...s.blocks.flatMap((b) => [
          { label: `Divisão · ${s.label}`, text: b.title, href: `${href}?tab=cenas` },
          ...b.scenes.map((c) => ({ label: `Cena · ${b.title}`, text: [c.title, c.description].filter(Boolean).join(" — "), href: `${href}?tab=cenas` })),
        ]),
      ]),
    ];
    docs.push({ kind: "project", id: p.id, title: p.title, subtitle: p.data.client, href, fields: f });
  }

  for (const c of d.customers ?? []) {
    const href = `/clientes/${c.id}`;
    docs.push({
      kind: "customer",
      id: c.id,
      title: c.name,
      subtitle: [c.contact, c.instagram.handle && `@${c.instagram.handle}`].filter(Boolean).join(" · "),
      href,
      fields: [
        { label: "Contacto", text: [c.contact, c.email, c.phone].filter(Boolean).join(" · ") },
        { label: "Notas", text: c.notes },
        ...(d.posts ?? [])
          .filter((p) => p.customer_id === c.id)
          .map((p) => ({ label: `Conteúdo · ${p.title || p.type}`, text: [p.title, p.caption].filter(Boolean).join(" — "), href: `${href}?tab=content&post=${p.id}` })),
      ],
    });
  }

  for (const p of d.proposals ?? []) {
    const href = `/propostas/${p.id}`;
    docs.push({
      kind: "proposal",
      id: p.id,
      title: p.title,
      subtitle: [p.client.company || p.client.name, p.stage].filter(Boolean).join(" · "),
      href,
      fields: [
        { label: "Cliente", text: [p.client.company, p.client.name, p.client.email].filter(Boolean).join(" · ") },
        { label: "Notas", text: p.notes },
        ...p.doc.slides.map((s, i) => ({ label: `Slide ${i + 1} · ${slideTitle(s)}`, text: clean(slideText(s).join(" — ")), href: `${href}?slide=${i}` })),
      ],
    });
  }

  for (const sv of d.services ?? []) {
    if (sv.archived) continue;
    const href = `/servicos/${encodeURIComponent(sv.id)}`;
    docs.push({
      kind: "service",
      id: sv.id,
      title: sv.name,
      subtitle: `€${sv.price} · ${[sv.plan, sv.tier].filter(Boolean).join(" · ")}`,
      href,
      fields: [
        { label: "Entregável", text: sv.deliverable },
        { label: "Inclui", text: sv.includes.join(" · ") },
        { label: "Indicado para", text: sv.use_for.join(" · ") },
        { label: "Etiquetas", text: [sv.tags.join(" "), sv.invoice_label].join(" ") },
      ],
    });
  }

  for (const inv of d.invoices ?? []) {
    const href = `/financas/${inv.id}`;
    docs.push({
      kind: "invoice",
      id: inv.id,
      title: inv.number,
      subtitle: inv.client.name,
      href,
      fields: [
        { label: "Cliente", text: [inv.client.name, inv.client.address.replace(/\n/g, ", "), inv.client.vat, inv.client.email].filter(Boolean).join(" · ") },
        ...inv.items.map((it) => ({ label: "Item", text: it.description })),
        { label: "Nota", text: inv.note },
      ],
    });
  }

  for (const m of d.members ?? [])
    docs.push({
      kind: "member",
      id: m.id,
      title: m.name,
      subtitle: m.role,
      href: "/equipa",
      fields: [
        { label: "Email", text: m.email },
        { label: "Função", text: m.role },
        { label: "Descrição", text: m.description },
        ...m.responsibilities.map((r) => ({ label: "Responsabilidade", text: r })),
      ],
    });

  for (const t of d.tasks ?? []) docs.push({ kind: "task", id: t.id, title: t.title, subtitle: `${t.date}${t.time ? ` ${t.time}` : ""}`, href: "/calendario", fields: [] });

  return docs;
}

function snip(text: string, at: number, len: number, ctx = 42) {
  const start = Math.max(0, at - ctx);
  const end = Math.min(text.length, at + len + ctx);
  return { before: (start > 0 ? "…" : "") + text.slice(start, at), match: text.slice(at, at + len), after: text.slice(at + len, end) + (end < text.length ? "…" : "") };
}

/** Todos os termos têm de aparecer no documento; o excerto mostra o primeiro campo onde o termo principal aparece. */
export function search(index: SearchDoc[], query: string, limit = 30): SearchHit[] {
  const terms = fold(query).split(/\s+/).filter((t) => t.length > 0);
  if (!terms.length) return [];
  const main = terms.reduce((a, b) => (b.length > a.length ? b : a));
  const hits: SearchHit[] = [];
  for (const doc of index) {
    const all = fold([doc.title, doc.subtitle, ...doc.fields.map((f) => f.text)].join(" \n "));
    if (!terms.every((t) => all.includes(t))) continue;
    const ft = fold(doc.title);
    const base = (ft.includes(main) ? 10 : 0) + (ft.startsWith(main) ? 5 : 0) + (doc.kind === "page" ? 3 : 0);
    // até 3 ocorrências por documento (ex.: várias cenas do mesmo projeto), cada uma com o seu excerto
    const found: { field: Field; at: number }[] = [];
    if (ft.includes(main)) found.push({ field: { label: doc.subtitle || doc.kind, text: doc.title }, at: ft.indexOf(main) });
    for (const f of doc.fields) {
      if (found.length >= 3) break;
      const at = fold(f.text ?? "").indexOf(main);
      if (at >= 0 && !found.some((x) => x.field.text === f.text)) found.push({ field: f, at });
    }
    if (!found.length) found.push({ field: { label: doc.subtitle || doc.kind, text: doc.title }, at: -1 });
    // fold() mantém o comprimento para texto latino, por isso as posições batem com o texto original
    found.forEach(({ field, at }, k) =>
      hits.push({ doc, field, snippet: at >= 0 ? snip(field.text, at, main.length) : { before: field.text.slice(0, 90), match: "", after: "" }, score: base + (k === 0 ? 2 : 0) - k * 0.1 })
    );
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
