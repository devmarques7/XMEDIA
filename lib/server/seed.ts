// Primeiro login do admin numa base vazia: importa os clientes do Notion e cria um cliente demo
// (com um reel e um carrossel para aprovação) para testar o portal e apresentar a plataforma.
import { MILESTONES, emptyCustomer, emptyPost, seedCustomers, type ContentPost, type Customer } from "@/lib/customer";
import { serviceClient } from "./admin";

export const DEMO_EMAIL = "contact+cliente@mediamarques.com";
const img = (id: string) => `https://images.unsplash.com/${id}?w=1080&q=75&auto=format&fit=crop`;

function demoCustomer(): Customer {
  const c = emptyCustomer("Cliente Demo · XMEDIA");
  return {
    ...c,
    contact: "Cliente Teste",
    email: DEMO_EMAIL,
    stage: "stage4",
    contract_signed: true,
    done: (["stage0", "stage1", "stage2", "stage3"] as const).flatMap((s) => MILESTONES[s].map((m) => m.code)),
    instagram: { handle: "mediamarques", connected: false },
    notes: "Cliente de demonstração (login de teste). Pode apagar quando já não for preciso.",
  };
}

function demoPosts(customerId: string): ContentPost[] {
  const day = (d: number, h: number) => {
    const x = new Date();
    x.setDate(x.getDate() + d);
    x.setHours(h, 0, 0, 0);
    return x.toISOString();
  };
  const reel = emptyPost(customerId, "reel");
  const carousel = emptyPost(customerId, "carousel");
  const post = emptyPost(customerId, "post");
  return [
    {
      ...reel,
      title: "Reel lançamento",
      status: "review",
      round: 1,
      caption: "O lançamento da nova coleção. Reserve a sua visita privada. #mediamarques #amsterdam",
      cover: img("photo-1574717024653-61fd2cf4d44d"),
      media: [{ src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", kind: "video", caption: "reel.mp4" }],
      scheduled_at: day(4, 18),
    },
    {
      ...carousel,
      title: "Carrossel autoridade",
      status: "review",
      round: 1,
      caption: "3 detalhes que fazem a diferença.",
      cover: img("photo-1601506521937-0121a7fc2a6b"),
      media: ["photo-1601506521937-0121a7fc2a6b", "photo-1485846234645-a62644f84728", "photo-1516035069371-29a1b244cc32"].map((id) => ({ src: img(id), kind: "image" as const })),
      scheduled_at: day(6, 12),
    },
    { ...post, title: "Bastidores", status: "draft", caption: "Por trás da câmara.", cover: img("photo-1492691527719-9d1e07e534b4"), scheduled_at: day(9, 12) },
  ];
}

/** Só corre se este admin ainda não tiver nenhum cliente. */
export async function seedOwnerIfEmpty(ownerId: string) {
  const db = serviceClient();
  const { count } = await db.from("customers").select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
  if ((count ?? 0) > 0) return false;
  const rows = [...seedCustomers(), demoCustomer()].map((c) => {
    const { created_at: _c, updated_at: _u, ...doc } = c;
    return { id: c.id, owner_id: ownerId, name: c.name, email: c.email, stage: c.stage, data: doc };
  });
  const { error } = await db.from("customers").insert(rows);
  if (error) throw error;
  const demo = rows[rows.length - 1];
  const posts = demoPosts(demo.id).map((p) => {
    const { created_at: _c, updated_at: _u, ...doc } = p;
    return { id: p.id, owner_id: ownerId, customer_id: p.customer_id, status: p.status, scheduled_at: p.scheduled_at || null, data: doc };
  });
  await db.from("customer_posts").insert(posts);
  return true;
}
