// Catálogo inicial — extraído do Notion "MM - Program Worksheet" (Services & Princing), 35 linhas, valores de 2026-08-31.
// Preço = "Service Cost", CRP = "CRP (Custo Real)", horas = "Horas Reais". Textos condensados das colunas Notes/Entregável.
import { MARKET, normalizeService, type Service } from "./services";

const NOTION = "https://app.notion.com/p/2f51c41fbb3380c9b7cae3b438c0eb39";

const CAP_SIMPLE = ["1 câmera", "Luz simples ou ambiente otimizada", "Plano fixo ou movimentos básicos", "Áudio simples (microfone direto)", "Direção básica de pose e enquadramento"];
const CAP_PRO = ["Planeamento técnico prévio", "Setup avançado de iluminação", "Gimbal, tracking e movimentos dinâmicos", "Múltiplos enquadramentos e takes", "Áudio dedicado (quando aplicável)", "Direção ativa de cena e performance"];
const USE_SIMPLE = ["Reels simples", "Bastidores", "Depoimentos curtos", "Conteúdo recorrente"];
const USE_PRO = ["Reels cinematográficos", "Campanhas e anúncios", "Vídeos de marca/autoridade", "Fashion films"];
const EDIT_BASIC = ["Corte seco", "Trilha sonora básica", "Legendas padrão", "1 vídeo 30–60s por hora"];
const EDIT_PRO = ["Montagem narrativa", "Color grading avançado", "Sound design", "Legendas dinâmicas e VFX leves"];

type Seed = Partial<Service> & Pick<Service, "id" | "name" | "folder" | "price" | "crp" | "hours">;

