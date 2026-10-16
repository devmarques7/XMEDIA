import type { ContentPost } from "@/lib/customer";
import { publishPost } from "./instagram";
import { savePostServer } from "./portal";

/** Publica e grava o resultado no post (publicado, em processamento ou falhado). */
export async function runPublish(p: ContentPost, maxWaitMs?: number) {
  try {
    const r = await publishPost(p, maxWaitMs);
    if (r.pending) {
      await savePostServer({ ...p, ig_container_id: r.pending, error: "" });
      return { ok: false, pending: true };
    }
    await savePostServer({ ...p, status: "published", published_at: new Date().toISOString(), ig_media_id: r.id ?? "", permalink: r.permalink ?? "", ig_container_id: "", error: "" });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : "error";
    await savePostServer({ ...p, status: "failed", error, ig_container_id: "" });
    return { ok: false, error };
  }
}
