"use client";

// Lixo geral: tudo o que foi apagado (de todos os clientes) nos últimos 15 dias — restaurar, apagar de vez, esvaziar.
// Cada cliente tem também o seu lixo (separador "Lixo" na ficha do cliente).
import { useEffect, useState } from "react";
import { AppShell } from "@/components/Shell";
import { BinView } from "@/components/customer/Trash";
import { customerStore } from "@/lib/customerStore";
import type { Customer } from "@/lib/customer";
import { useT } from "@/lib/i18n";

export default function BinPage() {
  const { t } = useT();
  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    customerStore.list().then(setCustomers).catch(() => setCustomers([]));
  }, []);
  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("bin.sub")}</span>
          <h1 className="h1">{t("nav.bin")}</h1>
        </div>
      </section>
      <div className="widgets" style={{ paddingTop: 0 }}>
        <section className="w span-12">
          <BinView customers={customers} />
        </section>
      </div>
    </AppShell>
  );
}
