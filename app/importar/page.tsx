"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fromJSON } from "@/lib/io";
import { store } from "@/lib/store";

/** Importa um briefing publicado em /briefings/*.json com um toque: /importar?src=/briefings/x.json */
export default function Page() {
  return (
    <Suspense>
      <Importer />
    </Suspense>
  );
}

function Importer() {
  const src = useSearchParams().get("src") ?? "";
  const router = useRouter();
  const [msg, setMsg] = useState("A importar…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!/^\/briefings\/[\w-]+\.json$/.test(src)) return setMsg("Ficheiro inválido.");
      try {
        const { title, data } = fromJSON(await (await fetch(src)).text());
        const existing = (await store.list()).find((p) => p.title === title);
        if (existing) return router.replace(`/p/${existing.id}?tab=cenas`);
        const p = await store.create(title, data);
        await store.snapshot(p.id, "Importado do briefing (PDF)");
        router.replace(`/p/${p.id}?tab=cenas`);
      } catch (e) {
        setMsg((e as Error).message);
      }
    })();
  }, [src, router]);

  return (
    <main className="wrap">
      <p className="label muted" style={{ paddingTop: 40 }}>
        {msg}
      </p>
    </main>
  );
}
