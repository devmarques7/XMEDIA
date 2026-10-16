"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Deck } from "@/components/proposal/Deck";
import type { Proposal } from "@/lib/proposal";
import { proposalStore } from "@/lib/proposalStore";

export default function Present() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Proposal | null>(null);
  useEffect(() => {
    proposalStore.get(id).then(setP);
  }, [id]);
  return p ? <Deck doc={p.doc} title={p.title} /> : null;
}
