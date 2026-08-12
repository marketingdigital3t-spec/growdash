export type AnnouncementTemplate = {
  id: "welcome" | "rd-station" | "meta-connect";
  title: string;
  alt: string;
  description: string;
  targetPaths: string[];
  linkUrl: string;
  imageDataUrl: string;
};

function svgDataUrl(markup: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function visual({ eyebrow, title, copy, action, glyph }: { eyebrow: string; title: string; copy: string; action: string; glyph: string }) {
  return svgDataUrl(`<svg width="1600" height="560" viewBox="0 0 1600 560" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="surface" x1="84" y1="46" x2="1510" y2="540" gradientUnits="userSpaceOnUse"><stop stop-color="#1A1A1A"/><stop offset=".46" stop-color="#0B0B0B"/><stop offset="1" stop-color="#191919"/></linearGradient>
    <radialGradient id="shine" cx="0" cy="0" r="1" gradientTransform="translate(1330 83) rotate(143) scale(600 410)" gradientUnits="userSpaceOnUse"><stop stop-color="white" stop-opacity=".24"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="22"/></filter>
  </defs>
  <rect width="1600" height="560" rx="36" fill="url(#surface)"/>
  <rect width="1600" height="560" rx="36" fill="url(#shine)"/>
  <path d="M-50 516C300 358 451 621 781 477C1110 334 1266 464 1660 236" stroke="white" stroke-opacity=".13" stroke-width="2"/>
  <circle cx="1372" cy="207" r="150" fill="white" fill-opacity=".08" filter="url(#blur)"/>
  <rect x="72" y="68" width="270" height="42" rx="21" fill="white" fill-opacity=".1"/><text x="98" y="96" fill="white" fill-opacity=".72" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3">${eyebrow}</text>
  <text x="72" y="209" fill="white" font-family="Arial, sans-serif" font-size="62" font-weight="700">${title}</text>
  <text x="75" y="265" fill="white" fill-opacity=".68" font-family="Arial, sans-serif" font-size="26">${copy}</text>
  <rect x="72" y="347" width="260" height="70" rx="18" fill="white"/><text x="105" y="391" fill="#0B0B0B" font-family="Arial, sans-serif" font-size="22" font-weight="700">${action}</text>
  <rect x="1182" y="126" width="236" height="236" rx="56" fill="white" fill-opacity=".09" stroke="white" stroke-opacity=".25"/><text x="1253" y="278" fill="white" font-family="Arial, sans-serif" font-size="108" font-weight="700">${glyph}</text>
  <text x="72" y="502" fill="white" fill-opacity=".38" font-family="Arial, sans-serif" font-size="18" letter-spacing="2">GROWDASH · CENTRAL DE OPERAÇÕES</text>
</svg>`);
}

export const ANNOUNCEMENT_TEMPLATES: AnnouncementTemplate[] = [
  {
    id: "welcome",
    title: "Boas-vindas à Growdash",
    alt: "Banner de boas-vindas à Growdash",
    description: "Receba novos membros com um convite para explorar a plataforma.",
    targetPaths: ["*"],
    linkUrl: "/",
    imageDataUrl: visual({ eyebrow: "BEM-VINDO À GROWDASH", title: "Sua operação,\nem um só lugar.", copy: "Acompanhe resultados, prioridades e próximos passos.", action: "Abrir dashboard", glyph: "G" }),
  },
  {
    id: "rd-station",
    title: "Complete sua integração RD Station",
    alt: "Banner solicitando o preenchimento da integração RD Station",
    description: "Direciona a equipe para completar o RD Station e liberar CRM, vendas e funis.",
    targetPaths: ["/integracoes", "/crm", "/comercial", "/analise-de-funis"],
    linkUrl: "/integracoes?tab=rd",
    imageDataUrl: visual({ eyebrow: "INTEGRAÇÃO PENDENTE", title: "Conecte seu\nRD Station.", copy: "Complete a conexão para visualizar CRM, funis e vendas reais.", action: "Completar agora", glyph: "RD" }),
  },
  {
    id: "meta-connect",
    title: "Conecte sua conta de anúncios",
    alt: "Banner para conectar uma conta Meta Ads",
    description: "Leva o usuário para a integração de tráfego pago.",
    targetPaths: ["/", "/campanhas", "/integracoes"],
    linkUrl: "/integracoes?tab=paid",
    imageDataUrl: visual({ eyebrow: "DADOS DE TRÁFEGO", title: "Conecte suas\ncontas de anúncio.", copy: "Traga investimento, campanhas e resultados para a Growdash.", action: "Conectar conta", glyph: "M" }),
  },
];
