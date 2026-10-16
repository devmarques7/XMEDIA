export const dynamic = "force-dynamic";

/** Versão em produção agora (a página aberta compara com a sua e mostra "Nova versão disponível"). */
export function GET() {
  return Response.json({ build: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || "" }, { headers: { "Cache-Control": "no-store" } });
}
