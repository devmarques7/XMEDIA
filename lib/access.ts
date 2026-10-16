"use client";

// Acesso de quem está na área privada: admin (dono do workspace) ou team member com papel.
// Fonte: função my_access() no Supabase (a mesma regra que o RLS usa). Modo local = admin.
import { useEffect, useState } from "react";
import { ADMIN_ACCESS, cleanPerms, type Access, type AppRole } from "./roles";
import { supabase, supabaseEnabled } from "./supabase/client";

let cached: Promise<Access> | null = null;

export function loadAccess(): Promise<Access> {
  if (!supabaseEnabled) return Promise.resolve(ADMIN_ACCESS);
  cached ??= (async () => {
    const { data, error } = await supabase().rpc("my_access");
    if (error || !data) return ADMIN_ACCESS; // migração ainda não aplicada → comportamento antigo (só admin)
    const d = data as { admin: boolean; role: string; permissions: string[] };
    if (d.admin) return ADMIN_ACCESS;
    return { admin: false, role: d.role as AppRole, perms: new Set(cleanPerms(d.permissions)) };
  })();
  return cached;
}
export const resetAccess = () => {
  cached = null;
};

export function useAccess(): Access | null {
  const [a, setA] = useState<Access | null>(null);
  useEffect(() => {
    let alive = true;
    loadAccess().then((x) => alive && setA(x));
    return () => {
      alive = false;
    };
  }, []);
  return a;
}
