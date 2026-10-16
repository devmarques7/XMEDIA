"use client";

// Diretório da equipa (email → nome, foto, função) para mostrar responsáveis em qualquer quadro.
// Carregado uma vez por sessão e partilhado.
import { useEffect, useState } from "react";
import { team } from "@/lib/team";
import { customerStore } from "@/lib/customerStore";

export type TeamPerson = { email: string; name: string; photo?: string; role?: string };
let cache: Promise<Map<string, TeamPerson>> | null = null;

function load() {
  return (cache ??= Promise.all([team.members().catch(() => []), team.me().catch(() => null), customerStore.settings().catch(() => null)]).then(([ms, me, st]) => {
    const map = new Map<string, TeamPerson>();
    for (const m of ms) if (m.email) map.set(m.email.toLowerCase(), { email: m.email.toLowerCase(), name: m.name, photo: m.photo_url || undefined, role: m.role || undefined });
    // o admin: o próprio login, ou o email de contacto das definições (como no Estúdio)
    const myEmail = ((me as { email?: string } | null)?.email || st?.contact_email || "").toLowerCase();
    if (myEmail && !map.has(myEmail)) map.set(myEmail, { email: myEmail, name: "MediaMarques", role: "Admin" });
    return map;
  }));
}

export function useTeamDirectory() {
  const [dir, setDir] = useState<Map<string, TeamPerson>>(new Map());
  useEffect(() => {
    let alive = true;
    load().then((m) => alive && setDir(m));
    return () => {
      alive = false;
    };
  }, []);
  /** Pessoa por email (desconhecida: o nome é a parte antes do @). */
  const who = (email?: string): TeamPerson | null => (email ? dir.get(email.toLowerCase()) ?? { email, name: email.split("@")[0] } : null);
  return { dir, who };
}
