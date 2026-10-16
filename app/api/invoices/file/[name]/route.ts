import { readFile } from "node:fs/promises";
import path from "node:path";
import { fail, requirePerm } from "@/lib/server/admin";

/** PDF original de uma invoice (importada do Notion), só para quem vê as Finanças. ?dl=1 descarrega. */
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) await requirePerm("finance.view"); // modo local: sem login
    const { name } = await params;
    if (!/^[a-z0-9][a-z0-9-]*\.pdf$/.test(name)) return Response.json({ error: "not_found" }, { status: 404 });
    const buf = await readFile(path.join(process.cwd(), "data/invoices-2026", name)).catch(() => null);
    if (!buf) return Response.json({ error: "not_found" }, { status: 404 });
    const dl = new URL(req.url).searchParams.has("dl");
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dl ? "attachment" : "inline"}; filename="${name}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
