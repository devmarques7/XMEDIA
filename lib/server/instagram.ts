// Instagram API com Instagram Login (contas profissionais: Business ou Creator).
// OAuth → token curto → token longo (60 dias, renovado na sincronização) → perfil, media, métricas e publicação.
// Precisa de INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET (Meta for Developers → app → Instagram → API setup with Instagram login).
import { isMux, muxPlayback } from "../mux";
import { mp4ForInstagram } from "./mux";
import { IG_METRICS, applyCoverRule, hasCover, parseInsights, type ContentPost, type IgMedia, type Instagram } from "@/lib/customer";
import { HttpError, serviceClient } from "./admin";
import { patchCustomer, seal, unseal } from "./portal";

const V = process.env.INSTAGRAM_GRAPH_VERSION || "v25.0";
const GRAPH = `https://graph.instagram.com/${V}`;

export const igConfigured = () => Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
export const igRedirect = (origin: string) => `${origin}/api/portal/instagram/callback`;

async function getJson(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new HttpError(502, `instagram: ${j.error?.message || j.error_message || r.status}`);
  return j;
}

/** Código do OAuth → token longo + id da conta. */
export async function exchangeCode(code: string, redirectUri: string) {
  const form = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const short = await getJson("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
  const tok = short.data?.[0] ?? short; // a API devolve { access_token, user_id, permissions } (ou dentro de data[])
  const long = await getJson(
    `https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: process.env.INSTAGRAM_APP_SECRET!, access_token: tok.access_token })}`
  );
  return { token: long.access_token as string, expiresIn: Number(long.expires_in) || 60 * 86_400, userId: String(tok.user_id ?? "") };
}

export async function storeToken(customerId: string, token: string, expiresIn: number, igUserId: string) {
  const { error } = await serviceClient()
    .from("customer_access")
    .upsert({ customer_id: customerId, ig_token: await seal(token), ig_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(), ig_user_id: igUserId, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Token válido do cliente; renova quando faltam menos de 10 dias. */
async function tokenFor(customerId: string) {
  const { data } = await serviceClient().from("customer_access").select("ig_token, ig_token_expires_at, ig_user_id").eq("customer_id", customerId).maybeSingle();
  if (!data?.ig_token) throw new HttpError(409, "ig_not_connected");
  let token = await unseal(data.ig_token);
  const exp = data.ig_token_expires_at ? new Date(data.ig_token_expires_at).getTime() : 0;
  if (exp && exp < Date.now()) throw new HttpError(409, "ig_expired");
  if (exp - Date.now() < 10 * 86_400_000) {
    const r = await getJson(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`).catch(() => null);
    if (r?.access_token) {
      token = r.access_token;
      await storeToken(customerId, token, Number(r.expires_in) || 60 * 86_400, data.ig_user_id ?? "");
    }
  }
  return { token, igUserId: data.ig_user_id as string };
}

const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

/** Perfil + últimos 24 media (com métricas por media) + métricas da conta dos últimos 28 dias. */
export async function syncInstagram(customerId: string): Promise<Instagram> {
  const { token, igUserId } = await tokenFor(customerId);
  const me = await getJson(`${GRAPH}/me?${q({ fields: "user_id,username,name,account_type,profile_picture_url,biography,followers_count,follows_count,media_count", access_token: token })}`);
  const id = String(me.user_id || igUserId);

  const list = await getJson(`${GRAPH}/me/media?${q({ fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count", limit: "24", access_token: token })}`);
  const media: IgMedia[] = await Promise.all(
    ((list.data ?? []) as Record<string, string | number>[]).map(async (m) => {
      const item: IgMedia = {
        id: String(m.id),
        caption: String(m.caption ?? ""),
        media_type: String(m.media_type ?? ""),
        product: String(m.media_product_type ?? "FEED"),
        url: String(m.thumbnail_url || m.media_url || ""),
        permalink: String(m.permalink ?? ""),
        timestamp: String(m.timestamp ?? ""),
        likes: Number(m.like_count) || 0,
        comments: Number(m.comments_count) || 0,
      };
      const ins = await getJson(`${GRAPH}/${item.id}/insights?${q({ metric: "reach,views,saved,shares", access_token: token })}`).catch(() => null);
      const v = parseInsights(ins);
      return { ...item, reach: v.reach, views: v.views, saves: v.saved, shares: v.shares };
    })
  );

  const until = Math.floor(Date.now() / 1000);
  const since = until - 28 * 86_400;
  const ins = await getJson(`${GRAPH}/${id}/insights?${q({ metric: IG_METRICS.join(","), period: "day", metric_type: "total_value", since: String(since), until: String(until), access_token: token })}`).catch(
    async () => {
      // se uma métrica falhar (conta sem dados suficientes), tenta o conjunto essencial
      return getJson(`${GRAPH}/${id}/insights?${q({ metric: "reach,views,accounts_engaged,total_interactions", period: "day", metric_type: "total_value", since: String(since), until: String(until), access_token: token })}`).catch(() => null);
    }
  );

  const today = new Date().toISOString().slice(0, 10);
  const next = await patchCustomer(customerId, (c) => {
    const history = [...(c.instagram.history ?? []).filter((h) => h.d !== today), { d: today, followers: Number(me.followers_count) || 0 }].slice(-120);
    return {
      ...c,
      instagram: {
        ...c.instagram,
        handle: String(me.username || c.instagram.handle),
        connected: true,
        ig_user_id: id,
        username: me.username,
        name: me.name,
        account_type: me.account_type,
        picture: me.profile_picture_url,
        bio: me.biography,
        followers: Number(me.followers_count) || 0,
        follows: Number(me.follows_count) || 0,
        media_count: Number(me.media_count) || 0,
        synced_at: new Date().toISOString(),
        period: { since: new Date(since * 1000).toISOString(), until: new Date(until * 1000).toISOString() },
        insights: parseInsights(ins),
        media,
        history,
        error: undefined,
      },
    };
  });
  return next.instagram;
}

// ---------- publicação (Content Publishing API) ----------
const isPublic = (src: string) => /^https:\/\//.test(src);

async function createContainer(igUserId: string, token: string, params: Record<string, string>) {
  const r = await getJson(`${GRAPH}/${igUserId}/media`, { method: "POST", body: new URLSearchParams({ ...params, access_token: token }) });
  return String(r.id);
}
async function containerStatus(id: string, token: string) {
  const r = await getJson(`${GRAPH}/${id}?${q({ fields: "status_code,status", access_token: token })}`);
  return String(r.status_code ?? "IN_PROGRESS"); // EXPIRED | ERROR | FINISHED | IN_PROGRESS | PUBLISHED
}
async function waitFinished(id: string, token: string, maxMs: number) {
  const t0 = Date.now();
  for (;;) {
    const s = await containerStatus(id, token);
    if (s === "FINISHED" || s === "PUBLISHED") return true;
    if (s === "ERROR" || s === "EXPIRED") throw new HttpError(502, `instagram: container ${s}`);
    if (Date.now() - t0 > maxMs) return false;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

/**
 * Publica um post. Reels/vídeos podem demorar a processar: se não ficar pronto a tempo, devolve
 * { pending: containerId } e o agendador volta a tentar na próxima execução.
 */
export async function publishPost(post: ContentPost, maxWaitMs = 40_000): Promise<{ id?: string; permalink?: string; pending?: string }> {
  // capa só nos reels (cover_url); nos outros tipos o Instagram usa o 1.º ficheiro
  const p = applyCoverRule(post);
  const { token, igUserId } = await tokenFor(p.customer_id);
  let files = p.media.length ? p.media : p.cover ? [{ src: p.cover, kind: "image" as const }] : [];
  if (!files.length) throw new HttpError(400, "no_media");
  // vídeos no Mux: o Instagram precisa de um MP4 (1080p); enquanto o Mux o prepara, o agendador tenta de novo
  if (!p.ig_container_id && files.some((f) => isMux(f.src))) {
    files = await Promise.all(
      files.map(async (f) => {
        if (!isMux(f.src)) return f;
        const mp4 = await mp4ForInstagram(muxPlayback(f.src));
        if (!mp4) throw new HttpError(409, "video_processing");
        return { ...f, src: mp4 };
      })
    );
  }
  if (![...files.map((f) => f.src), hasCover(p.type) ? p.cover : ""].filter(Boolean).every(isPublic)) throw new HttpError(400, "media_not_public");

  let container = p.ig_container_id;
  if (!container) {
    const caption = p.caption;
    if (p.type === "carousel" && files.length > 1) {
      const children = [];
      for (const f of files.slice(0, 10))
        children.push(await createContainer(igUserId, token, f.kind === "video" ? { media_type: "VIDEO", video_url: f.src, is_carousel_item: "true" } : { image_url: f.src, is_carousel_item: "true" }));
      for (const c of children) await waitFinished(c, token, maxWaitMs);
      container = await createContainer(igUserId, token, { media_type: "CAROUSEL", children: children.join(","), caption });
    } else if (p.type === "story") {
      const f = files[0];
      container = await createContainer(igUserId, token, f.kind === "video" ? { media_type: "STORIES", video_url: f.src } : { media_type: "STORIES", image_url: f.src });
    } else if (p.type === "reel" || files[0].kind === "video") {
      const params: Record<string, string> = { media_type: "REELS", video_url: files.find((f) => f.kind === "video")?.src ?? files[0].src, caption, share_to_feed: "true" };
      if (p.cover) params.cover_url = p.cover;
      container = await createContainer(igUserId, token, params);
    } else {
      container = await createContainer(igUserId, token, { image_url: files[0].src, caption });
    }
  }
  if (!(await waitFinished(container, token, maxWaitMs))) return { pending: container };

  const done = await getJson(`${GRAPH}/${igUserId}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: container, access_token: token }) });
  const id = String(done.id);
  const info = await getJson(`${GRAPH}/${id}?${q({ fields: "permalink", access_token: token })}`).catch(() => ({}));
  if (p.first_comment.trim()) await getJson(`${GRAPH}/${id}/comments`, { method: "POST", body: new URLSearchParams({ message: p.first_comment, access_token: token }) }).catch(() => null);
  return { id, permalink: info.permalink };
}
