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
};

const slides: PresentationSlide[] = [
  {
    eyebrow: "Growdash · framework de tráfego pago",
    title: "Estrutura de Funil para Tráfego Pago",
    description: "Um modelo para criar aquisição previsível: atrair, educar, captar e recuperar com clareza operacional.",
    highlights: ["Atrair", "Educar", "Captar", "Remarketing"],
    note: "Apresentação padrão para experts Growdash.",
  },
  {
    eyebrow: "A estratégia antes da captação",
    title: "Não começa captando lead.",
    description: "Ela constrói contexto. Quanto mais contexto, maior a chance de o lead avançar para atendimento, avaliação e venda.",
    highlights: ["01 · Atrair descoberta", "02 · Educar confiança", "03 · Captar lead qualificado", "04 · Recuperar interesse"],
  },
  {
    eyebrow: "A jornada completa",
    title: "Atenção vira intenção com etapas claras.",
    description: "Cada etapa tem objetivo, audiência e sinal de avanço. O comercial recebe um lead com mais contexto, não apenas um contato.",
    highlights: ["Atrair · audiência e atenção", "Qualificar · autoridade e objeções", "Captar · Direct, formulário ou WhatsApp", "Recuperar · retomar contexto"],
  },
  {
    eyebrow: "Etapa 1 · Atrair",
    title: "Atrair atenção qualificada",
    description: "Crie descoberta e forme públicos de remarketing com pessoas que demonstram interesse real.",
    highlights: ["Criativos de descoberta", "Oferta invisível", "Públicos proprietários", "Métricas: retenção, CPV e engajamento"],
  },
  {
    eyebrow: "Etapa 2 · Qualificar e educar",
    title: "Construa confiança antes de vender.",
    description: "Conteúdo que traz clareza, autoridade, segurança e responde objeções prepara a audiência para avançar.",
    highlights: ["Clareza do problema", "Autoridade do expert", "Quebra de objeções", "Sinais: retenção, respostas e cliques"],
  },
  {
    eyebrow: "Etapa 3 · Captar",
    title: "Capte com qualificação conversacional.",
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
    title: "Uma aquisição previsível e mensurável.",
    description: "Conteúdo, tráfego pago, audiência qualificada, captação, atendimento, avaliação e dados formam um ciclo de otimização contínua.",
    highlights: ["Conteúdo", "Tráfego pago", "Audiência qualificada", "Captação · atendimento · avaliação · dados"],
  },
  {
    eyebrow: "Próximo passo",
    title: "Estruture o funil do expert.",
    description: "Tráfego pago não serve apenas para gerar leads: ele constrói intenção, confiança e previsibilidade comercial.",
    highlights: ["Definir oferta e público", "Criar os criativos por etapa", "Configurar qualificação e atendimento", "Acompanhar métricas de avanço"],
    note: "Growdash · framework padrão para experts.",
  },
];

export function PaidTrafficPresentation() {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];
  const isBudgetSlide = current === 7;

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

      <div className="relative overflow-hidden bg-zinc-950 px-5 py-8 text-zinc-50 sm:px-10 sm:py-12 lg:min-h-[570px] lg:px-16 lg:py-16">
        <div className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto flex max-w-6xl flex-col justify-between gap-10 lg:min-h-[440px]">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary">{slide.eyebrow}</p>
            <h3 className="mt-4 text-3xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">{slide.title}</h3>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">{slide.description}</p>
          </div>

          <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", isBudgetSlide && "lg:grid-cols-4")}>
            {slide.highlights.map((highlight, index) => {
              const [label, value] = highlight.split(" · ");
              return <article key={highlight} className={cn("min-h-28 rounded-xl border border-zinc-700/90 bg-zinc-900/90 p-4", isBudgetSlide && "border-primary/40 bg-primary/10")}>
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-primary"><CircleDot className="h-3.5 w-3.5" />{isBudgetSlide ? label : `Etapa ${index + 1}`}</span>
                <p className={cn("mt-3 text-sm font-bold leading-snug text-zinc-100", isBudgetSlide && "text-2xl")}>{isBudgetSlide ? value : highlight}</p>
              </article>;
            })}
          </div>

          {slide.note && <p className="flex max-w-3xl items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs font-medium leading-relaxed text-zinc-200"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{slide.note}</p>}
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
