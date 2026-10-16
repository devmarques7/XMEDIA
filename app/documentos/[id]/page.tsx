"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/Shell";
import { DocEditor } from "@/components/docs/DocEditor";
import { customerStore } from "@/lib/customerStore";
import { docApi } from "@/lib/docApi";
import type { Customer } from "@/lib/customer";
import type { Doc } from "@/lib/documents";
import { team } from "@/lib/team";
import { useT } from "@/lib/i18n";

export default function Page() {
  return (
    <Suspense>
      <EditDoc />
    </Suspense>
  );
}

function EditDoc() {
  const { t } = useT();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const c = useSearchParams().get("c") ?? "";
  const [doc, setDoc] = useState<Doc | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [me, setMe] = useState({ name: "MediaMarques", email: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [rows, cust, who, s] = await Promise.all([docApi.list(c), c ? customerStore.get(c) : null, team.me().catch(() => null), customerStore.settings()]);
        const d = rows.find((x) => x.doc.id === id)?.doc;
        if (!d) return setErr(t("dd.notFound"));
        setDoc({ ...d, customer_id: c });
        setCustomer(cust);
        setMe({ name: "MediaMarques", email: who?.email || s.contact_email });
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [id, c, t]);

  return (
    <AppShell>
      {err && <p className="w muted">{err}</p>}
      {doc && <DocEditor doc={doc} customer={customer} me={me} onSaved={setDoc} onBack={() => router.push(c ? `/clientes/${c}?tab=documents` : "/documentos")} />}
    </AppShell>
  );
}
