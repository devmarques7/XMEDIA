"use client";

import { supabase, supabaseEnabled } from "./supabase/client";
import { emptyData, emptyProfile, normalizeData, type Profile, type Project, type ProjectData, type ProjectVersion, type Task, type VersionMeta } from "./types";

/**
 * Camada de dados. Com Supabase configurado grava na base de dados;
 * sem ele usa localStorage (modo local, útil para testar).
 */
export interface Store {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(title: string, data?: ProjectData): Promise<Project>;
  save(id: string, patch: { title: string; data: ProjectData }): Promise<void>;
  remove(id: string): Promise<void>;
  versions(id: string): Promise<ProjectVersion[]>;
  snapshot(id: string, note: string): Promise<ProjectVersion>;
  restore(id: string, versionId: string, note?: string): Promise<Project>;
  /** Histórico de todas as versões, mais recentes primeiro. */
  allVersions(limit?: number): Promise<VersionMeta[]>;
  tasks(from: string, to: string): Promise<Task[]>;
  addTask(t: Omit<Task, "id">): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<void>;
  removeTask(id: string): Promise<void>;
  profile(): Promise<Profile | null>;
  saveProfile(p: Profile): Promise<void>;
  removeProfile(): Promise<void>;
}

const fix = <T extends { data: unknown }>(row: T) => ({ ...row, data: normalizeData(row.data) });

const remote: Store = {
  async list() {
    const { data, error } = await supabase().from("projects").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as Project[]).map(fix);
  },
  async get(id) {
    const { data, error } = await supabase().from("projects").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fix(data as Project) : null;
  },
  async create(title, data = emptyData()) {
    const { data: row, error } = await supabase().from("projects").insert({ title, data }).select().single();
    if (error) throw error;
    return fix(row as Project);
  },
  async save(id, patch) {
    const { error } = await supabase().from("projects").update(patch).eq("id", id);
    if (error) throw error;
  },
  async remove(id) {
    const { error } = await supabase().from("projects").delete().eq("id", id);
    if (error) throw error;
  },
  async versions(id) {
    const { data, error } = await supabase()
      .from("project_versions")
      .select("*")
      .eq("project_id", id)
      .order("version", { ascending: false });
    if (error) throw error;
    return (data as ProjectVersion[]).map(fix);
  },
  async snapshot(id, note) {
    const p = await this.get(id);
    if (!p) throw new Error("Projeto não encontrado");
    const { data, error } = await supabase()
      .from("project_versions")
      .insert({ project_id: id, version: p.version, title: p.title, data: p.data, note })
      .select()
      .single();
    if (error) throw error;
    await supabase().from("projects").update({ version: p.version + 1 }).eq("id", id);
    return fix(data as ProjectVersion);
  },
  async restore(id, versionId, note) {
    const { data: v, error } = await supabase().from("project_versions").select("*").eq("id", versionId).single();
    if (error) throw error;
    await this.snapshot(id, note ?? `v${v.version} ↺`);
    await this.save(id, { title: v.title, data: v.data });
    return (await this.get(id))!;
  },
  async allVersions(limit = 200) {
    const { data, error } = await supabase()
      .from("project_versions")
      .select("id, project_id, version, title, note, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as VersionMeta[];
  },
  async tasks(from, to) {
    const { data, error } = await supabase().from("tasks").select("id, title, date, time, done").gte("date", from).lte("date", to).order("time");
    if (error) throw error;
    return data as Task[];
  },
  async addTask(t) {
    const { data, error } = await supabase().from("tasks").insert(t).select("id, title, date, time, done").single();
    if (error) throw error;
    return data as Task;
  },
  async updateTask(id, patch) {
    const { error } = await supabase().from("tasks").update(patch).eq("id", id);
    if (error) throw error;
  },
  async removeTask(id) {
    const { error } = await supabase().from("tasks").delete().eq("id", id);
    if (error) throw error;
  },
  async profile() {
    const { data, error } = await supabase().from("profiles").select("*").maybeSingle();
    if (error) throw error;
    return data ? ({ ...emptyProfile(), ...data } as Profile) : null;
  },
  async saveProfile(p) {
    const { data: u } = await supabase().auth.getUser();
    const { created_at: _c, ...rest } = p;
    const { error } = await supabase().from("profiles").upsert({ ...rest, id: u.user!.id });
    if (error) throw error;
  },
  async removeProfile() {
    const { data: u } = await supabase().auth.getUser();
    const { error } = await supabase().from("profiles").delete().eq("id", u.user!.id);
    if (error) throw error;
  },
};