const RAW: Seed[] = [
  // ---------- Captação
  { id: "cap-day-pro", name: "Diária Produção | PRO | Capturing", folder: "capture", plan: "day", tier: "pro", unit: "day", price: 960, crp: 480, hours: 6, min_margin: 25, potential: "high",
    deliverable: "1 diária de captação PRO (~6h efetivas): material bruto para múltiplos Reels/cenas complexas, setup avançado de luz e movimento. Não inclui edição.",
    includes: CAP_PRO, use_for: [...USE_PRO, "Cases profissionais"], not_for: "Se só precisa de 1–2 Reels, use horas PRO On-Demand.", invoice_label: "® [MM] Capturing Day — PRO (6h)", market: MARKET.capture_day, tags: ["diária", "filmagem", "dia completo"] },
  { id: "cap-day-simple", name: "Diária Produção | Simples | Capturing", folder: "capture", plan: "day", tier: "simple", unit: "day", price: 642, crp: 480, hours: 6, min_margin: 25, potential: "high",
    deliverable: "Material bruto captado (1 câmera, luz simples), 1 diária completa (~6h efetivas).",
    includes: CAP_SIMPLE, use_for: USE_SIMPLE, not_for: "Para estética cinematográfica use a Diária PRO.", invoice_label: "® [MM] Capturing Day — Basic (6h)", market: MARKET.capture_day, tags: ["diária", "filmagem"],
    notes: "Tarifa/margem Basic ainda por rever (diferenciação Basic vs. PRO)." },
  { id: "cap-basic-frequency", name: "Production | Basic | Frequency", folder: "capture", plan: "frequency", tier: "simple", unit: "hour", price: 107, crp: 80, hours: 1, min_margin: 25, potential: "review",
    deliverable: "Material bruto captado (1 câmera, básico) para 1 vídeo curto.", includes: CAP_SIMPLE, use_for: USE_SIMPLE,
    not_for: "Congelado ao preço On-Demand até a base ter folga de margem (adenda 3.1).", invoice_label: "® [MM] Capturing — Basic (hour)", market: MARKET.capture_hour, tags: ["hora", "recorrente"] },
  { id: "cap-basic-simple-frequency", name: "Production | Basic | Simples | Frequency", folder: "capture", plan: "frequency", tier: "simple", unit: "hour", price: 80, crp: 80, hours: 1, min_margin: 25, potential: "review",
    deliverable: "Material bruto captado (1 câmera, básico) para 1 vídeo curto (30–60s). Não inclui edição.", includes: CAP_SIMPLE, use_for: USE_SIMPLE,
    not_for: "Preço = CRP (margem 0%): bloqueado pela regra 6.1 — não usar em propostas até ser corrigido.", invoice_label: "® [MM] Capturing — Basic (hour)", market: MARKET.capture_hour, tags: ["hora"] },
  { id: "cap-pro-on-demand", name: "Production | PRO | ON-Demand", folder: "capture", plan: "on_demand", tier: "pro", unit: "hour", price: 114, crp: 80, hours: 1, min_margin: 25, potential: "medium",
    deliverable: "Captação PRO por hora — estética cinematográfica, maior impacto visual e perceção premium de marca.", includes: CAP_PRO, use_for: USE_PRO,
    not_for: "Mais de 6h no mesmo dia: compare com a Diária PRO.", invoice_label: "® [MM] Capturing — PRO (hour)", market: MARKET.capture_hour, tags: ["hora", "avulso"] },

  // ---------- Edição
  { id: "edit-day-pro", name: "Diária Edição | PRO", folder: "edit", plan: "day", tier: "pro", unit: "day", price: 400, crp: 260, hours: 4, potential: "review",
    deliverable: "Bloco de edição PRO (~4h efetivas): 3–4 vídeos com color grading, sound design e legendas dinâmicas.", includes: EDIT_PRO, use_for: ["Lotes de 3–4 Reels PRO"],
    not_for: "Margem 35% (abaixo do piso de 50%) — rever preço antes de propor.", invoice_label: "® [MM] Post-Production Day — PRO (4h)", market: MARKET.edit_hour, tags: ["diária", "pós-produção"] },
  { id: "edit-day-simple", name: "Diária Edição | Simples", folder: "edit", plan: "day", tier: "simple", unit: "hour", price: 122, crp: 35, hours: 1, potential: "high",
    deliverable: "1 vídeo curto editado (corte seco, trilha básica, legendas padrão). Nome sugere diária mas o valor é o de 1h.", includes: EDIT_BASIC, use_for: USE_SIMPLE,
    not_for: "Rever nomenclatura (é 1h, não diária).", invoice_label: "® [MM] Post-Production — Basic (hour)", market: MARKET.edit_hour, tags: ["edição"] },
  { id: "edit-pro-frequency", name: "Edição | PRO | Frequency (-30%)", folder: "edit", plan: "frequency", tier: "pro", unit: "day", price: 280, crp: 260, hours: 4, potential: "review",
    deliverable: "Bloco de edição PRO (~4h efetivas) com desconto de recorrência de 30% sobre a diária.", includes: EDIT_PRO, use_for: ["Clientes com volume e constância"],
    not_for: "Margem 7%: abaixo do piso — usar a Diária PRO + desconto C (o motor limita ao piso).", invoice_label: "® [MM] Post-Production Day — PRO (recurring)", market: MARKET.edit_hour, tags: ["recorrente"] },
  { id: "edit-simple-frequency", name: "Edição | Simples | Frequency", folder: "edit", plan: "frequency", tier: "simple", unit: "hour", price: 85, crp: 35, hours: 1, potential: "high",
    deliverable: "1 vídeo curto editado, com desconto de recorrência de 30%.", includes: EDIT_BASIC, use_for: ["Clientes com constância e volume"],
    invoice_label: "® [MM] Post-Production — Basic (recurring)", market: MARKET.edit_hour, tags: ["recorrente"] },
  { id: "edit-subtitles", name: "Production | Editing - Subtitle [Extra]", folder: "edit", plan: "extra", unit: "item", price: 60, crp: 15, hours: 0.25, potential: "high",
    deliverable: "Legendas adicionadas a 1 vídeo já editado.", includes: ["Legendas simples sobre vídeo editado"], use_for: ["Vídeos já editados sem legendas"],
    invoice_label: "® [MM] Subtitles [Extra]", market: MARKET.subtitles, tags: ["legendas", "extra"] },
  { id: "edit-basic", name: "Production | Editing Basic", folder: "edit", plan: "frequency", tier: "simple", unit: "hour", price: 122, crp: 35, hours: 1, potential: "high",
    deliverable: "1 vídeo curto finalizado (30–60s), corte seco, trilha básica, legendas padrão.", includes: EDIT_BASIC, use_for: [...USE_SIMPLE, "Get ready with me", "Avisos rápidos"],
    not_for: "Etiquetado como Frequency mas com valor igual ao On-Demand — rever plano.", invoice_label: "® [MM] Post-Production / Reel Basic: - Complete Edit", market: MARKET.reel_edit, tags: ["reel", "edição"] },
  { id: "edit-pro", name: "Production | Editing PRO", folder: "edit", plan: "on_demand", tier: "pro", unit: "item", price: 185, crp: 65, hours: 1, potential: "high",
    deliverable: "1 vídeo finalizado com montagem narrativa, color grading e sound design (grading de 1 vídeo já incluído).", includes: EDIT_PRO, use_for: USE_PRO,
    not_for: "1 Reel = €185 direto, nunca somar grading. 2+ Reels com 1 passagem de grading partilhada: regra 10.4.", invoice_label: "® [MM] Post-Production / Reel PRO: - Complete Edit", market: MARKET.reel_edit, tags: ["reel", "edição", "color"] },

  // ---------- Reels & pacotes vídeo
  { id: "pkg-color-grading", name: "Production PRO | Reel adicional [EXTRA] | Pós-produção / Color Grading", folder: "video_pkg", plan: "extra", tier: "pro", unit: "item", price: 200, crp: 50, hours: 1, potential: "high",
    deliverable: "1 vídeo com correção de cor e look cinematográfico (sem gravação/edição base incluída).", includes: ["Correção de cor", "Look cinematográfico", "Consistência visual"], use_for: ["Material já cortado pelo cliente"],
    not_for: "Nunca como linha à parte quando já há edição completa no pacote (regra 10).", invoice_label: "® [MM] Color Grading [Extra]", tags: ["color", "grading", "extra"] },
  { id: "pkg-basic", name: "Production | Basic | PKG", folder: "video_pkg", plan: "on_demand", tier: "simple", unit: "item", price: 366, crp: 105, hours: 3, potential: "high",
    deliverable: "1 Reel finalizado (30–60s), corte limpo, 1 rodada de ajustes — inclui 1h de captação + 2h de edição Basic.", includes: ["1h de captação", "2h de edição Basic", "1 rodada de ajustes"], use_for: ["Produto de entrada — volume", ...USE_SIMPLE],
    invoice_label: "® [MM] Reel Basic — Capture + Edit", market: MARKET.reel, tags: ["reel", "pacote", "entrada"] },
  { id: "pkg-pro", name: "Production | PRO | PKG", folder: "video_pkg", plan: "frequency", tier: "pro", unit: "item", price: 500, crp: 175, hours: 3, potential: "high",
    deliverable: "1 Reel PRO finalizado (captação + edição PRO).", includes: ["1h de captação PRO", "2h de edição PRO", "1 rodada de ajustes"], use_for: USE_PRO,
    invoice_label: "® [MM] Reel PRO — Capture + Edit", market: MARKET.reel, tags: ["reel", "pacote", "premium"] },
  { id: "pkg-extra-basic", name: "Production | Reel adicional [EXTRA] | BASIC", folder: "video_pkg", plan: "extra", tier: "simple", unit: "item", price: 125, crp: 35, hours: 1, potential: "high",
    deliverable: "1 Reel Basic extra no mesmo ciclo (edição adicional sobre material já captado).", includes: EDIT_BASIC, use_for: ["Mais um Reel do mesmo dia de captação"],
    invoice_label: "® [MM] Additional Reel — Basic", market: MARKET.reel_edit, tags: ["reel", "extra"] },
  { id: "pkg-extra-pro", name: "Production | Reel adicional [EXTRA] | PRO", folder: "video_pkg", plan: "extra", tier: "pro", unit: "item", price: 150, crp: 65, hours: 1, potential: "medium",
    deliverable: "1 Reel PRO extra, adicionado ao mesmo ciclo de produção.", includes: EDIT_PRO, use_for: ["Mais um Reel PRO do mesmo dia de captação"],
    invoice_label: "® [MM] Additional Reel — PRO", market: MARKET.reel_edit, tags: ["reel", "extra"] },

  // ---------- Pacotes de foto
  { id: "photo-sub-on-demand", name: "Assinatura mensal (recorrência) | Photos On-Demand", folder: "photo_pkg", plan: "on_demand", unit: "month", price: 350, crp: 50, hours: 2, potential: "high",
    deliverable: "1 sessão de fotos/mês (2h), 15–25 fotos editadas entregues.", includes: ["1 sessão por mês (2h)", "15–25 fotos editadas"], use_for: ["Marcas com presença social contínua"],
    invoice_label: "® [MM] Monthly Photo Session (2h)", tags: ["assinatura", "mensal"] },
  { id: "photo-sub-frequency", name: "Assinatura mensal (recorrência) | Photos - Frequency", folder: "photo_pkg", plan: "frequency", unit: "month", price: 350, crp: 50, hours: 2, potential: "review",
    deliverable: "1 sessão/mês, 15–25 fotos. Frequency sem desconto — rever rótulo (já é o produto de maior margem).", includes: ["1 sessão por mês (2h)", "15–25 fotos editadas"], use_for: ["Contratos ≥3 meses"],
    invoice_label: "® [MM] Monthly Photo Session (2h) — recurring", tags: ["assinatura", "recorrente"] },
  { id: "photo-brand-library", name: "Banco de imagens da marca", folder: "photo_pkg", plan: "package", unit: "item", price: 250, crp: 112, hours: 4, potential: "medium",
    deliverable: "Sessão dedicada (~4h) para acervo de imagens de marca (uso interno/social contínuo).", includes: ["Sessão de ~4h", "Acervo de imagens da marca"], use_for: ["Empresas — muito comum"],
    not_for: "Margem 55% e €62,5/h: abaixo do benchmark de fotografia — rever.", invoice_label: "® [MM] Brand Image Library Session", tags: ["acervo", "banco de imagens"] },

  // ---------- Fotografia
  { id: "photo-event-frequency", name: "Corporative Events Shooting | Frequency", folder: "photo", plan: "frequency", unit: "hour", price: 130, crp: 30, hours: 1, potential: "review",
    deliverable: "Cobertura de evento corporativo, ~25 fotos editadas por hora (75 em 3h).", includes: ["Cobertura profissional do evento", "~25 fotos editadas/h"], use_for: ["Eventos empresariais", "Websites e LinkedIn"],
    not_for: "Frequency sem desconto face ao On-Demand — rever.", invoice_label: "® [MM] Corporate Event Photography (hour)", market: MARKET.photo_event, tags: ["evento", "corporate"],
    notes: "Uso comercial ampliado (campanhas, ads, internacional): +20% a +40%." },
  { id: "photo-event-on-demand", name: "Corporative Events Shooting | On Demand", folder: "photo", plan: "on_demand", unit: "hour", price: 130, crp: 30, hours: 1, potential: "high",
    deliverable: "Cobertura de evento corporativo, ~25 fotos editadas por hora (75 em 3h).", includes: ["Cobertura profissional do evento", "~25 fotos editadas/h"], use_for: ["Eventos empresariais", "Websites e LinkedIn"],
    invoice_label: "® [MM] Corporate Event Photography (hour)", market: MARKET.photo_event, tags: ["evento", "corporate"],
    notes: "Uso comercial ampliado (campanhas, ads, internacional): +20% a +40%." },
  { id: "photo-corporate-frequency", name: "Corporative Shooting | Frequency", folder: "photo", plan: "frequency", unit: "hour", price: 130, crp: 30, hours: 1, potential: "review",
    deliverable: "Sessão corporativa (1h), ~8 fotos editadas.", includes: ["Direção", "Enquadramento", "Consistência visual", "8 fotos editadas/h"], use_for: ["Empresas", "Profissionais", "Websites e LinkedIn"],
    not_for: "Frequency sem desconto — rever.", invoice_label: "® [MM] Corporate Photography (hour)", market: MARKET.photo_hour, tags: ["retrato", "corporate"] },
  { id: "photo-corporate-on-demand", name: "Corporative Shooting | On-Demand", folder: "photo", plan: "on_demand", unit: "hour", price: 130, crp: 30, hours: 1, potential: "high",
    deliverable: "Sessão corporativa (1h), ~8 fotos editadas.", includes: ["Direção", "Enquadramento", "Consistência visual", "8 fotos editadas/h"], use_for: ["Empresas", "Profissionais", "Websites e LinkedIn"],
    invoice_label: "® [MM] Corporate Photography (hour)", market: MARKET.photo_hour, tags: ["retrato", "corporate"] },
  { id: "photo-extra", name: "Photo [Extra]", folder: "photo", plan: "extra", unit: "item", price: 15, crp: 2.5, hours: 0.1, potential: "high",
    deliverable: "1 foto adicional editada, sem nova sessão de captação.", includes: ["Edição de 1 foto já captada"], use_for: ["Cliente quer mais fotos da mesma sessão"],
    invoice_label: "® [MM] Additional Edited Photo", tags: ["foto", "extra"] },
  { id: "photo-editing-frequency", name: "Photo Editing | Frequency", folder: "photo", plan: "frequency", unit: "hour", price: 122, crp: 20, hours: 1, potential: "review",
    deliverable: "Edição de até 10 fotos já capturadas (nível profissional).", includes: ["1h = até 10 fotos", "Acima disso: hora extra ou pacote"], use_for: ["Fotos já captadas"],
    not_for: "Frequency sem desconto — rever.", invoice_label: "® [MM] Photo Editing (hour, up to 10 photos)", market: MARKET.photo_hour, tags: ["edição", "foto"] },
  { id: "photo-editing-on-demand", name: "Photo Editing | On Demand", folder: "photo", plan: "on_demand", unit: "hour", price: 122, crp: 20, hours: 1, potential: "high",
    deliverable: "Edição de até 10 fotos já capturadas (nível profissional).", includes: ["1h = até 10 fotos", "Acima disso: hora extra ou pacote"], use_for: ["Fotos já captadas"],
    invoice_label: "® [MM] Photo Editing (hour, up to 10 photos)", market: MARKET.photo_hour, tags: ["edição", "foto"] },
  { id: "photo-express", name: "Photo Express Delivery [Extra]", folder: "photo", plan: "extra", unit: "item", price: 80, crp: 20, hours: 0.5, potential: "high",
    deliverable: "Entrega prioritária em 24–48h da mesma sessão.", includes: ["Entrega em 24–48h"], use_for: ["Prazos curtos"], invoice_label: "® [MM] Express Delivery 24–48h [Extra]", tags: ["urgente", "extra"] },
  { id: "photo-retouch", name: "Photo Retouch [Extra]", folder: "photo", plan: "extra", unit: "item", price: 30, crp: 7.5, hours: 0.25, potential: "high",
    deliverable: "Retoque avançado (pele, remoção de objetos) em 1 foto.", includes: ["Pele", "Remoção de objetos", "Ajustes finos"], use_for: ["Retratos e produto"],
    invoice_label: "® [MM] Advanced Retouch (per photo)", market: MARKET.retouch, tags: ["retoque", "extra"] },
  { id: "photo-shooting-frequency", name: "Shooting | frequency", folder: "photo", plan: "frequency", unit: "hour", price: 122, crp: 25, hours: 1, potential: "review",
    deliverable: "Sessão de retrato/branding pessoal (1h), 10–20 fotos editadas.", includes: ["10–20 fotos editadas/h"], use_for: ["Conteúdo social", "Retratos simples", "Branding pessoal"],
    not_for: "Frequency sem desconto — rever.", invoice_label: "® [MM] Photo Session (hour)", market: MARKET.photo_hour, tags: ["retrato", "branding"] },
  { id: "photo-shooting-on-demand", name: "Shooting | On-Demand", folder: "photo", plan: "on_demand", unit: "hour", price: 122, crp: 25, hours: 1, potential: "high",
    deliverable: "Sessão de retrato/branding pessoal (1h), 10–20 fotos editadas.", includes: ["10–20 fotos editadas/h"], use_for: ["Conteúdo social", "Retratos simples", "Branding pessoal"],
    invoice_label: "® [MM] Photo Session (hour)", market: MARKET.photo_hour, tags: ["retrato", "branding"] },

  // ---------- Pré-produção & logística
  { id: "travel-frequency", name: "Deslocamento | Frequency", folder: "preprod", plan: "frequency", unit: "trip", price: 150, crp: 150, hours: 0, pass_through: true, potential: "passthrough",
    deliverable: "Deslocamento até ao local — custo real (€0,40/km + parking), sem margem.", includes: ["€0,40/km", "Parking ao valor real"], use_for: ["Produções fora de Amsterdão"],
    not_for: "Agrupe produções no mesmo dia para reduzir deslocações.", invoice_label: "® [MM] Travel (€0.40/km + parking)", kind: "travel", tags: ["km", "transporte"] },
  { id: "travel-on-demand", name: "Deslocamento | On Demand", folder: "preprod", plan: "on_demand", unit: "trip", price: 150, crp: 150, hours: 0, pass_through: true, potential: "passthrough",
    deliverable: "Deslocamento até ao local — custo real (€0,40/km + parking), sem margem.", includes: ["€0,40/km", "Parking ao valor real"], use_for: ["Produções fora de Amsterdão"],
    invoice_label: "® [MM] Travel (€0.40/km + parking)", kind: "travel", tags: ["km", "transporte"] },
  { id: "strategy-frequency", name: "Estratégia / Roteiro | Frequency", folder: "preprod", plan: "frequency", unit: "hour", price: 150, crp: 45, hours: 1, potential: "review",
    deliverable: "1 roteiro curto ou estrutura de conteúdo entregue por escrito.", includes: ["Roteiro", "Estrutura narrativa", "Planeamento de conteúdo", "Direção criativa"], use_for: ["Antes de cada ciclo de captação"],
    not_for: "Frequency sem desconto — rever. Upsell: planeamento mensal €300–600; campanha €500+.", invoice_label: "® [MM] Strategy / Script (hour)", kind: "strategy", tags: ["roteiro", "estratégia"] },
  { id: "strategy-on-demand", name: "Estratégia / Roteiro | On Demand", folder: "preprod", plan: "on_demand", unit: "hour", price: 150, crp: 45, hours: 1, potential: "high",
    deliverable: "1 roteiro curto ou estrutura de conteúdo entregue por escrito.", includes: ["Roteiro", "Estrutura narrativa", "Planeamento de conteúdo", "Direção criativa"], use_for: ["Antes de cada ciclo de captação"],
    not_for: "Upsell: planeamento mensal €300–600; estratégia de campanha €500+.", invoice_label: "® [MM] Strategy / Script (hour)", kind: "strategy", tags: ["roteiro", "estratégia"] },
];

export const SEED_SERVICES: Service[] = RAW.map((r) => normalizeService({ ...r, source: { notion: NOTION } }));
