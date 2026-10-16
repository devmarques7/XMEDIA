"use client";

// Tarefas · Hoje: a página que se abre para saber o que é urgente hoje. Tarefas de todos os clientes e as
// internas da empresa, por prioridade; vídeos que pedem ação são sugeridos. Check → feito, atualiza na hora.
// (O Estúdio é a visão geral; esta é a lista de ação — mesma camada de dados: useStudio + lib/today.)
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { Toast } from "@/components/ui";
import { FocusToggle, TodayList, useTodayFilter } from "@/components/team/TodayList";
import { useStudio } from "@/components/team/useStudio";
import { useT } from "@/lib/i18n";

export default function TasksTodayPage() {
  const { t, locale } = useT();
  const S = useStudio();
  // por omissão: as minhas tarefas + as sem responsável; o avatar no topo alterna para as de todos
  const [filter, setFilter] = useTodayFilter();
  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted" style={{ textTransform: "capitalize" }}>
            {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <h1 className="h1">{t("td.title")}</h1>
        </div>
        <span className="row" style={{ gap: 10 }}>
          <Link href="/estudio" className="btn ghost small">
            <Icon name="gauge" size={14} /> {t("st.title")}
          </Link>
          {S.customers && <FocusToggle S={S} filter={filter} onFilter={setFilter} />}
        </span>
      </section>
      <div className="td-page">{S.customers ? <TodayList S={S} filter={filter} onFilter={setFilter} /> : <p className="muted">…</p>}</div>
      <Toast msg={S.err} />
    </AppShell>
  );
}
