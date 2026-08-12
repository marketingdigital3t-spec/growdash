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

function visual({ eyebrow, title, copy, action, glyph, stat, sequence }: { eyebrow: string; title: [string, string]; copy: string; action: string; glyph: string; stat: string; sequence: string[] }) {
  // Native SVG keeps the ready-to-use creative crisp on any screen, instead
  // of relying on a generic raster stock image. It deliberately follows the
  // platform's monochrome/glass direction so every preset feels like a real
  // Growdash campaign, not a placeholder.
  return svgDataUrl(`<svg width="1600" height="560" viewBox="0 0 1600 560" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1600" y2="560" gradientUnits="userSpaceOnUse"><stop stop-color="#050505"/><stop offset=".48" stop-color="#141414"/><stop offset="1" stop-color="#080808"/></linearGradient>
    <linearGradient id="glass" x1="1000" y1="80" x2="1450" y2="460" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF" stop-opacity=".18"/><stop offset="1" stop-color="#FFF" stop-opacity=".025"/></linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientTransform="translate(1260 208) rotate(130) scale(480 430)" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF" stop-opacity=".2"/><stop offset="1" stop-color="#FFF" stop-opacity="0"/></radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="42"/></filter>
    <filter id="shadow"><feDropShadow dx="0" dy="22" stdDeviation="22" flood-opacity=".4"/></filter>
  </defs>
  <rect width="1600" height="560" rx="38" fill="url(#bg)"/>
  <rect x="1" y="1" width="1598" height="558" rx="37" stroke="#FFF" stroke-opacity=".16" stroke-width="2"/>
  <circle cx="1290" cy="172" r="188" fill="#FFF" fill-opacity=".11" filter="url(#blur)"/><rect width="1600" height="560" rx="38" fill="url(#glow)"/>
  <path d="M-28 465C245 350 397 514 650 438C928 355 1051 507 1634 274" stroke="#FFF" stroke-opacity=".12"/><path d="M-28 480C245 365 397 529 650 453C928 370 1051 522 1634 289" stroke="#FFF" stroke-opacity=".05"/>
  <g opacity=".5"><circle cx="1034" cy="109" r="3" fill="#FFF"/><circle cx="1100" cy="145" r="2" fill="#FFF"/><circle cx="1182" cy="100" r="2" fill="#FFF"/><path d="M1034 109L1100 145L1182 100" stroke="#FFF" stroke-opacity=".42"/></g>
  <rect x="72" y="66" width="318" height="38" rx="19" fill="#FFF" fill-opacity=".09" stroke="#FFF" stroke-opacity=".15"/><circle cx="96" cy="85" r="5" fill="#FFF"/><text x="113" y="91" fill="#FFF" fill-opacity=".78" font-family="Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="2.5">${eyebrow}</text>
  <text x="72" y="197" fill="#FFF" font-family="Arial, sans-serif" font-size="64" font-weight="700" letter-spacing="-2">${title[0]}</text><text x="72" y="267" fill="#FFF" fill-opacity=".62" font-family="Arial, sans-serif" font-size="64" font-weight="700" letter-spacing="-2">${title[1]}</text>
  <text x="75" y="319" fill="#FFF" fill-opacity=".6" font-family="Arial, sans-serif" font-size="23">${copy}</text>
  <g filter="url(#shadow)"><rect x="72" y="365" width="274" height="66" rx="18" fill="#FFF"/><text x="101" y="407" fill="#080808" font-family="Arial, sans-serif" font-size="19" font-weight="700">${action}</text><path d="M304 389h-24m24 0-9-9m9 9-9 9" stroke="#080808" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>
  <text x="72" y="503" fill="#FFF" fill-opacity=".36" font-family="Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="2.6">GROWDASH  /  PERFORMANCE INTELLIGENCE</text>
  <g filter="url(#shadow)"><rect x="1015" y="73" width="426" height="410" rx="32" fill="url(#glass)" stroke="#FFF" stroke-opacity=".25"/><rect x="1037" y="95" width="382" height="52" rx="17" fill="#050505" fill-opacity=".42"/><circle cx="1063" cy="121" r="10" fill="#FFF"/><text x="1084" y="126" fill="#FFF" font-family="Arial, sans-serif" font-size="14" font-weight="700">${stat}</text><text x="1376" y="126" fill="#FFF" fill-opacity=".46" font-family="Arial, sans-serif" font-size="12">AO VIVO</text>
  <rect x="1037" y="169" width="382" height="170" rx="22" fill="#000" fill-opacity=".26" stroke="#FFF" stroke-opacity=".1"/><circle cx="1228" cy="254" r="61" stroke="#FFF" stroke-opacity=".18" stroke-width="16"/><path d="M1228 193a61 61 0 1 1-56 85" stroke="#FFF" stroke-width="16" stroke-linecap="round"/><text x="1192" y="265" fill="#FFF" font-family="Arial, sans-serif" font-size="56" font-weight="700">${glyph}</text>
  ${sequence.map((item, index) => `<g><rect x="1037" y="${365 + index * 31}" width="382" height="1" fill="#FFF" fill-opacity=".11"/><circle cx="1054" cy="${382 + index * 31}" r="4" fill="#FFF" fill-opacity="${.8 - index * .15}"/><text x="1072" y="${387 + index * 31}" fill="#FFF" fill-opacity=".67" font-family="Arial, sans-serif" font-size="13">${item}</text></g>`).join("")}</g>
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
    imageDataUrl: visual({ eyebrow: "BEM-VINDO À GROWDASH", title: ["Sua operação.", "Uma visão clara."], copy: "Resultados, prioridades e decisões no mesmo painel.", action: "Abrir dashboard", glyph: "G", stat: "CENTRAL DE CONTROLE", sequence: ["Visão total da operação", "Alertas que pedem ação", "Decisões com contexto"] }),
  },
  {
    id: "rd-station",
    title: "Complete sua integração RD Station",
    alt: "Banner solicitando o preenchimento da integração RD Station",
    description: "Direciona a equipe para completar o RD Station e liberar CRM, vendas e funis.",
    targetPaths: ["/integracoes", "/crm", "/comercial", "/analise-de-funis"],
    linkUrl: "/integracoes?tab=rd",
    imageDataUrl: visual({ eyebrow: "INTEGRAÇÃO PENDENTE", title: ["Seu CRM com", "dados reais."], copy: "Conecte o RD e acompanhe cada venda até o resultado.", action: "Completar conexão", glyph: "RD", stat: "RD STATION", sequence: ["Funis e etapas sincronizados", "Negócios com valor real", "Receita reconciliada"] }),
  },
  {
    id: "meta-connect",
    title: "Conecte sua conta de anúncios",
    alt: "Banner para conectar uma conta Meta Ads",
    description: "Leva o usuário para a integração de tráfego pago.",
    targetPaths: ["/", "/campanhas", "/integracoes"],
    linkUrl: "/integracoes?tab=paid",
    imageDataUrl: visual({ eyebrow: "DADOS DE TRÁFEGO", title: ["Toda campanha.", "Nenhum ponto cego."], copy: "Traga investimento, resultados e criativos para a Growdash.", action: "Conectar conta", glyph: "M", stat: "META ADS", sequence: ["Contas autorizadas", "Campanhas monitoradas", "Resultados por criativo"] }),
  },
];
