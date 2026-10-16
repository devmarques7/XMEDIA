"use client";

import { AppShell } from "@/components/Shell";
import { Toast, useToast } from "@/components/ui";
import { DocumentsHub } from "@/components/docs/DocumentsHub";
import { useT } from "@/lib/i18n";

/** Documentos: internos e de clientes, assinatura eletrónica e modelos. */
export default function DocumentsPage() {
  const { t } = useT();
  const [toast, setToast] = useToast();
  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("dd.sub")}</span>
          <h1 className="h1">{t("dd.title")}</h1>
        </div>
      </section>
      <DocumentsHub onToast={setToast} />
      <Toast msg={toast} />
    </AppShell>
  );
}
