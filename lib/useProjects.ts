"use client";

import { useCallback, useEffect, useState } from "react";
import { store } from "./store";
import type { Project } from "./types";

/** Lista de projetos + marcar/desmarcar cenas a partir de qualquer página. */
export function useProjects() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => store.list().then(setProjects).catch((e) => setError(e.message)), []);
  useEffect(() => {
    reload();
  }, [reload]);

  const toggleScene = useCallback(
    async (projectId: string, sceneId: string) => {
      const p = projects?.find((x) => x.id === projectId);
      if (!p) return;
      const data = structuredClone(p.data);
      for (const s of data.sessions) for (const b of s.blocks) for (const c of b.scenes) if (c.id === sceneId) c.done = !c.done;
      setProjects((ps) => ps!.map((x) => (x.id === p.id ? { ...p, data } : x)));
      try {
        await store.save(p.id, { title: p.title, data });
      } catch (e) {
        setError((e as Error).message);
        reload();
      }
    },
    [projects, reload]
  );

  return { projects, setProjects, error, reload, toggleScene };
}
