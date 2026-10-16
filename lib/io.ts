import { normalizeData, type Project, type ProjectData, type RefLink } from "./types";

/**
 * Formato CSV (uma linha por cena):
 * session,date,start,end,location,block,block_start,block_end,scene,description,reel,image_url,video_url,links
 * `links` = "Rótulo https://url | Outro https://url"
 */
export const CSV_COLUMNS = [
  "session",
  "date",
  "start",
  "end",
  "location",
  "block",
  "block_start",
  "block_end",
  "scene",
  "description",
  "reel",
  "image_url",
  "video_url",
  "links",
] as const;

// ---------- CSV parsing ----------
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const sep = detectSeparator(text);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase().replace(/^﻿/, ""));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/** Deteta "," (CSV), ";" (SSV — Excel PT/NL) ou tab (TSV) pela linha de cabeçalho. */
export function detectSeparator(text: string): "," | ";" | "\t" {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const count = (c: string) => first.split(c).length - 1;
  const best = ([",", ";", "\t"] as const).reduce((a, b) => (count(b) > count(a) ? b : a));
  return best;
}

const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function parseLinks(raw: string): RefLink[] {
  return raw
    .split(/\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/(https?:\/\/\S+)/);
      if (!m) return null;
      const label = s.replace(m[1], "").trim() || new URL(m[1]).hostname.replace("www.", "");
      return { label, url: m[1] };
    })
    .filter((x): x is RefLink => !!x);
}

export const formatLinks = (links: RefLink[], sep = " | ") => links.map((l) => `${l.label} ${l.url}`).join(sep);

// ---------- export ----------
export function toCSV(data: ProjectData, sep: "," | ";" = ","): string {
  const lines = [CSV_COLUMNS.join(sep)];
  const loc = (id?: string) => data.locations.find((l) => l.id === id)?.name ?? "";
  const reel = (id?: string) => data.reels.find((r) => r.id === id)?.title ?? "";
  for (const s of data.sessions) {
    const blocks = s.blocks.length ? s.blocks : [{ title: "", start: "", end: "", scenes: [] }];
    for (const b of blocks) {
      const scenes = b.scenes.length ? b.scenes : [null];
      for (const c of scenes) {
        lines.push(
          [
            s.label,
            s.date,
            s.start,
            s.end,
            loc(s.locationId),
            b.title,
            b.start,
            b.end,
            c?.title ?? "",
            c?.description ?? "",
            reel(c?.reelId),
            c?.imageUrl ?? "",
            c?.videoUrl ?? "",
            c ? formatLinks(c.links) : "",
          ]
            .map(esc)
            .join(sep)
        );
      }
    }
  }
  return lines.join("\n");
}

export function toJSON(p: Pick<Project, "title" | "data">) {
  return JSON.stringify({ format: "preprod/v1", title: p.title, data: p.data }, null, 2);
}

// ---------- import ----------
/** Aceita o export da app ({title,data}) ou só o objeto data. */
export function fromJSON(text: string): { title: string; data: ProjectData } {
  const obj = JSON.parse(text);
  const data = obj.data ?? obj;
  return { title: obj.title ?? "Importado", data: normalizeData(data) };
}

