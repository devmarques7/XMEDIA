"use client";

// Inspiração (estúdio): moodboards e canal de referências de cada cliente — os mesmos que o cliente vê no portal.
import { Select } from "@/components/Select";
import { useEffect, useState } from "react";
import { ClientInspiration } from "@/components/inspiration/ClientInspiration";
import { AppShell } from "@/components/ui";
import type { Customer } from "@/lib/customer";
import { customerStore } from "@/lib/customerStore";
import { useT } from "@/lib/i18n";

const LS = "xmedia:inspiration:customer";

export default function InspirationPage() {
  const { t } = useT();
  const [list, setList] = useState<Customer[]>([]);
  const [id, setId] = useState("");
  useEffect(() => {
    customerStore.list().then((l) => {
      const sorted = [...l].sort((a, b) => a.name.localeCompare(b.name));
      setList(sorted);
      let saved = "";
      try {
        saved = localStorage.getItem(LS) ?? "";
      } catch {}
      setId(sorted.some((c) => c.id === saved) ? saved : sorted[0]?.id ?? "");
    });
  }, []);
  const c = list.find((x) => x.id === id);
  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("in.sub")}</span>
          <h1 className="h1">{t("nav.inspiration")}</h1>
        </div>
        <label className="field" style={{ minWidth: 240 }}>
          <span>{t("in.pick")}</span>
          <Select
            className="select"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              try {
                localStorage.setItem(LS, e.target.value);
              } catch {}
            }}
            data-testid="in-customer"
          >
            {list.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </label>
      </section>
      {c && <ClientInspiration key={c.id} c={c} onChange={(n) => setList((l) => l.map((x) => (x.id === n.id ? n : x)))} />}
    </AppShell>
  );
}
