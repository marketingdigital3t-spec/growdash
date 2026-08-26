import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleDot, Play, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PresentationSlide = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  note?: string;
  kind?: "cover" | "strategy" | "funnel" | "budget" | "cycle" | "cta";
};

const slideTones = ["dark", "light", "dark", "dark", "light", "dark", "light", "dark", "light", "dark", "dark", "dark"] as const;

const slides: PresentationSlide[] = [
  {
    eyebrow: "Growdash · framework de tráfego pago",
    title: "Estrutura de Funil para Tráfego Pago",
    description: "Um modelo para criar aquisição previsível: atrair, educar, captar e recuperar com clareza operacional.",
    highlights: ["Atrair", "Educar", "Captar", "Remarketing"],
    note: "Apresentação padrão para experts Growdash.",
    kind: "cover",
  },
  {
    eyebrow: "A estratégia antes da captação",
    title: "A estratégia não começa captando lead.",
    description: "Decisão com mais contexto = lead com mais chance de agenda. A jornada organiza atenção, confiança, intenção e recuperação.",
    highlights: ["01 · Atrair (descoberta)", "02 · Educar (confiança)", "03 · Captar (lead qualificado)", "04 · Recuperar (remarketing)"],
    kind: "strategy",
  },
  {
    eyebrow: "A jornada completa",
    title: "Da atenção ao lead qualificado.",
    description: "Cada etapa tem objetivo, audiência e sinal de avanço. O comercial recebe contexto, não apenas um contato.",
    highlights: ["Atrair · descoberta, audiência e atenção", "Qualificar + educar · autoridade e objeções", "Captar lead · oferta, Direct, formulário ou WhatsApp", "Remarketing · recuperar interesse"],
    kind: "funnel",
  },
  {
    eyebrow: "Etapa 1 · Atrair",
    title: "Atrair atenção qualificada",
    description: "Crie descoberta e forme públicos de remarketing com pessoas que demonstram interesse real.",
    highlights: ["Criativos de descoberta", "Oferta invisível", "Públicos proprietários", "Métricas: retenção, CPV e engajamento"],
  },
  {
    eyebrow: "Etapa 2 · Qualificar e educar",
    title: "Qualifique e eduque antes de vender.",
    description: "Conteúdo que traz clareza, autoridade, segurança e responde objeções prepara a audiência para avançar.",
    highlights: ["Clareza do problema", "Autoridade do expert", "Quebra de objeções", "Sinais: retenção, respostas e cliques"],
  },
  {
    eyebrow: "Etapa 3 · Captar",
    title: "Capte lead com qualificação conversacional.",
    description: "A jornada pode seguir por anúncio, Direct, ManyChat, perguntas, classificação e atendimento humano.",
    highlights: ["Interesse e procedimento", "Momento de decisão", "Capacidade de avançar", "Classificação: quente, morno ou frio"],
    note: "ManyChat é a ponte entre a intenção e o atendimento.",
  },
  {
    eyebrow: "Etapa 4 · Remarketing",
    title: "Recupere quem demonstrou interesse.",
    description: "Retome a conversa de quem assistiu, engajou, clicou, entrou no Direct ou não concluiu o contato.",
    highlights: ["Vídeos assistidos", "Perfil engajado", "Clique no anúncio", "Formulário ou Direct não concluído"],
  },
  {
    eyebrow: "Distribuição inicial de verba",
    title: "Invista em todas as etapas da decisão.",
    description: "A distribuição é um ponto de partida. Ajuste sempre pelo custo do lead qualificado, avaliação e taxa de fechamento.",
    highlights: ["Atrair · 20%", "Qualificar e educar · 25%", "Captar lead · 50%", "Remarketing · 5%"],
    kind: "budget",
  },
  {
    eyebrow: "O que realmente medimos",
    title: "Não é apenas o lead mais barato.",
    description: "A meta é gerar o lead com maior chance de virar atendimento, avaliação e venda.",
    highlights: ["1 · Atenção: CPM, views e retenção", "2 · Interesse: engajamento, cliques e perfil", "3 · Intenção: conversas e respostas", "4/5 · Qualificação e comercial"],
  },
  {
    eyebrow: "Gestão e escala",
    title: "O funil avança por sinais de qualidade.",
    description: "Escalar sem público qualificado aumenta desperdício. Cada etapa precisa sustentar a seguinte.",
    highlights: ["Massa de audiência", "Sinais de confiança", "Lead qualificado", "Escala sustentada por CPQL, agenda e fechamento"],
    note: "Atualize exclusões de convertidos e criativos quando retenção ou CTR caírem.",
  },
  {
    eyebrow: "O ecossistema Growdash",
    title: "Um ecossistema previsível de aquisição.",
    description: "Conteúdo, tráfego pago, audiência qualificada, captação, atendimento, avaliação e dados formam um ciclo de otimização contínua.",
    highlights: ["Conteúdo", "Tráfego pago", "Audiência qualificada", "Captação · atendimento · avaliação · dados"],
    kind: "cycle",
  },
  {
    eyebrow: "Próximo passo",
    title: "Estruture o funil do expert.",
    description: "Tráfego pago não serve apenas para gerar leads: ele constrói intenção, confiança e previsibilidade comercial.",
    highlights: ["Definir oferta e público", "Criar criativos por etapa", "Configurar qualificação e atendimento", "Acompanhar métricas de avanço"],
    note: "INICIAR ESTRUTURAÇÃO DO FUNIL · GRUPO ZNTT",
    kind: "cta",
  },
];

