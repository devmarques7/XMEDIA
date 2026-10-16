import { activeSigners, audit, publicRecipient, AUTO_FIELDS, autoValue, missingFields, statusOf, type Doc } from "@/lib/documents";
import { docEmail } from "@/lib/docEmail";
import { sendEmail } from "@/lib/inviteEmail";
import { randomToken } from "@/lib/codes";
import { HttpError, fail } from "@/lib/server/admin";
import { byToken, clientIp, docTokenHash, finalizePdf, getFile, otpHash, putFile, saveDocs, signedUrl } from "@/lib/server/docs";

type Ctx = { params: Promise<{ token: string }> };

/** O que o destinatário vê: o documento (link temporário), os campos dele e os já preenchidos pelos outros. */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { owner, doc, r } = await byToken((await params).token);
    if (doc.status === "voided") throw new HttpError(410, "voided");
    let next = doc;
    if (!r.viewed_at) {
      next = audit({ ...doc, recipients: doc.recipients.map((x) => (x.id === r.id ? { ...x, viewed_at: new Date().toISOString(), status: x.status === "sent" ? "viewed" : x.status } : x)) }, { action: "viewed", by: r.email, ip: clientIp(req), ua: req.headers.get("user-agent") ?? "" });
      await saveDocs(owner, doc.customer_id, [next]);
    }
    const canSign = activeSigners(next).some((x) => x.id === r.id);
    return Response.json({
      doc: { id: next.id, title: next.title, status: next.status, message: next.message, fields: next.fields.map((f) => ({ ...f, value: f.recipient_id === r.id || !f.recipient_id ? f.value : AUTO_FIELDS.includes(f.type) ? "" : f.value })), recipients: next.recipients.map(publicRecipient) },
      me: { id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, verified: !!r.verified_at, lang: r.lang },
      canSign,
      file: await signedUrl(next.file.path),
      signed: next.signed ? await signedUrl(next.signed.path, next.signed.name) : null,
    });
  } catch (e) {
    return fail(e);
  }
}

/** { action: "otp" } envia o código · { action: "sign", code, values, consent } assina · { action: "decline", reason }. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const token = (await params).token;
    const { owner, doc, r } = await byToken(token);
    const b = (await req.json()) as { action: "otp" | "sign" | "decline"; code?: string; values?: Record<string, string>; consent?: boolean; reason?: string };
    const ip = clientIp(req);
    const ua = req.headers.get("user-agent") ?? "";
    const origin = new URL(req.url).origin;
    if (doc.status === "voided" || doc.status === "completed") throw new HttpError(409, doc.status);

    if (b.action === "otp") {
      const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      const otp = { otp_hash: await otpHash(doc.id, r.id, code), otp_exp: new Date(Date.now() + 10 * 60_000).toISOString(), otp_tries: 0 };
      const res = await sendEmail(r.email, docEmail("otp", { lang: r.lang, origin, name: r.name, title: doc.title, from: "XMEDIA", code }));
      await saveDocs(owner, doc.customer_id, [audit({ ...doc, recipients: doc.recipients.map((x) => (x.id === r.id ? { ...x, ...otp } : x)) }, { action: "otp_sent", by: r.email, ip, ua })]);
      return Response.json({ sent: res.sent });
    }

    if (b.action === "decline") {
      const next = audit({ ...doc, recipients: doc.recipients.map((x) => (x.id === r.id ? { ...x, status: "declined" as const, declined_reason: String(b.reason ?? "").slice(0, 500) } : x)) }, { action: "declined", by: r.email, ip, ua, detail: String(b.reason ?? "").slice(0, 120) });
      await saveDocs(owner, doc.customer_id, [{ ...next, status: statusOf(next) }]);
      return Response.json({ ok: true });
    }

    // assinar
    if (!activeSigners(doc).some((x) => x.id === r.id)) throw new HttpError(409, "not_your_turn");
    if (!b.consent) throw new HttpError(400, "consent_required");
    if (!r.otp_hash || !r.otp_exp || new Date(r.otp_exp).getTime() < Date.now()) throw new HttpError(400, "code_expired");
    if ((r.otp_tries ?? 0) >= 5) throw new HttpError(429, "too_many");
    if ((await otpHash(doc.id, r.id, String(b.code ?? ""))) !== r.otp_hash) {
      await saveDocs(owner, doc.customer_id, [{ ...doc, recipients: doc.recipients.map((x) => (x.id === r.id ? { ...x, otp_tries: (x.otp_tries ?? 0) + 1 } : x)), updated_at: new Date().toISOString() }]);
      throw new HttpError(400, "bad_code");
    }
    const values = b.values ?? {};
    const missing = missingFields(doc, r.id, values);
    if (missing.length) throw new HttpError(400, `missing:${missing[0].id}`);
    const at = new Date();
    let next: Doc = {
      ...doc,
      fields: doc.fields.map((f) => (f.recipient_id !== r.id ? f : { ...f, value: AUTO_FIELDS.includes(f.type) ? autoValue(f, r, at) : String(values[f.id] ?? f.value ?? "").slice(0, 400_000) })),
      recipients: doc.recipients.map((x) => (x.id === r.id ? { ...x, verified_at: at.toISOString(), signed_at: at.toISOString(), status: "signed" as const, otp_hash: undefined, otp_exp: undefined, otp_tries: undefined } : x)),
    };
    next = audit(next, { action: "verified", by: r.email, ip, ua, detail: "email code" });
    next = audit(next, { action: "signed", by: r.email, ip, ua });
    next = { ...next, status: statusOf(next) };

    if (next.status === "completed") {
      const { bytes, sha } = await finalizePdf(next, await getFile(next.file.path));
      const path = next.file.path.replace(/\.[a-z0-9]+$/, "") + `-signed.pdf`;
      await putFile(path, bytes, "application/pdf");
      next = audit({ ...next, signed: { path, name: next.title.replace(/[^\w\- ]+/g, "").trim() + " (signed).pdf", mime: "application/pdf", size: bytes.length, sha256: sha } }, { action: "completed", by: "system", detail: `sha256 ${sha.slice(0, 16)}…` });
      await saveDocs(owner, next.customer_id, [next]);
      const link = await signedUrl(path, next.signed!.name);
      for (const x of next.recipients) await sendEmail(x.email, docEmail("completed", { lang: x.lang, origin, name: x.name, title: next.title, from: "XMEDIA", link }));
    } else {
      // ordem de assinatura: avisa o próximo
      for (const x of activeSigners(next).filter((y) => !y.sent_at || y.status === "pending")) {
        const t = randomToken();
        next = { ...next, recipients: await Promise.all(next.recipients.map(async (y) => (y.id === x.id ? { ...y, token_hash: await docTokenHash(t), status: "sent" as const, sent_at: new Date().toISOString() } : y))) };
        await sendEmail(x.email, docEmail("request", { lang: x.lang, origin, name: x.name, title: next.title, from: "XMEDIA", link: `${origin}/assinar/${t}`, message: next.message }));
        next = audit(next, { action: "sent", by: "system", detail: x.email });
      }
      await saveDocs(owner, next.customer_id, [next]);
    }
    void token;
    return Response.json({ ok: true, status: next.status });
  } catch (e) {
    return fail(e);
  }
}
