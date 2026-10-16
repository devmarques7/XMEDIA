// Armazenamento de objetos compatível com S3 para vídeos e ficheiros grandes. O browser envia em partes paralelas
// diretamente para o fornecedor com URLs assinados — a Vercel só assina. Mudar de fornecedor = mudar as variáveis.
//
// Cloudflare R2 (predefinido): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
// Qualquer outro S3 (Backblaze B2, Hetzner, Scaleway, Wasabi…): S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID,
//   S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_PUBLIC_URL — têm prioridade sobre as R2_* quando definidas.
import { createHash } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { HttpError } from "./admin";

export const PART = 32 * 1024 * 1024; // 32 MB por parte (mínimo de 5 MB em todos os fornecedores S3)
export const MAX_BYTES = 50 * 1024 ** 3; // 50 GB por ficheiro

type Cfg = { endpoint: string; region: string; key: string; secret: string; bucket: string; publicUrl: string; provider: string };
const env = (k: string) => process.env[k]?.trim() || "";
export function storeConfig(): Cfg | null {
  if (env("S3_ENDPOINT") && env("S3_ACCESS_KEY_ID") && env("S3_SECRET_ACCESS_KEY") && env("S3_BUCKET") && env("S3_PUBLIC_URL"))
    return { endpoint: env("S3_ENDPOINT").replace(/\/$/, ""), region: env("S3_REGION") || "auto", key: env("S3_ACCESS_KEY_ID"), secret: env("S3_SECRET_ACCESS_KEY"), bucket: env("S3_BUCKET"), publicUrl: env("S3_PUBLIC_URL").replace(/\/$/, ""), provider: new URL(env("S3_ENDPOINT")).hostname };
  if (env("R2_ACCOUNT_ID") && env("R2_ACCESS_KEY_ID") && env("R2_SECRET_ACCESS_KEY") && env("R2_BUCKET") && env("R2_PUBLIC_URL"))
    return { endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`, region: "auto", key: env("R2_ACCESS_KEY_ID"), secret: env("R2_SECRET_ACCESS_KEY"), bucket: env("R2_BUCKET"), publicUrl: env("R2_PUBLIC_URL").replace(/\/$/, ""), provider: "Cloudflare R2" };
  return null;
}
export const r2Enabled = () => !!storeConfig();

let client: { c: AwsClient; sig: string } | null = null;
function cfg() {
  const c = storeConfig();
  if (!c) throw new HttpError(503, "storage_not_configured");
  return c;
}
function r2() {
  const c = cfg();
  const sig = `${c.key}@${c.region}`;
  if (client?.sig !== sig) client = { c: new AwsClient({ accessKeyId: c.key, secretAccessKey: c.secret, service: "s3", region: c.region }), sig };
  return client.c;
}
// endereços "path-style" (endpoint/bucket/chave): aceites por R2, B2, Hetzner, Scaleway e Wasabi
const base = () => `${cfg().endpoint}/${cfg().bucket}`;
const enc = (key: string) => key.split("/").map(encodeURIComponent).join("/");
const objUrl = (key: string) => `${base()}/${enc(key)}`;
export const publicUrl = (key: string) => `${cfg().publicUrl}/${enc(key)}`;
const xmlEsc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

async function call(url: string, init: RequestInit = {}) {
  const r = await r2().fetch(url, init);
  const text = await r.text();
  if (!r.ok) throw new HttpError(502, `s3_${r.status}${/<Code>([^<]+)/.exec(text)?.[1] ? `: ${/<Code>([^<]+)/.exec(text)![1]}` : ""}`);
  return text;
}

// configurações do bucket (CORS, ciclo de vida) exigem Content-MD5 na API S3
const md5 = (body: string) => createHash("md5").update(body).digest("base64");
async function putConfig(sub: "cors" | "lifecycle", body: string) {
  await call(`${base()}?${sub}`, { method: "PUT", body, headers: { "Content-Type": "application/xml", "Content-MD5": md5(body) } });
}

/** Regra CORS: o browser pode enviar as partes (PUT) e ler o ETag a partir da app. */
export const corsXml = (origins: string[]) =>
  `<CORSConfiguration><CORSRule>${[...new Set(origins)].map((o) => `<AllowedOrigin>${xmlEsc(o)}</AllowedOrigin>`).join("")}<AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
const appOrigins = (origin: string) => [origin, "https://xmedia-studio.vercel.app", "http://localhost:3123", "http://localhost:3000"];

/**
 * CORS do bucket. Feito uma vez por instância; se o token não tiver permissão de configuração, o upload continua a
 * funcionar desde que o CORS tenha sido definido no painel do fornecedor (o teste nas Definições mostra se está certo).
 */
let corsDone = false;
export async function ensureCors(origin: string, force = false) {
  if (corsDone && !force) return true;
  try {
    await putConfig("cors", corsXml(appOrigins(origin)));
    corsDone = true;
    return true;
  } catch {
    corsDone = true;
    return false;
  }
}

/**
 * Ciclo de vida: ficheiros com mais de `days` dias passam para acesso pouco frequente (R2: 10 $/TB em vez de 15 $)
 * e envios em partes abandonados são apagados ao fim de 7 dias (não ocupam espaço pago).
 */
export async function applyLifecycle(days = 60) {
  const ia = `<Rule><ID>xmedia-arquivo-${days}d</ID><Status>Enabled</Status><Filter><Prefix></Prefix></Filter><Transition><Days>${days}</Days><StorageClass>STANDARD_IA</StorageClass></Transition></Rule>`;
  const abort = `<Rule><ID>xmedia-limpar-envios</ID><Status>Enabled</Status><Filter><Prefix></Prefix></Filter><AbortIncompleteMultipartUpload><DaysAfterInitiation>7</DaysAfterInitiation></AbortIncompleteMultipartUpload></Rule>`;
  try {
    await putConfig("lifecycle", `<LifecycleConfiguration>${ia}${abort}</LifecycleConfiguration>`);
    return { archive: true, cleanup: true };
  } catch {
    // alguns fornecedores (ex.: Backblaze) não têm classe "pouco frequente": aplica só a limpeza
    await putConfig("lifecycle", `<LifecycleConfiguration>${abort}</LifecycleConfiguration>`);
    return { archive: false, cleanup: true };
  }
}

/** Espaço usado por pasta de primeiro nível dentro do workspace (ex.: customers/<id>, moodboards, documents). */
export async function usage(owner: string, maxObjects = 50_000) {
  const groups = new Map<string, { bytes: number; files: number }>();
  let token = "";
  let seen = 0;
  do {
    const u = new URL(base());
    u.searchParams.set("list-type", "2");
    u.searchParams.set("prefix", `${owner}/`);
    u.searchParams.set("max-keys", "1000");
    if (token) u.searchParams.set("continuation-token", token);
    const xml = await call(u.toString());
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = /<Key>([^<]+)<\/Key>/.exec(m[1])?.[1] ?? "";
      const size = Number(/<Size>(\d+)<\/Size>/.exec(m[1])?.[1] ?? 0);
      const rest = key.slice(owner.length + 1).split("/");
      const group = rest[0] === "customers" && rest.length > 2 ? `customers/${rest[1]}` : rest.length > 1 ? rest[0] : "outros";
      const g = groups.get(group) ?? { bytes: 0, files: 0 };
      g.bytes += size;
      g.files += 1;
      groups.set(group, g);
      seen++;
    }
    token = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "";
  } while (token && seen < maxObjects);
  return { groups: [...groups.entries()].map(([group, v]) => ({ group, ...v })), truncated: !!token };
}

/** Teste completo: escrever, abrir pelo link público, CORS para a app, apagar. */
export async function selfTest(owner: string, origin: string) {
  const key = `${owner}/_teste/${crypto.randomUUID()}.txt`;
  const out = { write: false, public: false, cors: false, corsAuto: false, delete: false, error: "" };
  try {
    await call(objUrl(key), { method: "PUT", body: "xmedia", headers: { "Content-Type": "text/plain" } });
    out.write = true;
    out.corsAuto = await ensureCors(origin, true);
    const pub = await fetch(publicUrl(key), { cache: "no-store", signal: AbortSignal.timeout(10_000) }).catch(() => null);
    out.public = !!pub?.ok && (await pub.text()) === "xmedia";
    // pré-pedido CORS como o browser o faz antes de enviar uma parte
    const signed = await signPart(key, "teste", 1);
    const pre = await fetch(signed, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "PUT" }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    const allow = pre?.headers.get("access-control-allow-origin") ?? "";
    out.cors = allow === "*" || allow === origin;
  } catch (e) {
    out.error = (e as Error).message;
  }
  try {
    if (out.write) {
      await call(objUrl(key), { method: "DELETE" });
      out.delete = true;
    }
  } catch {}
  return out;
}

/** Inicia um envio em partes e devolve um URL assinado (6 h, renovável) para cada parte. */
export async function createMultipart(key: string, contentType: string, size: number) {
  if (!size || size > MAX_BYTES) throw new HttpError(413, "too_big");
  const xml = await call(`${objUrl(key)}?uploads`, { method: "POST", headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
  const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(xml)?.[1];
  if (!uploadId) throw new HttpError(502, "s3_no_upload_id");
  const parts = Math.max(1, Math.ceil(size / PART));
  const urls = await Promise.all(Array.from({ length: parts }, (_, i) => signPart(key, uploadId, i + 1)));
  return { uploadId, partSize: PART, urls };
}

export async function signPart(key: string, uploadId: string, partNumber: number) {
  const u = new URL(objUrl(key));
  u.searchParams.set("partNumber", String(partNumber));
  u.searchParams.set("uploadId", uploadId);
  u.searchParams.set("X-Amz-Expires", "21600"); // 6 h: chega para ficheiros enormes em redes lentas
  const signed = await r2().sign(new Request(u, { method: "PUT" }), { aws: { signQuery: true } });
  return signed.url;
}

export async function completeMultipart(key: string, uploadId: string, parts: { n: number; etag: string }[]) {
  if (!parts.length) throw new HttpError(400, "no_parts");
  const body = `<CompleteMultipartUpload>${[...parts]
    .sort((a, b) => a.n - b.n)
    .map((p) => `<Part><PartNumber>${p.n}</PartNumber><ETag>${xmlEsc(p.etag)}</ETag></Part>`)
    .join("")}</CompleteMultipartUpload>`;
  await call(`${objUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`, { method: "POST", body, headers: { "Content-Type": "application/xml" } });
  return publicUrl(key);
}

export async function abortMultipart(key: string, uploadId: string) {
  await call(`${objUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`, { method: "DELETE" }).catch(() => null);
}