export function PaidTrafficPresentation() {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];
  const isBudgetSlide = current === 7;
  const isDarkSlide = slideTones[current] === "dark";

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex flex-col gap-3 border-b border-border bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Growdash Academy</p>
          <h2 className="mt-1 text-lg font-black">Apresentação: Funil de Tráfego Pago</h2>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-xs font-bold tabular-nums text-muted-foreground">{current + 1} / {slides.length}</span>
          <Button variant="outline" size="icon" aria-label="Slide anterior" disabled={current === 0} onClick={() => setCurrent((index) => index - 1)}><ArrowLeft className="h-4 w-4" /></Button>
          <Button size="icon" aria-label="Próximo slide" disabled={current === slides.length - 1} onClick={() => setCurrent((index) => index + 1)}><ArrowRight className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className={cn("relative overflow-hidden px-5 py-8 sm:px-10 sm:py-12 lg:min-h-[570px] lg:px-16 lg:py-16", isDarkSlide ? "bg-[#050505] text-[#f5f5f5]" : "bg-[#f3f0ea] text-[#171717]")}>
        <div className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto flex max-w-6xl flex-col justify-between gap-10 lg:min-h-[440px]">
          <div className="max-w-3xl">
            <p className={cn("text-[11px] font-black uppercase tracking-[.16em]", isDarkSlide ? "text-[#d4a449]" : "text-[#76551d]")}>{slide.eyebrow}</p>
            <h3 className="mt-4 text-3xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">{slide.title}</h3>
            <p className={cn("mt-5 max-w-2xl text-base leading-relaxed sm:text-lg", isDarkSlide ? "text-[#b7b9bd]" : "text-[#515151]")}>{slide.description}</p>
          </div>

          {slide.kind === "cover" && <div className="ml-auto flex w-full max-w-sm flex-col gap-3 sm:w-80">
            {[["ATRAIR", "border-[#c9cdd1] bg-[#151619]"], ["EDUCAR", "border-[#aeb3b8] bg-[#232529]"], ["CAPTAR", "border-transparent bg-[#e8eaed] text-[#101114]"], ["RMKT", "border-[#aeb3b8] bg-[#151619] text-sm"]].map(([label, tone]) => <div key={label} className={cn("rounded-none border px-5 py-3 text-center text-2xl font-black tracking-tight", tone)}>{label}</div>)}
          </div>}
          {slide.kind === "strategy" && <div className="grid gap-4 sm:grid-cols-4">{["01  Atrair", "02  Educar", "03  Captar", "04  Recuperar"].map((x) => <div key={x} className="border-l-4 border-[#111] bg-white/70 px-4 py-3 text-lg font-black">{x}</div>)}</div>}
          {slide.kind === "funnel" && <div className="grid items-center gap-8 lg:grid-cols-[1fr_280px]">
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2">{[["01", "ATRAIR", "descoberta / audiência / atenção", "w-full bg-[#9b9ea2]"], ["", "QUALIFICAR + EDUCAR", "autoridade / confiança / objeções", "w-[86%] bg-[#696d73]"], ["", "CAPTAR LEAD", "oferta / Direct / formulário / WhatsApp", "w-[67%] bg-[#363940]"], ["", "REMARKETING", "recuperar quem demonstrou interesse", "w-[47%] bg-[#1f2024]"]].map(([n,t,d,c]) => <div key={t} className={cn("border-2 border-[#c7c9cc] px-4 py-4 text-center text-white", c)}><div className="text-2xl font-black">{n && <small className="mr-2 text-base">{n}</small>}{t}</div><div className="text-sm text-[#e1e2e4]">{d}</div></div>)}</div>
            <div className="rounded-2xl border-2 border-[#c7c9cc] bg-[#23252a] p-6 text-center text-white"><div className="text-2xl font-black">MANYCHAT</div><p className="mt-2 text-sm text-[#d8d9dc]">gateway da etapa 3<br/>qualificação inicial + handoff</p><div className="mt-5 text-sm font-bold text-[#d8d9dc]">RMKT<br/>não converteu?<br/>reimpacta com contexto</div></div>
          </div>}
          {slide.kind === "budget" && <div className="grid gap-4 sm:grid-cols-4">{slide.highlights.map((highlight) => { const [label, value] = highlight.split(" · "); return <article key={highlight} className="border border-[#aeb3b8] bg-[#1f2125] p-5 text-center text-white"><div className="text-xs font-black uppercase tracking-widest text-[#d4d6d9]">{label}</div><div className="mt-4 text-5xl font-black">{value}</div><div className="mt-3 h-2 rounded-full bg-[#55595f]"><div className="h-2 rounded-full bg-[#e8eaed]" style={{width:value}} /></div></article>; })}</div>}
          {slide.kind === "cycle" && <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">{slide.highlights.map((x, i) => <div key={x} className="flex aspect-square items-center justify-center rounded-full border-2 border-[#c7c9cc] bg-[#1f2125] p-4 text-center text-sm font-black text-white">{x}</div>)}</div>}
          {slide.kind === "cta" && <div className="flex flex-wrap gap-3">{slide.highlights.map((x) => <div key={x} className="border border-[#c7c9cc] bg-[#1f2125] px-5 py-3 text-sm font-bold text-white">{x}</div>)}</div>}
          {!slide.kind && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{slide.highlights.map((highlight, index) => <article key={highlight} className={cn("min-h-28 rounded-xl border p-4", isDarkSlide ? "border-[#3b3d41] bg-[#17191c]" : "border-[#c9c4bb] bg-white/80")}><span className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em]", isDarkSlide ? "text-[#d4a449]" : "text-[#76551d]")}><CircleDot className="h-3.5 w-3.5" />Etapa {index + 1}</span><p className={cn("mt-3 text-sm font-bold leading-snug", isDarkSlide ? "text-[#f5f5f5]" : "text-[#171717]")}>{highlight}</p></article>)}</div>}

          {slide.note && <p className={cn("flex max-w-3xl items-start gap-2 rounded-lg border p-3 text-xs font-medium leading-relaxed", isDarkSlide ? "border-[#806326] bg-[#2a2111] text-[#e7e0cf]" : "border-[#c9c4bb] bg-white/80 text-[#383838]")}><Check className={cn("mt-0.5 h-4 w-4 shrink-0", isDarkSlide ? "text-[#d4a449]" : "text-[#76551d]")} />{slide.note}</p>}
        </div>
      </div>

      <footer className="growdash-scrollbar flex items-center gap-2 overflow-x-auto border-t border-border bg-card p-3" aria-label="Navegação da apresentação">
        <Target className="h-4 w-4 shrink-0 text-primary" />
        {slides.map((item, index) => <button key={item.title} type="button" aria-label={`Abrir slide ${index + 1}: ${item.title}`} aria-current={current === index ? "step" : undefined} onClick={() => setCurrent(index)} className={cn("h-2.5 min-w-2.5 rounded-full transition", current === index ? "w-8 bg-primary" : "bg-muted-foreground/35 hover:bg-primary/60")} />)}
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-bold text-muted-foreground"><Play className="h-3 w-3" />Modo apresentação</span>
      </footer>
    </section>
  );
}
