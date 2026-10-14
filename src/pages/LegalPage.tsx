import { Link, useLocation } from "react-router-dom";
import { BrandMark } from "@/components/BrandLogo";

type LegalKey = "terms" | "privacy" | "cookies" | "dpa" | "sla" | "cancellation";
type Section = { title: string; body: string };

const documents: Record<LegalKey, { title: string; intro: string; sections: Section[] }> = {
  terms: { title: "Termos de Uso", intro: "Estes termos regulam o uso da Growdash por pessoas físicas e empresas no Brasil.", sections: [
    { title: "1. Aceite e conta", body: "Ao criar uma conta ou utilizar a plataforma, você declara capacidade civil e, se agir em nome de uma empresa, poderes para representá-la. O titular é responsável pelos dados fornecidos, pelas credenciais e por comunicar uso não autorizado." },
    { title: "2. Uso permitido", body: "É proibido compartilhar credenciais, contornar limites, praticar engenharia reversa, inserir código malicioso, violar direitos de terceiros ou usar a plataforma em desacordo com a lei e com as políticas dos provedores integrados." },
    { title: "3. Integrações e dados", body: "A Growdash acessa Meta, Google, TikTok, RD Station, WhatsApp e outros provedores somente após autorização e dentro dos escopos aprovados. O cliente garante que possui base legal para importar, analisar e compartilhar os dados inseridos." },
    { title: "4. Planos e cobrança", body: "Planos, preços, tributos, período de teste e limites são os exibidos no checkout. O uso está sujeito aos limites do plano. Ativação, suspensão, upgrade, downgrade e cobrança serão confirmados pelo provedor de pagamento." },
    { title: "5. Propriedade e disponibilidade", body: "O cliente mantém os direitos sobre seus dados; a Growdash mantém software, marca e documentação. A plataforma depende de internet e serviços externos: não garantimos resultados de campanhas, vendas, aprovação de anúncios ou disponibilidade de APIs." },
    { title: "6. Encerramento", body: "A conta pode ser encerrada pelo cliente ou pela Growdash nas hipóteses previstas, respeitados suporte, portabilidade, retenção legal e direitos do consumidor. Aplicam-se as leis brasileiras e tentativa prévia de resolução pelo canal de atendimento." },
  ] },
  privacy: { title: "Política de Privacidade e LGPD", intro: "Esta política explica como a Growdash trata dados pessoais de clientes, usuários, leads e visitantes.", sections: [
    { title: "1. Papéis", body: "Na prestação SaaS, o cliente normalmente é controlador dos dados de seus leads e equipe, e a Growdash atua como operadora. Para cadastro, cobrança, segurança e atendimento, a Growdash atua como controladora. Razão social, CNPJ, endereço e canal do encarregado devem ser preenchidos antes da comercialização." },
    { title: "2. Dados e finalidades", body: "Podemos tratar nome, e-mail, telefone, perfil, autenticação, CRM, funil, vendas, campanhas, contas de anúncios, integrações, arquivos e cobrança para autenticar, executar contrato, sincronizar integrações autorizadas, prestar suporte, proteger a plataforma e cumprir obrigações legais." },
    { title: "3. Bases, compartilhamento e retenção", body: "Cada fluxo deve ter base legal documentada. Dados podem ser processados por Supabase, Cloudflare, provedor de pagamento, Meta, Google, TikTok, RD Station, WhatsApp e suboperadores contratados, somente para a finalidade acordada. Retemos dados pelo tempo necessário, obrigação legal ou defesa de direitos; tokens revogados devem ser removidos." },
    { title: "4. Segurança e incidentes", body: "Aplicamos RLS, segregação por workspace, criptografia em trânsito, controle de acesso, logs e resposta a incidentes. Nenhuma medida elimina todo risco. Incidentes devem ser avaliados e comunicados conforme a LGPD e orientação jurídica." },
    { title: "5. Direitos do titular", body: "O titular pode solicitar confirmação, acesso, correção, anonimização, eliminação, portabilidade, informação sobre compartilhamentos e revisão de decisões automatizadas, quando aplicável. Podemos confirmar identidade e encaminhar pedidos relativos a dados do cliente ao controlador responsável." },
  ] },
  cookies: { title: "Política de Cookies", intro: "Cookies ajudam a manter a sessão, proteger o acesso e lembrar preferências.", sections: [
    { title: "Necessários", body: "Cookies de autenticação, segurança, tema, roteamento e funcionamento essencial podem ser usados sem desativação, pois são necessários ao serviço." },
    { title: "Preferências e medição", body: "Preferências de aparência e métricas agregadas devem respeitar a configuração de consentimento do ambiente. A lista de fornecedores e prazos deve ser mantida no inventário de cookies." },
    { title: "Controle", body: "Você pode bloquear cookies no navegador, mas isso pode encerrar a sessão ou impedir áreas autenticadas." },
  ] },
  dpa: { title: "Aditivo de Tratamento de Dados (DPA)", intro: "Modelo para contratação empresarial quando a Growdash tratar dados em nome do cliente.", sections: [
    { title: "Instruções e confidencialidade", body: "O cliente documenta finalidades, categorias de titulares e dados. A Growdash trata os dados somente para executar o serviço; pessoas autorizadas ficam sujeitas a confidencialidade." },
    { title: "Segurança e suboperadores", body: "Mantemos controles proporcionais ao risco, gestão de acesso, segregação por workspace e registro de eventos. Suboperadores devem ser listados ou comunicados ao cliente." },
    { title: "Incidentes e encerramento", body: "Incidentes relevantes serão comunicados sem demora indevida. Ao final, o cliente pode solicitar exportação; depois, dados são excluídos ou anonimizados, salvo retenção legal." },
  ] },
  sla: { title: "SLA e Política de Suporte", intro: "Os tempos abaixo devem ser ajustados ao plano comercial e confirmados no pedido.", sections: [
    { title: "Canais e classificação", body: "Solicite suporte pelo canal oficial, informando workspace, impacto, horário e evidências. Incidentes críticos, altos, normais e dúvidas devem ter prazos de primeira resposta definidos por plano." },
    { title: "Exclusões", body: "Manutenções comunicadas, falhas de provedores externos, configurações do cliente, força maior e uso fora da documentação não contam como indisponibilidade atribuível à Growdash." },
  ] },
  cancellation: { title: "Cancelamento, Reembolso e Portabilidade", intro: "As regras devem ser apresentadas antes do pagamento e respeitar o Código de Defesa do Consumidor.", sections: [
    { title: "Cancelamento", body: "O cliente pode solicitar cancelamento pelo canal da conta. Não cobramos período futuro após o cancelamento efetivo, respeitado o ciclo contratado e condições mais favoráveis previstas em lei." },
    { title: "Arrependimento e reembolso", body: "Contratações de consumidores fora do estabelecimento observam o direito de arrependimento do CDC. Pedidos e reembolsos devem ser processados pelo provedor de pagamento e registrados." },
    { title: "Exportação", body: "Antes do encerramento, o cliente pode solicitar exportação em formato razoável. Dados sujeitos a obrigação legal podem permanecer retidos e bloqueados para outras finalidades." },
  ] },
};

