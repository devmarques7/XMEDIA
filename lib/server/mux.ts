// API do Mux (servidor). Chaves MUX_TOKEN_ID / MUX_TOKEN_SECRET só na Vercel; o browser recebe apenas o URL de upload.
import { HttpError } from "./admin";

export const muxEnabled = () => !!(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);

async function mux<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  if (!muxEnabled()) throw new HttpError(503, "mux_not_configured");
  const auth = Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString("base64");
  const r = await fetch(`https://api.mux.com${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(r.status === 401 ? 503 : 502, `mux_${r.status}${j?.error?.messages?.[0] ? `: ${j.error.messages[0]}` : ""}`);
  return j.data as T;
}

/**
 * Upload direto: o browser envia o ficheiro (em partes) para o URL devolvido. Até 4K; MP4 de 720p/1080p/2160p
 * para download e Instagram (o Mux não aumenta a resolução: só cria os que o original permite).
 */
export async function createUpload(origin: string, passthrough: string) {
  const u = await mux<{ id: string; url: string }>("/video/v1/uploads", {
    method: "POST",
    body: {
      cors_origin: origin,
      timeout: 86400,
      new_asset_settings: {
        playback_policies: ["public"],
        video_quality: "plus",
        max_resolution_tier: "2160p",
        static_renditions: [{ resolution: "720p" }, { resolution: "1080p" }, { resolution: "2160p" }],
        passthrough,
      },
    },
  });
  return { id: u.id, url: u.url };
}

type Asset = { id: string; status: string; duration?: number; max_stored_resolution?: string; playback_ids?: { id: string; policy: string }[]; static_renditions?: { files?: { name: string; status: string }[] }; errors?: { messages?: string[] } };

/** Estado de um upload: quando o Mux cria o vídeo devolve o playback id (já se pode ver enquanto acaba de processar). */
export async function uploadStatus(id: string) {
  const u = await mux<{ status: string; asset_id?: string; error?: { message?: string } }>(`/video/v1/uploads/${encodeURIComponent(id)}`);
  if (u.status === "errored" || u.status === "cancelled" || u.status === "timed_out") throw new HttpError(502, `mux_upload_${u.status}`);
  if (!u.asset_id) return { status: u.status };
  const a = await mux<Asset>(`/video/v1/assets/${u.asset_id}`);
  if (a.status === "errored") throw new HttpError(502, `mux_asset_errored${a.errors?.messages?.[0] ? `: ${a.errors.messages[0]}` : ""}`);
  return { status: a.status, asset_id: a.id, playback_id: a.playback_ids?.find((p) => p.policy === "public")?.id, duration: a.duration, resolution: a.max_stored_resolution };
}

/** MP4 pronto para o Instagram (máx. 1080p); null enquanto o Mux o prepara. */
export async function mp4ForInstagram(playbackId: string): Promise<string | null> {
  const p = await mux<{ object: { type: string; id: string } }>(`/video/v1/playback-ids/${encodeURIComponent(playbackId)}`);
  if (p.object?.type !== "asset") return null;
  const a = await mux<Asset>(`/video/v1/assets/${p.object.id}`);
  const ready = new Set((a.static_renditions?.files ?? []).filter((f) => f.status === "ready").map((f) => f.name));
  const name = ["1080p.mp4", "720p.mp4"].find((n) => ready.has(n));
  return name ? `https://stream.mux.com/${playbackId}/${name}` : null;
}
