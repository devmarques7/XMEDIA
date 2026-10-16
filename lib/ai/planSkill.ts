// Skill "planear a semana": definições das ferramentas e o método (sem código do browser — usado também pela rota do chat).
import type Anthropic from "@anthropic-ai/sdk";
export const PLAN_READ_TOOLS = new Set(["get_week_plan"]);
export const PLAN_WRITE_TOOLS = new Set(["plan_week"]);

export const PLAN_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_week_plan",
    description:
      "Dados para planear a semana do utilizador: capacidade de cada dia (minutos planeáveis = horas de trabalho − margem), o que já está planeado por dia, calibração pelas horas registadas, e a lista de pendentes de todos os clientes (ou de um) com ação, estimativa em minutos, prazo e prioridade. Ler sempre antes de propor um plano.",
    input_schema: {
      type: "object",
      properties: {
        start: { type: "string", description: "Segunda-feira da semana (AAAA-MM-DD). Sem ela: esta semana." },
        client: { type: "string", description: "Nome ou id de um cliente para filtrar os pendentes (opcional)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "plan_week",
    description:
      "Cria tarefas no Hoje do utilizador, cada uma num dia, com estimativa. O utilizador confirma na interface antes de gravar. Usar só depois de mostrar o plano e respeitar a capacidade de cada dia.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Ação + conteúdo, ex.: \"Editar: Reel Uzurri lançamento\"" },
              due: { type: "string", description: "Dia (AAAA-MM-DD)" },
              estimate_min: { type: "number", description: "Minutos estimados (o valor de get_week_plan)" },
              post_id: { type: "string", description: "Conteúdo ligado (de get_week_plan), opcional" },
              customer_id: { type: "string", description: "Cliente (de get_week_plan); vazio = tarefa interna" },
            },
            required: ["title", "due"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
];

/** Método que o assistente segue quando lhe pedem para criar ou organizar a semana. */
export const PLAN_SKILL = `
Planear a semana (skill):
- Quando pedirem para planear, organizar ou encher a semana/o dia: chame get_week_plan primeiro. Nunca invente tarefas, clientes ou tempos.
- Capacidade: cada dia tem "capacity" (minutos planeáveis, já sem a margem para imprevistos) e "planned". Nunca proponha mais do que "free" num dia; fins de semana e dias com capacity 0 ficam vazios. Se um dia já está "over", proponha mover o menos urgente em vez de acrescentar.
- Estimativas: use "min" de cada pendente (já calibrado pelo ritmo real — "factor"). Se "calibrated" for falso, diga que as estimativas são de base e sugira registar horas.
- Ordem de prioridade: atrasados (late) > parados (stalled) > alterações pedidas (changes) > comentários por resolver > prazo próximo (due) > em aberto. Prazos "finish/deliver" e datas de publicação mandam: tudo tem de ficar pronto antes do prazo.
- Agrupe por cliente no mesmo dia quando possível (menos troca de contexto); edições longas (≥ 2h) de manhã, seguimentos curtos ao fim do dia.
- Deixe sempre pelo menos 30 min livres por dia além da margem. O que não couber na semana: liste à parte como "não cabe" com o motivo.
- Mostre o plano como uma lista por dia: dia · itens (ação: conteúdo · cliente · tempo) · total / capacidade. Depois peça confirmação e só então chame plan_week com os mesmos itens (due, estimate_min, post_id, customer_id).
- Termine com as ações seguintes, ex.: [[ações: Confirmar o plano | Mover o que não cabe para a próxima semana | Só o dia de hoje]]`;

