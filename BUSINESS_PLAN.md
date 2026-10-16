# Plano de negócios: Pré-produção (revisão e validação)

## 1. O problema
Numa produtora de conteúdo recorrente, a pré-produção fica espalhada por Notion, WhatsApp, Pinterest e notas soltas. No dia da gravação isso custa:
- **Cenas esquecidas.** Descobre-se na edição que faltou um plano, e isso obriga a regravar ou a remendar.
- **Tempo perdido no set** a procurar referências ("qual era o vídeo que o cliente mandou?").
- **Reels que perdem o prazo.** Um conceito sem data de expiração fica na gaveta.
- **Nenhum histórico.** Não se sabe o que foi aprovado nem quando.

## 2. A solução (MVP, o que já está construído)
| Pré-produção (desktop) | Produção (telemóvel) |
|---|---|
| Projeto = conceito geral + definições (formato, look, equipamento, equipa) | Lista de sessões. Ao tocar numa sessão, ela abre em divisões com horário |
| N reels por projeto, cada um com conceito, estado e **data de expiração** | Checklist de cenas com imagem de referência, vídeo e links |
| Locais com mapa e notas de acesso | Contador grande de "cenas por fazer" e barra de progresso |
| Sessões → divisões → cenas, cada cena ligada a um reel | "Esconder feitas", zoom na referência |
| **Versões** (snapshots imutáveis, restauráveis) | Grava sozinho a cada toque |
| Importar e exportar em **JSON** (tudo) e **CSV** (uma linha por cena) | |

Login com Google (Supabase Auth), dados no Supabase com RLS (cada conta só vê o que é seu) e deploy na Vercel.

## 3. Quem usa: validar primeiro por dentro
**Fase 1, uso interno (MediaMarques).** O utilizador sou eu e a equipa de captação. O custo de falhar é baixo e o ganho é imediato.

**Fase 2, clientes/parceiros como convidados, só leitura.** Partilhar o link da pré-produção para aprovação. Isto substitui PDFs e mensagens de WhatsApp e reforça o posicionamento premium ("processo organizado").

**Fase 3, possível produto (SaaS)** para filmmakers freelancers e pequenas produtoras. Só avança se a Fase 1 passar os critérios abaixo.

## 4. Hipóteses e como validá-las
| # | Hipótese | Teste | Passa se… |
|---|---|---|---|
| H1 | Reduz cenas esquecidas | Comparar 3 gravações antes e 3 depois (planos em falta detetados na edição) | ≥ 50% menos planos em falta |
| H2 | É mais rápido do que o fluxo atual | Cronometrar a pré-produção de um ciclo mensal | ≤ tempo atual já no 2.º ciclo |
| H3 | A equipa usa-o no set sem ser obrigada | % de cenas marcadas no próprio dia | ≥ 80% das cenas marcadas |
| H4 | A data de expiração evita reels perdidos | Reels que passam o prazo sem publicar, por mês | Tende para 0 |
| H5 | O cliente valoriza ver a pré-produção | Perguntar a 3 clientes depois de partilhar | ≥ 2 de 3 dizem que ajuda na aprovação |
| H6 (SaaS) | Outros pagariam por isto | 10 conversas com filmmakers e uma landing page com lista de espera | ≥ 30 inscritos ou ≥ 3 pré-pagamentos |

**Janela de validação:** 2 ciclos mensais (~8 semanas). Se H1–H3 falharem, a ferramenta volta a ser um template no Notion. Não vale manter código.

## 5. Custos
| Item | Fase 1 | Notas |
|---|---|---|
| Supabase | €0 (Free) | ⚠️ No plano Free, um projeto sem atividade durante 7 dias é **pausado**. Ou se usa semanalmente, ou se passa ao Pro (~$25/mês) quando for crítico |
| Vercel | €0 (Hobby) | ⚠️ O Hobby é para **uso não comercial**. Para uso na empresa, o correto é o Pro (~$20/mês por membro) |
| Domínio | ~€12/ano | opcional (ex.: `preprod.mediamarques.com`) |
| Desenvolvimento | tempo interno | MVP já feito, ~1 dia de ajustes por mês |

**Custo realista em uso comercial:** ~€45/mês. Compensa se poupar ~1 h/mês de trabalho faturável ou evitar uma regravação por trimestre.

## 6. Monetização (só na Fase 3)
- **Freemium:** 1 projeto ativo grátis. Pro a €9–12/mês com projetos ilimitados, partilha com cliente e marca própria no link.
- **Studio:** €29/mês com equipa (vários membros) e templates de pré-produção.
- Canal natural: o conteúdo da própria MediaMarques ("como organizamos uma gravação") como topo de funil.

## 7. Riscos
| Risco | Mitigação |
|---|---|
| Ninguém abre a app no set | Modo produção pensado para telemóvel, com um toque por cena. Validar em H3 |
| Referências são links do Pinterest/Drive que não mostram imagem | v1.1: upload de imagens para o Supabase Storage |
| Sem rede no local | v1.1: cache offline (PWA) e sincronização ao voltar |
| Duas pessoas a editar ao mesmo tempo | MVP: último a gravar ganha, e as versões protegem. v2: Realtime |
| Lock-in | Export JSON/CSV completo desde o dia 1 |

## 8. Roadmap
- **v1.0 (feito):** tudo o que está na secção 2.
- **v1.1:** upload de imagem de referência, PWA/offline, link de partilha só leitura para o cliente.
- **v1.2:** templates (duplicar um projeto como base), campo de duração estimada por cena.
- **v2 (se H6 passar):** equipas/membros, Realtime, landing page e pagamentos (Stripe).

## 9. Decisão
Avançar com a **Fase 1** já. Definir a data da revisão (fim do 2.º ciclo) e registar as métricas H1–H5 numa tabela simples. A decisão sobre SaaS fica para essa revisão, com dados.
