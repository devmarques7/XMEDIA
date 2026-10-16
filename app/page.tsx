"use client";

import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LangSwitch, ThemeToggle } from "@/components/ui";
import { useT, type Lang } from "@/lib/i18n";
import { COMPANY } from "@/lib/invoice";

// Imagens provisórias (Unsplash, licença livre) — trocar pelo portefólio MediaMarques em /public/site/.
const img = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=72&auto=format&fit=crop`;
const IMG = {
  studio: "photo-1601506521937-0121a7fc2a6b",
  clapper: "photo-1485846234645-a62644f84728",
  edit: "photo-1574717024653-61fd2cf4d44d",
  camera: "photo-1516035069371-29a1b244cc32",
  portrait: "photo-1534030347209-467a5b0ad3e6",
  field: "photo-1492691527719-9d1e07e534b4",
};
const WHATSAPP = `https://wa.me/${COMPANY.tel.replace(/\D/g, "").replace(/^310/, "31")}`;

type Service = { title: [string, string]; text: string; price: string; time: string; images: string[] };
type Copy = {
  nav: [string, string, string];
  enter: string;
  heroLabel: string;
  hero: [string, string, string];
  heroText: string;
  specs: [string, string][];
  slides: string[];
  next: string;
  weCreate: string;
  services: Service[];
  book: string;
  process: string;
  steps: [string, string][];
  contactLabel: string;
  contactTitle: [string, string];
  mantra: string;
  contactText: string;
  whatsapp: string;
  diagnosis: string;
  team: string;
  diagMsg: string;
};

