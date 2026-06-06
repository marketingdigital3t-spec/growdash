export type WhatsAppChatType = "group" | "contact";
export type WhatsAppConnectionStatus = "disconnected" | "qr_pending" | "connected";

export interface WhatsAppChat {
  id: string;
  name: string;
  type: WhatsAppChatType;
  participants?: number;
  phone?: string;
}

export interface WhatsAppConnectionState {
  status: WhatsAppConnectionStatus;
  phone: string;
  connectedAt: string | null;
  selectedChatId: string;
  chats: WhatsAppChat[];
}

const STORAGE_KEY = "growdash:whatsapp-connection";
export const WHATSAPP_EVENT_KEY = "growdash:whatsapp-connection-updated";

const seedChats: WhatsAppChat[] = [
  { id: "group-growth-team", name: "Time Comercial Growdash", type: "group", participants: 12 },
  { id: "group-leads-daily", name: "Relatorio Diario de Leads", type: "group", participants: 8 },
  { id: "group-gestores", name: "Gestores de Trafego e Vendas", type: "group", participants: 5 },
  { id: "contact-thiego", name: "Thiego Jesus", type: "contact", phone: "5511961551975" },
];

export const defaultWhatsAppState: WhatsAppConnectionState = {
  status: "disconnected",
  phone: "",
  connectedAt: null,
  selectedChatId: "",
  chats: seedChats,
};

export function readWhatsAppConnection(): WhatsAppConnectionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWhatsAppState;
    return { ...defaultWhatsAppState, ...JSON.parse(raw) };
  } catch {
    return defaultWhatsAppState;
  }
}

export function saveWhatsAppConnection(next: WhatsAppConnectionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(WHATSAPP_EVENT_KEY, { detail: next }));
  } catch {}
}

export function selectedWhatsAppChat(state: WhatsAppConnectionState) {
  return state.chats.find((chat) => chat.id === state.selectedChatId) || null;
}