// ---------- modo local ----------
const LS_P = "preprod:projects";
const LS_V = "preprod:versions";
const LS_T = "preprod:tasks";
const LS_PROFILE = "preprod:profile";
const read = <T,>(k: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(k) || "[]");
  } catch {
    return [];
  }
};
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const now = () => new Date().toISOString();

const local: Store = {
  async list() {
    return read<Project>(LS_P).map(fix).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
  async get(id) {
    const p = read<Project>(LS_P).find((x) => x.id === id);
    return p ? fix(p) : null;
  },
  async create(title, data = emptyData()) {
    const p: Project = { id: crypto.randomUUID(), title, data, version: 1, created_at: now(), updated_at: now() };
    write(LS_P, [...read<Project>(LS_P), p]);
    return p;
  },
  async save(id, patch) {
    write(LS_P, read<Project>(LS_P).map((p) => (p.id === id ? { ...p, ...patch, updated_at: now() } : p)));
  },
  async remove(id) {
    write(LS_P, read<Project>(LS_P).filter((p) => p.id !== id));
    write(LS_V, read<ProjectVersion>(LS_V).filter((v) => v.project_id !== id));
  },
  async versions(id) {
    return read<ProjectVersion>(LS_V)
      .filter((v) => v.project_id === id)
      .map(fix)
      .sort((a, b) => b.version - a.version);
  },
  async snapshot(id, note) {
    const p = await this.get(id);
    if (!p) throw new Error("Projeto não encontrado");
    const v: ProjectVersion = {
      id: crypto.randomUUID(),
      project_id: id,
      version: p.version,
      title: p.title,
      data: p.data,
      note,
      created_at: now(),
    };
    write(LS_V, [...read<ProjectVersion>(LS_V), v]);
    write(LS_P, read<Project>(LS_P).map((x) => (x.id === id ? { ...x, version: x.version + 1 } : x)));
    return v;
  },
  async restore(id, versionId, note) {
    const v = read<ProjectVersion>(LS_V).find((x) => x.id === versionId);
    if (!v) throw new Error("Versão não encontrada");
    await this.snapshot(id, note ?? `v${v.version} ↺`);
    await this.save(id, { title: v.title, data: v.data });
    return (await this.get(id))!;
  },
  async allVersions(limit = 200) {
    return read<ProjectVersion>(LS_V)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map(({ data: _d, ...meta }) => meta);
  },
  async tasks(from, to) {
    return read<Task>(LS_T)
      .filter((t) => t.date >= from && t.date <= to)
      .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  },
  async addTask(t) {
    const task = { ...t, id: crypto.randomUUID() };
    write(LS_T, [...read<Task>(LS_T), task]);
    return task;
  },
  async updateTask(id, patch) {
    write(LS_T, read<Task>(LS_T).map((t) => (t.id === id ? { ...t, ...patch } : t)));
  },
  async removeTask(id) {
    write(LS_T, read<Task>(LS_T).filter((t) => t.id !== id));
  },
  async profile() {
    try {
      const p = JSON.parse(localStorage.getItem(LS_PROFILE) || "null");
      return p ? { ...emptyProfile(), ...p } : null;
    } catch {
      return null;
    }
  },
  async saveProfile(p) {
    const cur = await this.profile();
    localStorage.setItem(LS_PROFILE, JSON.stringify({ ...p, created_at: cur?.created_at ?? now() }));
  },
  async removeProfile() {
    localStorage.removeItem(LS_PROFILE);
  },
};

export const store: Store = supabaseEnabled ? remote : local;
export const isLocalMode = !supabaseEnabled;