// Dados: skills marques-support-agent (serviços, faixas "a partir de", processo) e marques-studio (posicionamento, mantra).
const COPY: Record<Lang, Copy> = {
  pt: {
    nav: ["Serviços", "Processo", "Contacto"],
    enter: "Entrar",
    heroLabel: "Media Marques",
    hero: ["A sua excelência", "merece ser vista", "Amsterdam"],
    heroText: "Produção audiovisual para marcas de alto padrão: conteúdo mensal para redes sociais e projetos on-demand de vídeo e fotografia.",
    specs: [
      ["Base", "Amsterdam, NL"],
      ["Serviços", "Vídeo · Foto · Social"],
      ["Formato", "Mensal · On-demand"],
      ["Resposta", "Até 4h úteis"],
    ],
    slides: ["Produção em estúdio", "Captação on-location", "Pós-produção & color"],
    next: "Seguinte",
    weCreate: "O que fazemos",
    services: [
      { title: ["Conteúdo", "mensal"], text: "Presença consistente nas redes: Reels, fotografia, capas e carrosséis, planeados mês a mês. Pacotes Essential, Storytelling e Authority.", price: "Pacotes mensais", time: "15–20 dias / ciclo", images: [IMG.studio, IMG.edit] },
      { title: ["Captação", "de vídeo"], text: "Equipa e equipamento para eventos, lançamentos, institucionais e campanhas — básica ou PRO.", price: "a partir de €125/h", time: "On-demand", images: [IMG.camera] },
      { title: ["Edição", "& pós"], text: "Reels simples ou complexos, color grading cinematográfico e design de capas.", price: "a partir de €95/reel", time: "5–10 dias úteis", images: [IMG.edit] },
      { title: ["Fotografia", "de marca"], text: "Retratos executivos, lifestyle e produto, com edição incluída.", price: "a partir de €122/h", time: "On-demand", images: [IMG.portrait, IMG.field] },
      { title: ["Brand", "elevation"], text: "Para marcas que já são excelentes mas ainda não parecem: identidade, posicionamento e produção de alto nível.", price: "Sob diagnóstico", time: "Activation · Elevation · Ecosystem", images: [IMG.clapper] },
    ],
    book: "Pedir proposta",
    process: "Processo",
    steps: [
      ["Diagnóstico", "Respondemos em até 4h úteis e alinhamos objetivo, formato e prazo numa reunião de 30–45 min."],
      ["Pré-produção", "Direção criativa, roteiro e moodboard. Nada é gravado sem a sua aprovação."],
      ["Produção", "Dia(s) de captação de vídeo e fotografia, com protocolo de produção."],
      ["Entrega", "Primeiro draft, até 2 rondas de ajustes e entrega final organizada."],
    ],
    contactLabel: "Contacto",
    contactTitle: ["Vamos", "conversar"],
    mantra: "“Beleza atrai, mas o posicionamento retém.”",
    contactText: "Conte-nos o objetivo — evento, campanha, lançamento ou presença mensal — e indicamos o caminho certo.",
    whatsapp: "WhatsApp",
    diagnosis: "Agendar diagnóstico",
    team: "Área da equipa",
    diagMsg: "Olá! Gostaria de agendar um diagnóstico com a Media Marques.",
  },
  en: {
    nav: ["Services", "Process", "Contact"],
    enter: "Sign in",
    heroLabel: "Media Marques",
    hero: ["Your excellence", "deserves to be seen", "Amsterdam"],
    heroText: "Audiovisual production for high-end brands: monthly social media content and on-demand video and photography projects.",
    specs: [
      ["Base", "Amsterdam, NL"],
      ["Services", "Video · Photo · Social"],
      ["Format", "Monthly · On-demand"],
      ["Reply", "Within 4 business hours"],
    ],
    slides: ["Studio production", "On-location shoot", "Post-production & colour"],
    next: "Next",
    weCreate: "What we create",
    services: [
      { title: ["Monthly", "content"], text: "Consistent social presence: Reels, photography, covers and carousels, planned month by month. Essential, Storytelling and Authority packages.", price: "Monthly packages", time: "15–20 days / cycle", images: [IMG.studio, IMG.edit] },
      { title: ["Video", "production"], text: "Crew and equipment for events, launches, corporate films and campaigns — basic or PRO.", price: "from €125/h", time: "On-demand", images: [IMG.camera] },
      { title: ["Editing", "& post"], text: "Simple or complex Reels, cinematic colour grading and cover design.", price: "from €95/reel", time: "5–10 business days", images: [IMG.edit] },
      { title: ["Brand", "photography"], text: "Executive portraits, lifestyle and product, editing included.", price: "from €122/h", time: "On-demand", images: [IMG.portrait, IMG.field] },
      { title: ["Brand", "elevation"], text: "For brands that are already excellent but don't look it yet: identity, positioning and high-end production.", price: "By diagnosis", time: "Activation · Elevation · Ecosystem", images: [IMG.clapper] },
    ],
    book: "Request a proposal",
    process: "Process",
    steps: [
      ["Diagnosis", "We reply within 4 business hours and align goal, format and timing in a 30–45 min call."],
      ["Pre-production", "Creative direction, script and moodboard. Nothing is shot without your approval."],
      ["Production", "Video and photo capture day(s), with a production protocol."],
      ["Delivery", "First draft, up to 2 rounds of revisions and an organised final delivery."],
    ],
    contactLabel: "Contact",
    contactTitle: ["Let's", "talk"],
    mantra: "“Beauty attracts, but positioning retains.”",
    contactText: "Tell us the goal — event, campaign, launch or monthly presence — and we'll point you to the right path.",
    whatsapp: "WhatsApp",
    diagnosis: "Book a diagnosis",
    team: "Team area",
    diagMsg: "Hi! I'd like to book a diagnosis with Media Marques.",
  },
  nl: {
    nav: ["Diensten", "Proces", "Contact"],
    enter: "Inloggen",
    heroLabel: "Media Marques",
    hero: ["Jouw kwaliteit", "verdient gezien te worden", "Amsterdam"],
    heroText: "Audiovisuele productie voor high-end merken: maandelijkse social media content en on-demand video- en fotoprojecten.",
    specs: [
      ["Basis", "Amsterdam, NL"],
      ["Diensten", "Video · Foto · Social"],
      ["Vorm", "Maandelijks · On-demand"],
      ["Reactie", "Binnen 4 werkuren"],
    ],
    slides: ["Studioproductie", "Opname op locatie", "Postproductie & kleur"],
    next: "Volgende",
    weCreate: "Wat we maken",
    services: [
      { title: ["Maandelijkse", "content"], text: "Consistente aanwezigheid op social: Reels, fotografie, covers en carrousels, maand voor maand gepland. Pakketten Essential, Storytelling en Authority.", price: "Maandpakketten", time: "15–20 dagen / cyclus", images: [IMG.studio, IMG.edit] },
      { title: ["Video", "opnames"], text: "Crew en apparatuur voor events, lanceringen, bedrijfsfilms en campagnes — basis of PRO.", price: "vanaf €125/u", time: "On-demand", images: [IMG.camera] },
      { title: ["Montage", "& post"], text: "Eenvoudige of complexe Reels, filmische color grading en coverontwerp.", price: "vanaf €95/reel", time: "5–10 werkdagen", images: [IMG.edit] },
      { title: ["Merk", "fotografie"], text: "Zakelijke portretten, lifestyle en product, inclusief nabewerking.", price: "vanaf €122/u", time: "On-demand", images: [IMG.portrait, IMG.field] },
      { title: ["Brand", "elevation"], text: "Voor merken die al uitstekend zijn maar er nog niet zo uitzien: identiteit, positionering en high-end productie.", price: "Na diagnose", time: "Activation · Elevation · Ecosystem", images: [IMG.clapper] },
    ],
    book: "Offerte aanvragen",
    process: "Proces",
    steps: [
      ["Diagnose", "We reageren binnen 4 werkuren en stemmen doel, vorm en planning af in een gesprek van 30–45 min."],
      ["Preproductie", "Creatieve regie, script en moodboard. Er wordt niets opgenomen zonder jouw akkoord."],
      ["Productie", "Opnamedag(en) voor video en foto, met een productieprotocol."],
      ["Oplevering", "Eerste versie, tot 2 correctierondes en een overzichtelijke eindoplevering."],
    ],
    contactLabel: "Contact",
    contactTitle: ["Laten we", "praten"],
    mantra: "“Schoonheid trekt aan, positionering houdt vast.”",
    contactText: "Vertel ons het doel — event, campagne, lancering of maandelijkse aanwezigheid — en we wijzen je de juiste weg.",
    whatsapp: "WhatsApp",
    diagnosis: "Diagnose plannen",
    team: "Teamomgeving",
    diagMsg: "Hallo! Ik wil graag een diagnosegesprek met Media Marques plannen.",
  },
};

