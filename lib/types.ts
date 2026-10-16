export type RefLink = { label: string; url: string };

export type Scene = {
  id: string;
  title: string;
  description: string;
  reelId?: string;
  imageUrl?: string;
  videoUrl?: string;
  links: RefLink[];
  done: boolean;
};

/** Divisão de uma sessão (ex.: 08:00–09:30 "Entrevista") */
export type Block = {
  id: string;
  title: string;
  start: string;
  end: string;
  scenes: Scene[];
};

/** Sessão de gravação (ex.: Manhã, Tarde) */
export type Session = {
  id: string;
  label: string;
  date: string;
  start: string;
  end: string;
  locationId?: string;
  notes: string;
  blocks: Block[];
};

export type Location = {
  id: string;
  name: string;
  address: string;
  mapsUrl: string;
  notes: string;
};

export type Definition = { id: string; label: string; value: string };

export const REEL_STATUS = ["ideia", "aprovado", "gravado", "editado", "publicado"] as const;
export type ReelStatus = (typeof REEL_STATUS)[number];

export type Reel = {
  id: string;
  title: string;
  concept: string;
  expiresAt: string;
  status: ReelStatus;
};

export type ProjectData = {
  client: string;
  description: string;
  shootDate: string;
  definitions: Definition[];
  reels: Reel[];
  locations: Location[];
  sessions: Session[];
};

export type Project = {
  id: string;
  title: string;
  data: ProjectData;
  version: number;
  created_at: string;
  updated_at: string;
};

export type ProjectVersion = {
  id: string;
  project_id: string;
  version: number;
  title: string;
  data: ProjectData;
  note: string | null;
  created_at: string;
};

export const emptyData = (labels = { format: "Formato", look: "Look", gear: "Equipamento" }): ProjectData => ({
  client: "",
  description: "",
  shootDate: "",
  definitions: [
    { id: crypto.randomUUID(), label: labels.format, value: "9:16 · 4K 25fps" },
    { id: crypto.randomUUID(), label: labels.look, value: "" },
    { id: crypto.randomUUID(), label: labels.gear, value: "" },
  ],
  reels: [],
  locations: [],
  sessions: [],
});

/** Garante que dados importados/antigos têm todos os campos. */
export function normalizeData(input: unknown): ProjectData {
  const d = (input ?? {}) as Partial<ProjectData>;
  const id = (x?: string) => x || crypto.randomUUID();
  return {
    client: d.client ?? "",
    description: d.description ?? "",
    shootDate: d.shootDate ?? "",
    definitions: (d.definitions ?? []).map((x) => ({ id: id(x.id), label: x.label ?? "", value: x.value ?? "" })),
    reels: (d.reels ?? []).map((r) => ({
      id: id(r.id),
      title: r.title ?? "",
      concept: r.concept ?? "",
      expiresAt: r.expiresAt ?? "",
      status: REEL_STATUS.includes(r.status as ReelStatus) ? (r.status as ReelStatus) : "ideia",
    })),
    locations: (d.locations ?? []).map((l) => ({
      id: id(l.id),
      name: l.name ?? "",
      address: l.address ?? "",
      mapsUrl: l.mapsUrl ?? "",
      notes: l.notes ?? "",
    })),
    sessions: (d.sessions ?? []).map((s) => ({
      id: id(s.id),
      label: s.label ?? "",
      date: s.date ?? "",
      start: s.start ?? "",
      end: s.end ?? "",
      locationId: s.locationId,
      notes: s.notes ?? "",
      blocks: (s.blocks ?? []).map((b) => ({
        id: id(b.id),
        title: b.title ?? "",
        start: b.start ?? "",
        end: b.end ?? "",
        scenes: (b.scenes ?? []).map((c) => ({
          id: id(c.id),
          title: c.title ?? "",
          description: c.description ?? "",
          reelId: c.reelId,
          imageUrl: c.imageUrl ?? "",
          videoUrl: c.videoUrl ?? "",
          links: (c.links ?? []).filter((l) => l && l.url),
          done: !!c.done,
        })),
      })),
    })),
  };
}

export type Task = {
  id: string;
  title: string;
  date: string; // AAAA-MM-DD
  time: string; // HH:MM ou ""
  done: boolean;
};

export type Profile = {
  display_name: string;
  role: string;
  city: string;
  bio: string;
  interests: string[];
  avatar_url: string;
  website: string;
  phone: string;
  created_at?: string;
};

export const emptyProfile = (): Profile => ({
  display_name: "",
  role: "",
  city: "",
  bio: "",
  interests: [],
  avatar_url: "",
  website: "",
  phone: "",
});

/** Versão sem o snapshot completo (para listas de histórico). */
export type VersionMeta = Omit<ProjectVersion, "data">;
