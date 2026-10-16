"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { store } from "./store";
import type { Project, ProjectData } from "./types";

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Carrega um projeto e grava automaticamente (debounce) a cada alteração. */
export function useProject(id: string, delay = 700) {
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef<Project | null>(null);

  useEffect(() => {
    store.get(id).then((p) => {
      latest.current = p;
      if (p) setProject(p);
      else setMissing(true);
    });
  }, [id]);

  const flush = useCallback(async () => {
    const p = latest.current;
    if (!p) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    setSave("saving");
    try {
      await store.save(p.id, { title: p.title, data: p.data });
      setSave("saved");
    } catch {
      setSave("error");
    }
  }, []);

  const commit = useCallback(
    (next: Project, immediate = false) => {
      latest.current = next;
      setProject(next);
      setSave("saving");
      clearTimeout(timer.current);
      if (immediate) flush();
      else timer.current = setTimeout(flush, delay);
    },
    [delay, flush]
  );

  /** Muta uma cópia dos dados: update(d => { d.reels.push(...) }) */
  const update = useCallback(
    (fn: (d: ProjectData) => void, immediate = false) => {
      const cur = latest.current;
      if (!cur) return;
      const data = structuredClone(cur.data);
      fn(data);
      commit({ ...cur, data }, immediate);
    },
    [commit]
  );

  const setTitle = useCallback(
    (title: string) => latest.current && commit({ ...latest.current, title }),
    [commit]
  );

  const replace = useCallback((p: Project) => {
    latest.current = p;
    setProject(p);
  }, []);

  // grava ao sair da página
  useEffect(() => {
    const h = () => latest.current && timer.current && flush();
    window.addEventListener("beforeunload", h);
    return () => {
      window.removeEventListener("beforeunload", h);
      h();
    };
  }, [flush]);

  return { project, missing, save, update, setTitle, replace, flush };
}