const links: { key: LegalKey; label: string; path: string }[] = [
  { key: "terms", label: "Termos de Uso", path: "/termos" }, { key: "privacy", label: "Privacidade e LGPD", path: "/privacidade" },
  { key: "cookies", label: "Cookies", path: "/cookies" }, { key: "dpa", label: "DPA empresarial", path: "/dpa" },
  { key: "sla", label: "SLA e suporte", path: "/sla" }, { key: "cancellation", label: "Cancelamento e reembolso", path: "/cancelamento" },
];

export default function LegalPage() {
  const { pathname } = useLocation();
  const current = links.find((item) => item.path === pathname)?.key ?? "terms";
  const document = documents[current];
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8"><div className="mx-auto max-w-5xl"><header className="flex items-center justify-between gap-4 border-b border-border pb-6"><Link to="/auth" className="flex items-center gap-3 font-black"><BrandMark /><span>Growdash</span></Link><Link to="/auth" className="text-sm font-bold text-primary hover:underline">Voltar para o acesso</Link></header><div className="grid gap-8 py-8 lg:grid-cols-[220px_1fr]"><nav aria-label="Documentos legais" className="flex gap-2 overflow-x-auto lg:block lg:space-y-2">{links.map((item) => <Link key={item.path} to={item.path} className={`block shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${item.key === current ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}>{item.label}</Link>)}</nav><article className="prose prose-sm max-w-none dark:prose-invert"><p className="text-xs font-black uppercase tracking-[.18em] text-primary">Documento público · versão 1.0 · 14/10/2026</p><h1>{document.title}</h1><p className="lead">{document.intro}</p>{document.sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}<div className="not-prose mt-10 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><b>Importante:</b> este baseline deve ser revisado por advogado brasileiro. Preencha razão social, CNPJ, endereço, canal do encarregado, suboperadores, retenções e SLA comercial.</div></article></div></div></main>;
}
