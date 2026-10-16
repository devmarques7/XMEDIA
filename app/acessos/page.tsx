"use client";

// Acessos & segurança de dados: o cofre interno da equipa (ex.: conta de Facebook partilhada) e a visão geral dos
// acessos de todos os clientes — onde as senhas ficam, quem as regista e quem as pode ver.
import { useEffect, useState } from "react";
import { AppShell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { Toast, useToast } from "@/components/ui";
import { VaultView } from "@/components/vault/VaultView";
import { customerStore } from "@/lib/customerStore";
import type { Customer } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";

export default function AccessPage() {
  const { t } = useT();
  const [toast, setToast] = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [scope, setScope] = useState<string>("internal");
  useEffect(() => void customerStore.list().then(setCustomers).catch(() => {}), []);

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("vt.sub")}</span>
          <h1 className="h1">{t("vt.title")}</h1>
        </div>
      </section>

      {/* como funciona: quem regista, quem vê, onde fica */}
      <section className="vt-rules">
        {(["store", "who", "client", "log"] as const).map((k) => (
          <div key={k} className="vt-rule">
            <Icon name={k === "store" ? "shield" : k === "who" ? "user" : k === "client" ? "key" : "history"} size={18} />
            <b>{t(`vt.rule.${k}` as Key)}</b>
            <span className="muted small">{t(`vt.rule.${k}.d` as Key)}</span>
          </div>
        ))}
      </section>

      <nav className="td-who" style={{ margin: "14px 0" }}>
        <button className={`cb-chip ${scope === "internal" ? "on" : ""}`} onClick={() => setScope("internal")}>
          <Icon name="lock" size={12} /> {t("vt.internalVault")}
        </button>
        <button className={`cb-chip ${scope === "all" ? "on" : ""}`} onClick={() => setScope("all")}>
          {t("vt.everything")}
        </button>
        {customers.map((c) => (
          <button key={c.id} className={`cb-chip ${scope === c.id ? "on" : ""}`} onClick={() => setScope(c.id)}>
            {c.name}
          </button>
        ))}
      </nav>
      <VaultView key={scope} side="studio" scope={scope} customers={customers} onToast={setToast} />
      <Toast msg={toast} />
    </AppShell>
  );
}