const SLIDES = [IMG.studio, IMG.clapper, IMG.edit];

export default function Site() {
  const { lang } = useT();
  const c = COPY[lang];
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 7000);
    return () => clearInterval(t);
  }, [slide]);
  const go = (d: number) => setSlide((s) => (s + d + SLIDES.length) % SLIDES.length);
  const diag = `${WHATSAPP}?text=${encodeURIComponent(c.diagMsg)}`;

  return (
    <main className="site">
      {/* ---------- hero ---------- */}
      <section className="s-hero" aria-roledescription="carousel">
        {SLIDES.map((id, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={id} src={img(id, 2000)} alt={c.slides[i]} className={`s-hero-img ${i === slide ? "on" : ""}`} fetchPriority={i === 0 ? "high" : "low"} />
        ))}
        <div className="s-hero-shade" />

        <header className="s-top">
          <span className="s-tiny">{c.heroLabel} ©</span>
          <nav className="s-nav">
            <a href="#servicos">{c.nav[0]}</a>
            <a href="#processo">{c.nav[1]}</a>
            <a href="#contacto">{c.nav[2]}</a>
          </nav>
          <div className="s-top-right">
            <LangSwitch />
            <ThemeToggle />
            <Link href="/home" className="s-enter">
              {c.enter} <Icon name="arrow" size={14} />
            </Link>
          </div>
        </header>

        <span className="s-tiny s-index">{String(slide + 1).padStart(2, "0")}</span>

        <h1 className="s-hero-title">
          <span className="l1">{c.hero[0]}</span>
          <span className="l2">{c.hero[1]}</span>
          <span className="l3">{c.hero[2]}</span>
        </h1>

        <div className="s-hero-copy">
          <p>{c.heroText}</p>
          <div className="s-arrows">
            <button onClick={() => go(-1)} aria-label="←">
              <Icon name="back" size={14} />
            </button>
            <button onClick={() => go(1)} aria-label={c.next}>
              <Icon name="next" size={14} />
            </button>
          </div>
        </div>

        <dl className="s-specs">
          {c.specs.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="s-counter s-tiny">
          {slide + 1} <i /> {SLIDES.length}
          <span className="s-caption">{c.slides[slide]}</span>
        </div>
        <button className="s-next s-tiny" onClick={() => go(1)}>
          {c.next}
        </button>
      </section>

      {/* ---------- serviços ---------- */}
      <section id="servicos" className="s-section">
        <div className="s-center-label s-tiny">{c.weCreate}</div>
        {c.services.map((s, i) => (
          <article key={i} className="s-row">
            <span className="s-tiny s-row-n">{String(i + 1).padStart(2, "0")}</span>
            <h2 className="s-row-title">
              {s.title[0]}
              <br />
              {s.title[1]}
            </h2>
            <div className="s-row-text">
              <p>{s.text}</p>
              <span className="s-price">{s.price}</span>
            </div>
            <div className="s-row-meta">
              <span className="s-tiny s-faint">{s.time}</span>
              <a href={diag} target="_blank" rel="noreferrer" className="s-book">
                ↳ {c.book}
              </a>
            </div>
            <div className={`s-row-imgs n${s.images.length}`}>
              {s.images.map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} src={img(id, 700)} alt="" loading="lazy" />
              ))}
            </div>
          </article>
        ))}
      </section>

      {/* ---------- processo ---------- */}
      <section id="processo" className="s-section">
        <div className="s-center-label s-tiny">{c.process}</div>
        <div className="s-steps">
          {c.steps.map(([t, d], i) => (
            <div key={t} className="s-step">
              <span className="s-tiny s-faint">{String(i + 1).padStart(2, "0")}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- contacto ---------- */}
      <section id="contacto" className="s-section s-contact">
        <div className="s-center-label s-tiny">{c.contactLabel}</div>
        <div className="s-contact-grid">
          <h2 className="s-row-title s-contact-title">
            {c.contactTitle[0]}
            <br />
            {c.contactTitle[1]}
          </h2>
          <div className="s-contact-copy">
            <p className="s-mantra">{c.mantra}</p>
            <p>{c.contactText}</p>
            <div className="s-ctas">
              <a href={diag} target="_blank" rel="noreferrer" className="s-btn solid">
                {c.diagnosis} <Icon name="arrow" size={14} />
              </a>
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="s-btn">
                {c.whatsapp} · {COMPANY.tel}
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="s-foot">
        <span>
          {COMPANY.brand} · {COMPANY.address}
        </span>
        <span>
          KVK {COMPANY.kvk} · BTW {COMPANY.btw}
        </span>
        <Link href="/login" className="s-book">
          ↳ {c.team}
        </Link>
      </footer>
    </main>
  );
}
