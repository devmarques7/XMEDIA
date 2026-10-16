import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectSeparator, mergeCSV, parseCSV, parseFile, toCSV, toJSON } from "../lib/io";
import { emptyData } from "../lib/types";

const sample = readFileSync(new URL("../samples/exemplo.json", import.meta.url), "utf8");
const blank = () => ({ ...emptyData(), definitions: [] });

describe("criar projeto a partir de ficheiro", () => {
  it("JSON: lê o exemplo completo", () => {
    const p = parseFile("exemplo.json", sample);
    if (p.kind !== "json") throw new Error("esperava json");
    expect(p.title).toBe("Café Atelier — Outubro");
    expect(p.data.reels).toHaveLength(4);
    expect(p.scenes).toBe(8);
    expect(p.data.sessions[0].blocks[0].scenes[0].reelId).toBe(p.data.reels[2].id);
  });

  it("JSON: aceita só o objeto data e completa campos em falta", () => {
    const p = parseFile("x.json", JSON.stringify({ sessions: [{ label: "Manhã", blocks: [{ scenes: [{ title: "A" }] }] }] }));
    if (p.kind !== "json") throw new Error();
    expect(p.data.sessions[0].blocks[0].scenes[0]).toMatchObject({ title: "A", done: false, links: [] });
    expect(p.data.sessions[0].id).toBeTruthy();
  });

  it("JSON inválido lança erro", () => {
    expect(() => parseFile("x.json", "{ nope")).toThrow();
  });

  for (const [format, sep] of [["CSV", ","], ["SSV", ";"]] as const) {
    it(`${format}: ida e volta sem perder cenas, reels, locais nem links`, () => {
      const original = parseFile("exemplo.json", sample);
      if (original.kind !== "json") throw new Error();
      const p = parseFile(`x.${format.toLowerCase()}`, toCSV(original.data, sep));
      if (p.kind !== "rows") throw new Error();
      expect(p.format).toBe(format);
      expect(p.issues).toEqual([]);
      const { data, scenes } = mergeCSV(blank(), p.rows);
      expect(scenes).toBe(8);
      expect(data.sessions.map((s) => s.label)).toEqual(["Manhã", "Tarde"]);
      expect(data.reels).toHaveLength(4);
      expect(data.locations).toHaveLength(1);
      expect(data.sessions[0].blocks[0].scenes[1].links).toEqual([{ label: "Moodboard", url: "https://pinterest.com" }]);
    });
  }

  it("TSV simples", () => {
    const p = parseFile("x.tsv", "session\tscene\nManhã\tPlano 1\nManhã\tPlano 2");
    if (p.kind !== "rows") throw new Error();
    expect(p.format).toBe("TSV");
    expect(mergeCSV(blank(), p.rows).scenes).toBe(2);
  });

  it("normaliza datas DD/MM/AAAA e horas 9:00", () => {
    const p = parseFile("x.ssv", "session;date;start;scene\nManhã;15/10/2026;9:00;A");
    if (p.kind !== "rows") throw new Error();
    expect(p.rows[0]).toMatchObject({ date: "2026-10-15", start: "09:00" });
  });

  it("aponta erros por linha e ignora só as linhas más", () => {
    const csv = [
      "session,date,start,scene,image_url",
      "Manhã,2026-10-15,08:00,OK,",
      "Manhã,ontem,08:00,Data má,",
      "Manhã,2026-10-15,25:00,Hora má,",
      "Manhã,2026-10-15,08:00,URL má,pinterest",
    ].join("\n");
    const p = parseFile("x.csv", csv);
    if (p.kind !== "rows") throw new Error();
    expect(p.rows).toHaveLength(1);
    expect(p.issues.map((i) => [i.row, i.code])).toEqual([[3, "date"], [4, "time"], [5, "url"]]);
  });

  it("recusa ficheiro sem colunas session/scene", () => {
    const p = parseFile("x.csv", "nome,valor\na,b");
    if (p.kind !== "rows") throw new Error();
    expect(p.issues[0].code).toBe("missingCols");
    expect(p.rows).toHaveLength(0);
  });

  it("deteta separador", () => {
    expect(detectSeparator("a;b;c")).toBe(";");
    expect(detectSeparator("a,b,c")).toBe(",");
    expect(detectSeparator("a\tb")).toBe("\t");
  });

  it("CSV com aspas, vírgulas e quebras de linha no campo", () => {
    const rows = parseCSV('session,scene,description\nManhã,"Plano, aberto","linha 1\nlinha 2 com ""aspas"""');
    expect(rows[0]).toEqual({ session: "Manhã", scene: "Plano, aberto", description: 'linha 1\nlinha 2 com "aspas"' });
  });

  it("export JSON reimporta igual", () => {
    const p = parseFile("exemplo.json", sample);
    if (p.kind !== "json") throw new Error();
    const again = parseFile("y.json", toJSON({ title: p.title, data: p.data }));
    if (again.kind !== "json") throw new Error();
    expect(again.data).toEqual(p.data);
  });

  it("templates publicados são válidos", () => {
    for (const f of ["template.csv", "template.ssv", "template.json"]) {
      const p = parseFile(f, readFileSync(new URL(`../public/templates/${f}`, import.meta.url), "utf8"));
      if (p.kind === "rows") {
        expect(p.issues, f).toEqual([]);
        expect(p.rows.length, f).toBe(3);
      } else expect(p.scenes, f).toBeGreaterThan(0);
    }
  });
});