/** Junta as linhas do CSV ao projeto (cria sessões/divisões/locais/reels que não existam). */
export function mergeCSV(base: ProjectData, rows: Record<string, string>[]): { data: ProjectData; scenes: number } {
  const data = normalizeData(structuredClone(base));
  let scenes = 0;
  const id = () => crypto.randomUUID();

  for (const r of rows) {
    if (!r.session && !r.scene) continue;
    let locationId: string | undefined;
    if (r.location) {
      let l = data.locations.find((x) => x.name.toLowerCase() === r.location.toLowerCase());
      if (!l) data.locations.push((l = { id: id(), name: r.location, address: "", mapsUrl: "", notes: "" }));
      locationId = l.id;
    }
    const label = r.session || "Sessão";
    let s = data.sessions.find((x) => x.label === label && x.date === (r.date ?? ""));
    if (!s) {
      s = { id: id(), label, date: r.date ?? "", start: r.start ?? "", end: r.end ?? "", locationId, notes: "", blocks: [] };
      data.sessions.push(s);
    }
    const bt = r.block || "Geral";
    let b = s.blocks.find((x) => x.title === bt);
    if (!b) s.blocks.push((b = { id: id(), title: bt, start: r.block_start ?? "", end: r.block_end ?? "", scenes: [] }));
    if (!r.scene) continue;

    let reelId: string | undefined;
    if (r.reel) {
      let reel = data.reels.find((x) => x.title.toLowerCase() === r.reel.toLowerCase());
      if (!reel) data.reels.push((reel = { id: id(), title: r.reel, concept: "", expiresAt: "", status: "ideia" }));
      reelId = reel.id;
    }
    b.scenes.push({
      id: id(),
      title: r.scene,
      description: r.description ?? "",
      reelId,
      imageUrl: r.image_url ?? "",
      videoUrl: r.video_url ?? "",
      links: parseLinks(r.links ?? ""),
      done: false,
    });
    scenes++;
  }
  return { data, scenes };
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "projeto";

// ---------- validação ----------
export type IssueCode = "missingCols" | "noRows" | "noScene" | "date" | "time" | "url";
export type Issue = { row: number; code: IssueCode; v?: string; col?: string };

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const DATE_EU = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const TIME = /^(\d{1,2})[:.h](\d{2})$/;

function normDate(v: string): string | null {
  if (!v) return "";
  if (DATE_ISO.test(v)) return isNaN(Date.parse(v)) ? null : v;
  const m = v.match(DATE_EU);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return isNaN(Date.parse(iso)) ? null : iso;
  }
  return null;
}
function normTime(v: string): string | null {
  if (!v) return "";
  const m = v.match(TIME);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}
const isUrl = (v: string) => !v || /^https?:\/\/\S+$/.test(v);

/**
 * Valida e normaliza linhas (datas DD/MM/AAAA → ISO, 9:00 → 09:00).
 * Linhas com erro ficam de fora de `rows`. `row` = número da linha no ficheiro (cabeçalho = 1).
 */
export function validateRows(input: Record<string, string>[]): { rows: Record<string, string>[]; issues: Issue[] } {
  const issues: Issue[] = [];
  if (!input.length) return { rows: [], issues: [{ row: 0, code: "noRows" }] };
  const cols = Object.keys(input[0]);
  if (!cols.includes("scene") && !cols.includes("session"))
    return { rows: [], issues: [{ row: 1, code: "missingCols", v: "session, scene" }] };

  const rows: Record<string, string>[] = [];
  input.forEach((r, i) => {
    const row = i + 2;
    const out = { ...r };
    const before = issues.length;
    if (!r.scene && !r.session) issues.push({ row, code: "noScene" });
    const d = normDate(r.date ?? "");
    if (d === null) issues.push({ row, code: "date", v: r.date });
    else out.date = d;
    for (const c of ["start", "end", "block_start", "block_end"]) {
      const t = normTime(r[c] ?? "");
      if (t === null) issues.push({ row, code: "time", v: r[c], col: c });
      else out[c] = t;
    }
    for (const c of ["image_url", "video_url"]) if (!isUrl(r[c] ?? "")) issues.push({ row, code: "url", col: c });
    if (issues.length === before) rows.push(out);
  });
  return { rows, issues };
}

export type Parsed =
  | { kind: "json"; title: string; data: ProjectData; scenes: number }
  | { kind: "rows"; format: "CSV" | "SSV" | "TSV"; rows: Record<string, string>[]; issues: Issue[]; total: number };

/** Lê qualquer ficheiro suportado. Lança erro se o JSON for inválido. */
export function parseFile(name: string, text: string): Parsed {
  const trimmed = text.trim().replace(/^\uFEFF/, "");
  if (/\.json$/i.test(name) || trimmed.startsWith("{")) {
    const { title, data } = fromJSON(trimmed);
    const scenes = data.sessions.reduce((n, s) => n + s.blocks.reduce((m, b) => m + b.scenes.length, 0), 0);
    return { kind: "json", title, data, scenes };
  }
  const sep = detectSeparator(trimmed);
  const all = parseCSV(trimmed);
  const { rows, issues } = validateRows(all);
  return { kind: "rows", format: sep === ";" ? "SSV" : sep === "\t" ? "TSV" : "CSV", rows, issues, total: all.length };
}

export const baseName = (file: string) => file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
