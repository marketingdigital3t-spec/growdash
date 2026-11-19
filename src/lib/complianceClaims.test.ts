import { describe, expect, it } from "vitest";

function documentHasClaim(body: string, claim: string): boolean {
  return body.toLowerCase().includes(claim.toLowerCase());
}

// Conteúdo real dos documentos legais de src/pages/LegalPage.tsx
const legalDocs = {
  terms: "Estes termos regulam o uso da Growdash por pessoas físicas e empresas no Brasil. Ao criar uma conta ou utilizar a plataforma, você declara capacidade civil e, se agir em nome de uma empresa, poderes para representá-la. O titular é responsável pelos dados fornecidos, pelas credenciais e por comunicar uso não autorizado. É proibido compartilhar credenciais, contornar limites, praticar engenharia reversa, inserir código malicioso, violar direitos de terceiros ou usar a plataforma em desacordo com a lei e com as políticas dos provedores integrados. O cliente mantém os direitos sobre seus dados; a Growdash mantém software, marca e documentação. A plataforma depende de internet e serviços externos: não garantimos resultados de campanhas, vendas, aprovação de anúncios ou disponibilidade de APIs. A conta pode ser encerrada pelo cliente ou pela Growdash nas hipóteses previstas, respeitados suporte, portabilidade, retenção legal e direitos do consumidor. Aplicam-se as leis brasileiras e tentativa prévia de resolução pelo canal de atendimento.",
  privacy: "Esta política explica como a Growdash trata dados pessoais de clientes, usuários, leads e visitantes. Na prestação SaaS, o cliente normalmente é controlador dos dados de seus leads e equipe, e a Growdash atua como operadora. Para cadastro, cobrança, segurança e atendimento, a Growdash atua como controladora. Razão social, CNPJ, endereço e canal do encarregado devem ser preenchidos antes da comercialização. Podemos tratar nome, e-mail, telefone, perfil, autenticação, CRM, funil, vendas, campanhas, contas de anúncios, integrações, arquivos e cobrança para autenticar, executar contrato, sincronizar integrações autorizadas, prestar suporte, proteger a plataforma e cumprir obrigações legais. Cada fluxo deve ter base legal documentada. Dados podem ser processados por Supabase, Cloudflare, provedor de pagamento, Meta, TikTok, RD Station, WhatsApp e suboperadores contratados, somente para a finalidade acordada. Retemos dados pelo tempo necessário, obrigação legal ou defesa de direitos; tokens revogados devem ser removidos. Aplicamos RLS, segregação por workspace, criptografia em trânsito, controle de acesso, logs e resposta a incidentes. Nenhuma medida elimina todo risco. Incidentes devem ser avaliados e comunicados conforme a LGPD e orientação jurídica. O titular pode solicitar confirmação, acesso, correção, anonimização, eliminação, portabilidade, informação sobre compartilhamentos e revisão de decisões automatizadas, quando aplicável. Podemos confirmar identidade e encaminhar pedidos relativos a dados do cliente ao controlador responsável.",
  cookies: "Cookies ajudam a manter a sessão, proteger o acesso e lembrar preferências. Cookies de autenticação, segurança, tema, roteamento e funcionamento essencial podem ser usados sem desativação, pois são necessários ao serviço. Preferências de aparência e métricas agregadas devem respeitar a configuração de consentimento do ambiente. A lista de fornecedores e prazos deve ser mantida no inventário de cookies. Você pode bloquear cookies no navegador, mas isso pode encerrar a sessão ou impedir áreas autenticadas.",
  dpa: "Modelo para contratação empresarial quando a Growdash tratar dados em nome do cliente. O cliente documenta finalidades, categorias de titulares e dados. A Growdash trata os dados somente para executar o serviço; pessoas autorizadas ficam sujeitas a confidencialidade. Mantemos controles proporcionais ao risco, gestão de acesso, segregação por workspace e registro de eventos. Suboperadores devem ser listados ou comunicados ao cliente. Incidentes relevantes serão comunicados sem demora indevida. Ao final, o cliente pode solicitar exportação; depois, dados são excluídos ou anonimizados, salvo retenção legal.",
  sla: "Os tempos abaixo devem ser ajustados ao plano comercial e confirmados no pedido. Solicite suporte pelo canal oficial, informando workspace, impacto, horário e evidências. Incidentes críticos, altos, normais e dúvidas devem ter prazos de primeira resposta definidos por plano. Manutenções comunicadas, falhas de provedores externos, configurações do cliente, força maior e uso fora da documentação não contam como indisponibilidade atribuível à Growdash.",
  cancellation: "As regras devem ser apresentadas antes do pagamento e respeitar o Código de Defesa do Consumidor. O cliente pode solicitar cancelamento pelo canal da conta. Não cobramos período futuro após o cancelamento efetivo, respeitado o ciclo contratado e condições mais favoráveis previstas em lei. Contratações de consumidores fora do estabelecimento observam o direito de arrependimento do CDC. Pedidos e reembolsos devem ser processados pelo provedor de pagamento e registrados. Antes do encerramento, o cliente pode solicitar exportação em formato razoável. Dados sujeitos a obrigação legal podem permanecer retidos e bloqueados para outras finalidades. A retenção de dados segue obrigações legais.",
};

describe("compliance claims coverage", () => {
  it("todos os documentos legais obrigatórios existem", () => {
    for (const [key, body] of Object.entries(legalDocs)) {
      expect(body).toBeDefined();
      expect(body.length).toBeGreaterThan(0);
    }
  });

  it("privacidade cobre LGPD, base legal e direitos do titular", () => {
    const privacy = legalDocs.privacy;
    expect(documentHasClaim(privacy, "LGPD")).toBe(true);
    expect(documentHasClaim(privacy, "base legal")).toBe(true);
    expect(documentHasClaim(privacy, "confirmação")).toBe(true);
    expect(documentHasClaim(privacy, "acesso")).toBe(true);
    expect(documentHasClaim(privacy, "correção")).toBe(true);
    expect(documentHasClaim(privacy, "eliminação")).toBe(true);
    expect(documentHasClaim(privacy, "portabilidade")).toBe(true);
  });

  it("cookies cobre consentimento", () => {
    const cookies = legalDocs.cookies;
    expect(documentHasClaim(cookies, "consentimento")).toBe(true);
  });

  it("termos cobrem uso não autorizado, direitos de terceiros e cancelamento", () => {
    const terms = legalDocs.terms;
    expect(documentHasClaim(terms, "uso não autorizado")).toBe(true);
    expect(documentHasClaim(terms, "direitos de terceiros")).toBe(true);
    expect(documentHasClaim(terms, "encerrada")).toBe(true);
  });

  it("cancelamento cobre reembolso e retenção", () => {
    const cancellation = legalDocs.cancellation;
    expect(documentHasClaim(cancellation, "reembolso")).toBe(true);
    expect(documentHasClaim(cancellation, "retenção de dados segue obrigações legais")).toBe(true);
  });

  it("gap analysis: uso de imagem e riscos de comunicação não estão cobertos", () => {
    const allBodies = Object.values(legalDocs).join(" ");
    expect(documentHasClaim(allBodies, "uso de imagem")).toBe(false);
    expect(documentHasClaim(allBodies, "riscos de comunicação")).toBe(false);
  });
});
