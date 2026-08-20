import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Answers = Record<string, string>;
type PublicForm = { brand_name: string; status: string; expires_at: string | null };
type Question = { key: string; title: string; hint: string; placeholder: string };

const STEPS: Array<{ title: string; subtitle: string; questions: Question[] }> = [
  { title: "Essência da marca", subtitle: "Vamos alinhar a direção que guia todas as decisões.", questions: [
    { key: "vision", title: "Qual é a visão de futuro da marca?", hint: "Onde vocês querem chegar?", placeholder: "Ex.: Ser a principal referência em..." },
    { key: "mission", title: "Que transformação a marca entrega?", hint: "Conte em palavras simples o propósito do negócio.", placeholder: "Ex.: Ajudamos pessoas a..." },
  ] },
  { title: "Público e posicionamento", subtitle: "Agora, vamos entender para quem a marca existe e como ela deve ser percebida.", questions: [
    { key: "idealCustomer", title: "Quem é o cliente ideal?", hint: "Perfil, momento, dores, desejos e poder de compra.", placeholder: "Descreva a pessoa que mais se beneficia da sua solução..." },
    { key: "positioning", title: "Como a marca deve ser lembrada?", hint: "Seu posicionamento desejado frente ao mercado.", placeholder: "Ex.: Uma marca premium, próxima e prática para..." },
    { key: "differentiators", title: "Quais são os principais diferenciais?", hint: "O que torna a escolha pela marca evidente?", placeholder: "Atendimento, método, produto, resultado, experiência..." },
  ] },
  { title: "Oferta e vendas", subtitle: "Com essas respostas, conseguimos desenhar uma oferta e um funil mais coerentes.", questions: [
    { key: "offer", title: "Qual é a oferta principal hoje?", hint: "Promessa, condição, preço ou chamada para ação.", placeholder: "Descreva a oferta que mais importa neste momento..." },
    { key: "products", title: "Quais produtos ou serviços vocês vendem?", hint: "Inclua prioridades e faixas de preço, se possível.", placeholder: "Liste os produtos e serviços..." },
    { key: "salesFunnel", title: "Como acontece a venda hoje?", hint: "Da primeira descoberta até o pós-venda.", placeholder: "Ex.: Instagram → WhatsApp → diagnóstico → proposta..." },
    { key: "objections", title: "Quais objeções mais aparecem?", hint: "Dúvidas ou barreiras que impedem a compra.", placeholder: "Ex.: preço, prazo, confiança, comparação..." },
  ] },
  { title: "Crescimento e conteúdo", subtitle: "Por último, defina o que precisa mudar e quais mensagens a marca deve defender.", questions: [
    { key: "objectives", title: "Quais são os objetivos mais importantes?", hint: "Receita, volume, expansão, margem, retenção ou outra prioridade.", placeholder: "Nos próximos 3 a 12 meses queremos..." },
    { key: "contentPillars", title: "Quais temas e mensagens a marca deve comunicar?", hint: "Assuntos, histórias, provas e formatos que têm mais potencial.", placeholder: "Ex.: bastidores, educação, resultados, autoridade..." },
    { key: "competitors", title: "Quais concorrentes ou referências devemos observar?", hint: "Podem ser marcas admiradas ou concorrentes diretos.", placeholder: "Liste nomes, perfis ou links, se desejar..." },
    { key: "notes", title: "Há algo importante que não perguntamos?", hint: "Contextos, restrições, aprendizados ou ideias que devemos considerar.", placeholder: "Escreva aqui qualquer informação adicional..." },
  ] },
];

function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#070707] px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-3xl">{children}</div></main>; }

export default function PublicBrandDiagnosticForm() {
  const { token } = useParams();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const form = useQuery({ queryKey: ["public-brand-diagnostic", token], enabled: !!token, retry: 1, queryFn: async (): Promise<PublicForm | null> => { const { data, error } = await (supabase as any).rpc("get_public_brand_diagnostic_form", { p_token: token }); if (error) throw error; return data as PublicForm | null; } });
  const submit = useMutation({ mutationFn: async () => { const { error } = await (supabase as any).rpc("submit_public_brand_diagnostic_form", { p_token: token, p_answers: answers }); if (error) throw error; } });
  const current = STEPS[step];
  const progress = useMemo(() => Math.round(((step + 1) / STEPS.length) * 100), [step]);

  if (!token) return <Navigate to="/" replace />;
  if (form.isLoading) return <Shell><div className="grid min-h-[70vh] place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div></Shell>;
  if (form.isError || !form.data) return <Shell><section className="mx-auto mt-24 max-w-lg rounded-3xl border border-white/10 bg-white/[.04] p-8 text-center"><h1 className="text-2xl font-black">Link indisponível</h1><p className="mt-3 text-sm text-white/60">Este diagnóstico foi removido, expirou ou já foi enviado.</p></section></Shell>;
  if (submit.isSuccess) return <Shell><section className="mx-auto mt-24 max-w-lg rounded-3xl border border-emerald-400/20 bg-emerald-400/[.06] p-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" /><h1 className="mt-5 text-2xl font-black">Diagnóstico enviado</h1><p className="mt-3 text-sm leading-relaxed text-white/65">Obrigado. As respostas foram registradas e já estão disponíveis para a equipe da {form.data.brand_name} preparar a estratégia.</p></section></Shell>;

  return <Shell><header className="mb-7 flex items-center justify-between"><div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-white/75"><span className="grid h-8 w-8 place-items-center rounded-xl border border-white/15 bg-white/[.07]"><Sparkles className="h-4 w-4" /></span> Growdash</div><span className="text-xs text-white/45">Diagnóstico estratégico</span></header><section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[.045] shadow-2xl shadow-black/40"><div className="h-1 bg-white/10"><div className="h-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} /></div><div className="p-6 sm:p-9"><p className="text-xs font-bold uppercase tracking-[.15em] text-white/45">{form.data.brand_name} · Etapa {step + 1} de {STEPS.length}</p><h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{current.title}</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">{current.subtitle}</p><div className="mt-8 space-y-6">{current.questions.map((question) => <label key={question.key} className="grid gap-2"><span className="text-sm font-bold">{question.title}</span><span className="text-xs text-white/45">{question.hint}</span><Textarea value={answers[question.key] || ""} onChange={(event) => setAnswers((value) => ({ ...value, [question.key]: event.target.value }))} placeholder={question.placeholder} className="min-h-28 resize-y border-white/10 bg-black/25 text-white placeholder:text-white/25 focus-visible:ring-white/40" /></label>)}</div><div className="mt-8 flex items-center justify-between gap-3"><Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Voltar</Button>{step < STEPS.length - 1 ? <Button onClick={() => setStep((value) => value + 1)}>Continuar<ChevronRight className="ml-1 h-4 w-4" /></Button> : <Button onClick={() => submit.mutate()} disabled={submit.isPending}>{submit.isPending ? "Enviando…" : "Enviar diagnóstico"}<CheckCircle2 className="ml-2 h-4 w-4" /></Button>}</div>{submit.isError && <p className="mt-4 text-xs text-red-300">Não foi possível enviar agora. Verifique sua conexão e tente novamente.</p>}</div></section><p className="mx-auto mt-5 max-w-xl text-center text-xs leading-relaxed text-white/35">Suas respostas serão usadas apenas para estruturar a estratégia desta marca. Não é necessário criar conta na Growdash.</p></Shell>;
}
