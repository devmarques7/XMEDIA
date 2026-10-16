"use client";

// Inspiração de um cliente vista pelo estúdio (ficha do cliente e página Inspiração): os mesmos moodboards e
// referências do portal; grava no cliente (customerStore junta com o que o cliente alterou).
import { useAccess } from "@/lib/access";
import type { Customer } from "@/lib/customer";
import { customerStore } from "@/lib/customerStore";
import { localPreview, fileToDataUrl } from "@/lib/inspirationClient";
import { uploadMedia } from "@/lib/media";
import { mergeBoards, type Moodboard } from "@/lib/moodboard";
import { EMPTY_REFS, mergeRefs, type References } from "@/lib/references";
import { can } from "@/lib/roles";
import { supabaseEnabled } from "@/lib/supabase/client";
import { Inspiration } from "./ReferenceChannel";

const io = {
  upload: async (f: File) => (supabaseEnabled ? (await uploadMedia(f, "moodboards")).src : fileToDataUrl(f)),
  preview: async (url: string) => {
    if (!supabaseEnabled) return localPreview(url);
    const r = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    return r.ok ? r.json() : localPreview(url);
  },
};

export function ClientInspiration({ c, onChange }: { c: Customer; onChange: (c: Customer) => void }) {
  const access = useAccess();
  const save = async (next: Customer) => {
    onChange(next);
    await customerStore.save(next);
  };
  return (
    <Inspiration
      boards={c.moodboards ?? []}
      refs={c.references ?? EMPTY_REFS}
      readOnly={!can(access, "customers.edit")}
      me="MediaMarques"
      io={io}
      onSaveBoards={(b: Moodboard[]) => save({ ...c, moodboards: mergeBoards(c.moodboards, b) })}
      onSaveRefs={(r: References) => save({ ...c, references: mergeRefs(c.references, r) })}
    />
  );
}
