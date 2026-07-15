import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { toPng } from "html-to-image";
import { 
  Monitor, MousePointerClick, UserPlus, ShoppingCart, 
  BarChart3, Layout, Target, Users, DollarSign,
  ZoomIn, ZoomOut, Maximize2, Move, Pencil, Check,
  Plus, ArrowLeft, Save, Trash2, Clock, GitBranch, Copy, Download,
  Eye, TrendingUp, Percent, MousePointer, Mail,
  CreditCard, Star, Megaphone, GripVertical, PanelLeftClose, PanelLeft, Layers,
  Link2, FileText, RefreshCw, Calendar, Hand, MousePointer2, Redo2, Undo2, Waypoints
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useFunnels, useCreateFunnel, useUpdateFunnel, useDeleteFunnel, type FunnelRecord } from "@/hooks/useFunnels";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useInsights } from "@/hooks/useInsights";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GrowdashFlowCanvas } from "@/components/GrowdashFlow/GrowdashFlowCanvas";
import type { DrawElement, FlowData } from "@/components/GrowdashFlow/types";

/* ─── Types ─── */
interface FunnelNode {
  id: string;
  label: string;
  value: number;
  change: number;
  description: string;
  icon: string;
  x: number;
  y: number;
  color: string;
  iconBg: string;
  dataSource?: "auto" | "manual";
  metricKey?: string;
}

interface FunnelConnection {
  from: string;
  to: string;
}

interface DragLineState {
  fromNodeId: string;
  end: "from" | "to";
  connectionIndex: number;
  mouseX: number;
  mouseY: number;
  snapTargetId: string | null;
}

type CanvasTool = "select" | "hand" | "connect";
type CanvasSnapshot = { nodes: FunnelNode[]; connections: FunnelConnection[] };

/* ─── Icon Map ─── */
const ICON_MAP: Record<string, React.ElementType> = {
  Monitor, MousePointerClick, UserPlus, ShoppingCart,
  BarChart3, Layout, Target, Users, DollarSign,
  Eye, TrendingUp, Percent, MousePointer, Mail,
  CreditCard, Star, Megaphone, Layers,
};

function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] || Layout;
}

/* ─── Block Templates ─── */
interface BlockTemplate {
  label: string;
  icon: string;
  color: string;
  iconBg: string;
  category: string;
  dataSource?: "auto" | "manual";
  metricKey?: string;
}

const BLOCK_TEMPLATES: BlockTemplate[] = [
  { label: "Pageviews", icon: "Eye", color: "hsl(221, 83%, 53%)", iconBg: "hsl(221, 83%, 95%)", category: "Tráfego", dataSource: "auto", metricKey: "impressions" },
  { label: "Impressões", icon: "Monitor", color: "hsl(221, 83%, 53%)", iconBg: "hsl(221, 83%, 95%)", category: "Tráfego", dataSource: "auto", metricKey: "impressions" },
  { label: "Cliques", icon: "MousePointerClick", color: "hsl(152, 60%, 45%)", iconBg: "hsl(152, 60%, 95%)", category: "Tráfego", dataSource: "auto", metricKey: "clicks" },
  { label: "CTR", icon: "Percent", color: "hsl(38, 85%, 55%)", iconBg: "hsl(38, 85%, 95%)", category: "Métricas", dataSource: "auto", metricKey: "ctr" },
  { label: "CPM", icon: "DollarSign", color: "hsl(38, 85%, 55%)", iconBg: "hsl(38, 85%, 95%)", category: "Métricas", dataSource: "auto", metricKey: "cpm" },
  { label: "CPL", icon: "DollarSign", color: "hsl(0, 72%, 55%)", iconBg: "hsl(0, 72%, 95%)", category: "Métricas", dataSource: "auto", metricKey: "cpl" },
  { label: "CPA", icon: "DollarSign", color: "hsl(0, 72%, 55%)", iconBg: "hsl(0, 72%, 95%)", category: "Métricas", dataSource: "manual", metricKey: "cpa" },
  { label: "Conversão", icon: "TrendingUp", color: "hsl(152, 60%, 45%)", iconBg: "hsl(152, 60%, 95%)", category: "Métricas", dataSource: "auto", metricKey: "conversion_rate" },
  { label: "Cadastro", icon: "UserPlus", color: "hsl(38, 85%, 55%)", iconBg: "hsl(38, 85%, 95%)", category: "Conversão", dataSource: "manual" },
  { label: "Leads", icon: "Users", color: "hsl(152, 60%, 45%)", iconBg: "hsl(152, 60%, 95%)", category: "Conversão", dataSource: "auto", metricKey: "leads" },
  { label: "Vendas", icon: "ShoppingCart", color: "hsl(152, 60%, 45%)", iconBg: "hsl(152, 60%, 95%)", category: "Conversão", dataSource: "manual" },
  { label: "Receita", icon: "CreditCard", color: "hsl(152, 60%, 45%)", iconBg: "hsl(152, 60%, 95%)", category: "Conversão", dataSource: "manual" },
  { label: "Investimento", icon: "DollarSign", color: "hsl(221, 83%, 53%)", iconBg: "hsl(221, 83%, 95%)", category: "Métricas", dataSource: "auto", metricKey: "spend" },
  { label: "Alcance", icon: "Users", color: "hsl(221, 83%, 53%)", iconBg: "hsl(221, 83%, 95%)", category: "Tráfego", dataSource: "auto", metricKey: "reach" },
  { label: "Frequência", icon: "BarChart3", color: "hsl(38, 85%, 55%)", iconBg: "hsl(38, 85%, 95%)", category: "Métricas", dataSource: "auto", metricKey: "frequency" },
  { label: "Vídeo 25%", icon: "Monitor", color: "hsl(0, 72%, 55%)", iconBg: "hsl(0, 72%, 95%)", category: "Engajamento", dataSource: "manual" },
  { label: "Vídeo 50%", icon: "Monitor", color: "hsl(0, 72%, 55%)", iconBg: "hsl(0, 72%, 95%)", category: "Engajamento", dataSource: "manual" },
  { label: "Vídeo 75%", icon: "Monitor", color: "hsl(0, 72%, 55%)", iconBg: "hsl(0, 72%, 95%)", category: "Engajamento", dataSource: "manual" },
  { label: "Vídeo 100%", icon: "Monitor", color: "hsl(0, 72%, 55%)", iconBg: "hsl(0, 72%, 95%)", category: "Engajamento", dataSource: "manual" },
  { label: "CTA Principal", icon: "MousePointerClick", color: "hsl(152, 60%, 45%)", iconBg: "hsl(152, 60%, 95%)", category: "Engajamento", dataSource: "manual" },
  { label: "E-mail", icon: "Mail", color: "hsl(221, 83%, 53%)", iconBg: "hsl(221, 83%, 95%)", category: "Canais", dataSource: "manual" },
  { label: "Campanha", icon: "Megaphone", color: "hsl(262, 83%, 58%)", iconBg: "hsl(262, 83%, 95%)", category: "Canais", dataSource: "manual" },
  { label: "Página de Vendas", icon: "Layout", color: "hsl(221, 83%, 53%)", iconBg: "hsl(221, 83%, 95%)", category: "Páginas", dataSource: "manual" },
  { label: "Checkout", icon: "CreditCard", color: "hsl(152, 60%, 45%)", iconBg: "hsl(152, 60%, 95%)", category: "Páginas", dataSource: "manual" },
  { label: "Preços", icon: "DollarSign", color: "hsl(221, 83%, 53%)", iconBg: "hsl(221, 83%, 95%)", category: "Páginas", dataSource: "manual" },
  { label: "Painel", icon: "BarChart3", color: "hsl(221, 83%, 53%)", iconBg: "hsl(221, 83%, 95%)", category: "Páginas", dataSource: "manual" },
  { label: "Serviço", icon: "Target", color: "hsl(38, 85%, 55%)", iconBg: "hsl(38, 85%, 95%)", category: "Outros", dataSource: "manual" },
  { label: "Consultoria", icon: "Star", color: "hsl(38, 85%, 55%)", iconBg: "hsl(38, 85%, 95%)", category: "Outros", dataSource: "manual" },
];

const TEMPLATE_CATEGORIES = [...new Set(BLOCK_TEMPLATES.map((t) => t.category))];

const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOR_OPTIONS = [
  { label: "Azul", value: "hsl(221, 83%, 53%)", bg: "hsl(221, 83%, 95%)" },
  { label: "Verde", value: "hsl(152, 60%, 45%)", bg: "hsl(152, 60%, 95%)" },
  { label: "Laranja", value: "hsl(38, 85%, 55%)", bg: "hsl(38, 85%, 95%)" },
  { label: "Vermelho", value: "hsl(0, 72%, 55%)", bg: "hsl(0, 72%, 95%)" },
  { label: "Roxo", value: "hsl(262, 83%, 58%)", bg: "hsl(262, 83%, 95%)" },
];

function createNodeFromTemplate(template: BlockTemplate, x: number, y: number): FunnelNode {
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: template.label,
    value: 0,
    change: 0,
    description: "",
    icon: template.icon,
    x, y,
    color: template.color,
    iconBg: template.iconBg,
    dataSource: template.dataSource || "manual",
    metricKey: template.metricKey,
  };
}

const NODE_W = 140;
const NODE_H = 180;
const SNAP_DISTANCE = 60;

function getNodeCenter(node: FunnelNode) {
  return { cx: node.x + NODE_W / 2, cy: node.y + NODE_H / 2 };
}

function getClosestEdgePoint(node: FunnelNode, px: number, py: number) {
  const cx = node.x + NODE_W / 2;
  const cy = node.y + NODE_H / 2;
  const dx = px - cx;
  const dy = py - cy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx / NODE_W > absDy / NODE_H) {
    return dx > 0 ? { x: node.x + NODE_W, y: cy } : { x: node.x, y: cy };
  } else {
    return dy > 0 ? { x: cx, y: node.y + NODE_H } : { x: cx, y: node.y };
  }
}

function buildCurveFromPoints(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const cp1x = ax + dx * 0.5;
  const cp1y = ay;
  const cp2x = bx - dx * 0.5;
  const cp2y = by;
  return `M ${ax} ${ay} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${bx} ${by}`;
}

function buildCurvePath(from: FunnelNode, to: FunnelNode) {
  const ac = getNodeCenter(from);
  const bc = getNodeCenter(to);
  const a = getClosestEdgePoint(from, bc.cx, bc.cy);
  const b = getClosestEdgePoint(to, ac.cx, ac.cy);
  return buildCurveFromPoints(a.x, a.y, b.x, b.y);
}

function ChangeIndicator({ change }: { change: number }) {
  const isPositive = change > 0;
  const isNeutral = change === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold rounded px-1.5 py-0.5 ${
        isNeutral
          ? "bg-muted text-muted-foreground"
          : isPositive
          ? "bg-emerald-500/15 text-emerald-600"
          : "bg-destructive/15 text-destructive"
      }`}
    >
      {isNeutral ? "0%" : `${isPositive ? "▲" : "▼"} ${Math.abs(change)}%`}
    </span>
  );
}

/* ─── Create Funnel Dialog ─── */
function CreateFunnelDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (funnel: FunnelRecord) => void;
}) {
  const [step, setStep] = useState<"type" | "account" | "campaigns">("type");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [funnelName, setFunnelName] = useState("Novo Funil");
  
  const { data: adAccounts = [], isLoading: loadingAccounts } = useAdAccounts();
  const { data: campaigns = [], isLoading: loadingCampaigns } = useCampaigns(
    selectedAccountId ? adAccounts.find(a => a.id === selectedAccountId)?.id : undefined
  );
  const createFunnel = useCreateFunnel();
  const { toast } = useToast();

  const reset = () => {
    setStep("type");
    setSelectedAccountId(null);
    setSelectedCampaignIds([]);
    setFunnelName("Novo Funil");
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleCreateBlank = async () => {
    try {
      const result = await createFunnel.mutateAsync({
        name: funnelName,
        nodes: [],
        connections: [],
        funnel_type: "blank",
      });
      toast({ title: "Funil criado!" });
      reset();
      onOpenChange(false);
      onCreated(result);
    } catch {
      toast({ title: "Erro ao criar funil", variant: "destructive" });
    }
  };

  const handleCreateTemplate = async (template: "sales" | "lead") => {
    const labels = template === "sales"
      ? ["Impressões", "Cliques", "Leads", "Vendas", "Receita"]
      : ["Cadastro", "Leads", "E-mail", "Consultoria", "Vendas"];
    const nodes = labels.map((label, index) => {
      const block = BLOCK_TEMPLATES.find((item) => item.label === label) ?? BLOCK_TEMPLATES[0];
      return createNodeFromTemplate(block, 80 + index * 210, 220);
    });
    const connections = nodes.slice(0, -1).map((node, index) => ({ from: node.id, to: nodes[index + 1].id }));
    try {
      const result = await createFunnel.mutateAsync({
        name: funnelName === "Novo Funil" ? (template === "sales" ? "Funil de vendas" : "Acompanhamento de leads") : funnelName,
        nodes,
        connections,
        funnel_type: "blank",
      });
      toast({ title: "Modelo criado e pronto para editar" });
      reset();
      onOpenChange(false);
      onCreated(result);
    } catch {
      toast({ title: "Erro ao criar o modelo", variant: "destructive" });
    }
  };

  const handleCreateLinked = async () => {
    if (!selectedAccountId || selectedCampaignIds.length === 0) return;
    try {
      const result = await createFunnel.mutateAsync({
        name: funnelName,
        nodes: [],
        connections: [],
        funnel_type: "linked",
        ad_account_id: selectedAccountId,
        campaign_ids: selectedCampaignIds,
      });
      toast({ title: "Funil vinculado criado!" });
      reset();
      onOpenChange(false);
      onCreated(result);
    } catch {
      toast({ title: "Erro ao criar funil", variant: "destructive" });
    }
  };

  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectedAccount = adAccounts.find(a => a.id === selectedAccountId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "type" && "Criar Novo Funil"}
            {step === "account" && "Selecionar Conta de Anúncios"}
            {step === "campaigns" && "Selecionar Campanhas"}
          </DialogTitle>
          <DialogDescription>
            {step === "type" && "Escolha o tipo de funil que deseja criar"}
            {step === "account" && "Selecione a conta de anúncios para vincular"}
            {step === "campaigns" && `Selecione as campanhas de ${selectedAccount?.name || "..."}`}
          </DialogDescription>
        </DialogHeader>

        {step === "type" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do funil</Label>
              <Input value={funnelName} onChange={e => setFunnelName(e.target.value)} placeholder="Nome do funil" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={handleCreateBlank}
                disabled={createFunnel.isPending}
                className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-center group"
              >
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <FileText className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Em Branco</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Planejamento e projeções</p>
                </div>
              </button>
              <button
                onClick={() => setStep("account")}
                className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-center group"
              >
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Link2 className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Vincular Conta</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Análise com dados reais</p>
                </div>
              </button>
              <button
                onClick={() => handleCreateTemplate("sales")}
                disabled={createFunnel.isPending}
                className="group flex flex-col items-center gap-3 rounded-lg border-2 border-border p-5 text-center transition-all hover:border-primary/50 hover:bg-accent/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                  <TrendingUp className="h-6 w-6 text-emerald-500" />
                </div>
                <div><p className="text-sm font-semibold">Funil de vendas</p><p className="mt-0.5 text-xs text-muted-foreground">Aquisição até receita</p></div>
              </button>
              <button
                onClick={() => handleCreateTemplate("lead")}
                disabled={createFunnel.isPending}
                className="group flex flex-col items-center gap-3 rounded-lg border-2 border-border p-5 text-center transition-all hover:border-primary/50 hover:bg-accent/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                  <Users className="h-6 w-6 text-amber-500" />
                </div>
                <div><p className="text-sm font-semibold">Acompanhar leads</p><p className="mt-0.5 text-xs text-muted-foreground">Captação até fechamento</p></div>
              </button>
            </div>
          </div>
        )}

        {step === "account" && (
          <div className="space-y-3 py-2">
            {loadingAccounts ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : adAccounts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Nenhuma conta de anúncios encontrada.</p>
                <p className="text-xs text-muted-foreground mt-1">Adicione uma conta nas Configurações.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {adAccounts.map(account => (
                  <button
                    key={account.id}
                    onClick={() => { setSelectedAccountId(account.id); setStep("campaigns"); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left hover:border-primary/50 hover:bg-accent/30 ${
                      selectedAccountId === account.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Megaphone className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.account_id}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setStep("type")}>Voltar</Button>
            </DialogFooter>
          </div>
        )}

        {step === "campaigns" && (
          <div className="space-y-3 py-2">
            {loadingCampaigns ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada nesta conta.</p>
                <p className="text-xs text-muted-foreground mt-1">Sincronize os dados primeiro.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {campaigns.map(campaign => (
                  <label
                    key={campaign.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all hover:bg-accent/30 ${
                      selectedCampaignIds.includes(campaign.id) ? "border-primary/50 bg-primary/5" : "border-border"
                    }`}
                  >
                    <Checkbox
                      checked={selectedCampaignIds.includes(campaign.id)}
                      onCheckedChange={() => toggleCampaign(campaign.id)}
                    />
                    <span className="text-sm truncate">{campaign.name}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              {selectedCampaignIds.length} campanha(s) selecionada(s)
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => { setStep("account"); setSelectedCampaignIds([]); }}>Voltar</Button>
              <Button size="sm" onClick={handleCreateLinked} disabled={selectedCampaignIds.length === 0 || createFunnel.isPending}>
                {createFunnel.isPending ? "Criando..." : "Criar Funil Vinculado"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Funnel Listing ─── */
function FunnelListing({ onSelect, onCreate }: { onSelect: (id: string) => void; onCreate: () => void }) {
  const { data: funnels = [], isLoading } = useFunnels();
  const { data: adAccounts = [] } = useAdAccounts();
  const deleteFunnel = useDeleteFunnel();
  const createFunnel = useCreateFunnel();
  const { toast } = useToast();

  const handleDelete = (id: string) => {
    deleteFunnel.mutate(id, {
      onSuccess: () => toast({ title: "Funil excluído" }),
    });
  };

  const handleDuplicate = (funnel: typeof funnels[0]) => {
    createFunnel.mutate(
      {
        name: `${funnel.name} (cópia)`,
        nodes: funnel.nodes as any[],
        connections: funnel.connections as any[],
        funnel_type: funnel.funnel_type as "blank" | "linked",
        ad_account_id: funnel.ad_account_id,
        campaign_ids: funnel.campaign_ids as string[],
      },
      { onSuccess: () => toast({ title: "Funil duplicado com sucesso!" }) },
    );
  };

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return null;
    return adAccounts.find(a => a.id === accountId)?.name || null;
  };

  return (
    <MotionPage className="space-y-6">
      <MotionItem>
        <div className="gd-panel overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Canvas operacional</span>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">Growdash Flow</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Quadro visual inspirado no Excalidraw para desenhar fluxogramas, funis de vendas e jornadas de acompanhamento de leads.
              </p>
            </div>
            <Button onClick={onCreate} className="gap-2"><Plus className="h-4 w-4" />Novo quadro</Button>
          </div>
        </div>
      </MotionItem>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-5 bg-muted rounded w-2/3 mb-3" />
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-1/3" />
            </Card>
          ))}
        </div>
      ) : funnels.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <GitBranch className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-1">Nenhum funil criado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Crie seu primeiro funil para começar a mapear seu fluxo de conversão
          </p>
          <Button onClick={onCreate} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Criar Primeiro Funil
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {funnels.map((funnel) => {
            const nodeCount = Array.isArray(funnel.nodes) ? funnel.nodes.length : 0;
            const connCount = Array.isArray(funnel.connections) ? funnel.connections.length : 0;
            const isLinked = funnel.funnel_type === "linked";
            const accountName = getAccountName(funnel.ad_account_id);
            return (
              <Card
                key={funnel.id}
                className="p-5 hover:shadow-lg transition-all duration-200 cursor-pointer group border-border/60 hover:border-primary/30"
                onClick={() => onSelect(funnel.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isLinked ? "bg-emerald-500/10" : "bg-primary/10"}`}>
                      {isLinked ? <Link2 className="h-4.5 w-4.5 text-emerald-600" /> : <GitBranch className="h-4.5 w-4.5 text-primary" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                        {funnel.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(funnel.updated_at), { addSuffix: true, locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(funnel); }}
                      title="Duplicar funil"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir funil</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir "{funnel.name}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(funnel.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={isLinked ? "default" : "secondary"} className={`text-[10px] ${isLinked ? "bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20" : ""}`}>
                    {isLinked ? "Vinculado" : "Planejamento"}
                  </Badge>
                  {accountName && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{accountName}</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">{nodeCount} nós • {connCount} conexões</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </MotionPage>
  );
}

/* ─── Canvas Editor ─── */
function FunnelCanvas({ funnelId, initialNodes, initialConnections, initialName, onBack, funnelType, adAccountId, campaignIds }: {
  funnelId: string | null;
  initialNodes: FunnelNode[];
  initialConnections: FunnelConnection[];
  initialName: string;
  onBack: () => void;
  funnelType: "blank" | "linked";
  adAccountId?: string | null;
  campaignIds?: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [nodes, setNodes] = useState(initialNodes);
  const [connections, setConnections] = useState(initialConnections);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragLine, setDragLine] = useState<DragLineState | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredConnIndex, setHoveredConnIndex] = useState<number | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [funnelName, setFunnelName] = useState(initialName);
  const [editingName, setEditingName] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [customBlockOpen, setCustomBlockOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customIcon, setCustomIcon] = useState("Layout");
  const [customColor, setCustomColor] = useState(COLOR_OPTIONS[0].value);
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify({ nodes: initialNodes, connections: initialConnections, name: initialName }));
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const dragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });
  const historyRef = useRef<CanvasSnapshot[]>([{ nodes: structuredClone(initialNodes), connections: structuredClone(initialConnections) }]);
  const historyIndexRef = useRef(0);
  const applyingHistoryRef = useRef(false);

  useEffect(() => {
    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const next = { nodes: structuredClone(nodes), connections: structuredClone(connections) };
      const current = historyRef.current[historyIndexRef.current];
      if (JSON.stringify(current) === JSON.stringify(next)) return;
      historyRef.current = [...historyRef.current.slice(0, historyIndexRef.current + 1), next].slice(-60);
      historyIndexRef.current = historyRef.current.length - 1;
      setHistoryVersion((value) => value + 1);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [connections, nodes]);

  const undoHistory = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    applyingHistoryRef.current = true;
    setNodes(structuredClone(snapshot.nodes));
    setConnections(structuredClone(snapshot.connections));
    setHistoryVersion((value) => value + 1);
  }, []);

  const redoHistory = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    applyingHistoryRef.current = true;
    setNodes(structuredClone(snapshot.nodes));
    setConnections(structuredClone(snapshot.connections));
    setHistoryVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoHistory(); else undoHistory();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoHistory();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redoHistory, undoHistory]);

  // Date range for linked funnels
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });
  const [datePreset, setDatePreset] = useState("30d");

  const isLinked = funnelType === "linked" && !!adAccountId;

  // Fetch insights for linked funnels
  const { data: insights = [], isLoading: insightsLoading, refetch: refetchInsights } = useInsights({
    adAccountId: isLinked ? adAccountId! : undefined,
    startDate: startOfDay(dateRange.start),
    endDate: endOfDay(dateRange.end),
    enabled: isLinked,
  });

  // Filter insights by selected campaigns
  const filteredInsights = useMemo(() => {
    if (!isLinked || !campaignIds?.length) return insights;
    // insights already have campaign_name but we need to filter by campaign_id
    // Since useInsights joins through ads → adsets → campaigns, we filter what we get
    return insights;
  }, [insights, isLinked, campaignIds]);

  // Aggregated metrics from insights
  const aggregatedMetrics = useMemo(() => {
    if (!filteredInsights.length) return null;
    const totalSpend = filteredInsights.reduce((s, r) => s + r.spend, 0);
    const totalImpressions = filteredInsights.reduce((s, r) => s + r.impressions, 0);
    const totalReach = filteredInsights.reduce((s, r) => s + r.reach, 0);
    const totalClicks = filteredInsights.reduce((s, r) => s + r.clicks, 0);
    const totalLeads = filteredInsights.reduce((s, r) => s + r.leads, 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const conversionRate = totalClicks > 0 ? (totalLeads / totalClicks) * 100 : 0;
    const avgFrequency = totalReach > 0 ? totalImpressions / totalReach : 0;
    const efficiencyRate = totalImpressions > 0 ? (totalLeads / totalImpressions) * 100 : 0;

    return {
      spend: totalSpend,
      impressions: totalImpressions,
      reach: totalReach,
      clicks: totalClicks,
      leads: totalLeads,
      ctr: avgCTR,
      cpm: avgCPM,
      cpl: avgCPL,
      conversion_rate: conversionRate,
      frequency: avgFrequency,
      efficiency_rate: efficiencyRate,
    } as Record<string, number>;
  }, [filteredInsights]);

  // Auto-populate nodes with linked data
  const displayNodes = useMemo(() => {
    if (!isLinked || !aggregatedMetrics) return nodes;
    return nodes.map(node => {
      if (node.dataSource === "auto" && node.metricKey && aggregatedMetrics[node.metricKey] !== undefined) {
        return { ...node, value: Number(aggregatedMetrics[node.metricKey].toFixed(2)) };
      }
      return node;
    });
  }, [nodes, isLinked, aggregatedMetrics]);

  const handleDatePreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    switch (preset) {
      case "7d": setDateRange({ start: subDays(now, 7), end: now }); break;
      case "14d": setDateRange({ start: subDays(now, 14), end: now }); break;
      case "30d": setDateRange({ start: subDays(now, 30), end: now }); break;
      case "60d": setDateRange({ start: subDays(now, 60), end: now }); break;
      case "90d": setDateRange({ start: subDays(now, 90), end: now }); break;
    }
  };

  const createFunnelMut = useCreateFunnel();
  const updateFunnel = useUpdateFunnel();
  const { toast } = useToast();
  const [savedId, setSavedId] = useState(funnelId);

  const handleSave = async () => {
    try {
      if (savedId) {
        await updateFunnel.mutateAsync({ id: savedId, name: funnelName, nodes: nodes as any, connections: connections as any });
      } else {
        const result = await createFunnelMut.mutateAsync({ name: funnelName, nodes: nodes as any, connections: connections as any, funnel_type: funnelType, ad_account_id: adAccountId, campaign_ids: campaignIds });
        setSavedId(result.id);
      }
      setSavedSignature(JSON.stringify({ nodes, connections, name: funnelName }));
      toast({ title: "Funil salvo com sucesso!" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const isSaving = createFunnelMut.isPending || updateFunnel.isPending;

  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const findSnapTarget = useCallback((canvasX: number, canvasY: number, excludeNodeId?: string) => {
    let closest: FunnelNode | null = null;
    let closestDist = SNAP_DISTANCE;
    for (const node of nodes) {
      if (node.id === excludeNodeId) continue;
      const cx = node.x + NODE_W / 2;
      const cy = node.y + NODE_H / 2;
      const dist = Math.sqrt((canvasX - cx) ** 2 + (canvasY - cy) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = node;
      }
    }
    return closest;
  }, [nodes]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);

  const handleEndpointMouseDown = useCallback((e: React.MouseEvent, connIndex: number, end: "from" | "to") => {
    e.stopPropagation();
    e.preventDefault();
    const conn = connections[connIndex];
    const anchorNodeId = end === "to" ? conn.from : conn.to;
    const canvasPos = clientToCanvas(e.clientX, e.clientY);
    setDragLine({ fromNodeId: anchorNodeId, end, connectionIndex: connIndex, mouseX: canvasPos.x, mouseY: canvasPos.y, snapTargetId: null });
  }, [connections, clientToCanvas]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-port]")) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    if (activeTool === "hand") {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    if (activeTool === "connect") {
      const canvasPos = clientToCanvas(e.clientX, e.clientY);
      setDragLine({ fromNodeId: nodeId, end: "to", connectionIndex: -1, mouseX: canvasPos.x, mouseY: canvasPos.y, snapTargetId: null });
      return;
    }
    setDraggingNodeId(nodeId);
    dragStart.current = { x: e.clientX, y: e.clientY, nodeX: node.x, nodeY: node.y };
  }, [activeTool, clientToCanvas, nodes, pan]);

  const handlePortMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const canvasPos = clientToCanvas(e.clientX, e.clientY);
    setDragLine({ fromNodeId: nodeId, end: "to", connectionIndex: -1, mouseX: canvasPos.x, mouseY: canvasPos.y, snapTargetId: null });
  }, [clientToCanvas]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-funnel-node]")) return;
    if (activeTool !== "hand") return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [activeTool, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragLine) {
      const canvasPos = clientToCanvas(e.clientX, e.clientY);
      const snap = findSnapTarget(canvasPos.x, canvasPos.y, dragLine.fromNodeId);
      setDragLine((prev) => prev ? { ...prev, mouseX: canvasPos.x, mouseY: canvasPos.y, snapTargetId: snap?.id ?? null } : null);
      return;
    }
    if (draggingNodeId) {
      const dx = (e.clientX - dragStart.current.x) / zoom;
      const dy = (e.clientY - dragStart.current.y) / zoom;
      setNodes((prev) => prev.map((n) => n.id === draggingNodeId ? { ...n, x: dragStart.current.nodeX + dx, y: dragStart.current.nodeY + dy } : n));
      return;
    }
    if (!isPanning) return;
    setPan({ x: panStart.current.panX + (e.clientX - panStart.current.x), y: panStart.current.panY + (e.clientY - panStart.current.y) });
  }, [isPanning, draggingNodeId, zoom, dragLine, clientToCanvas, findSnapTarget]);

  const handleMouseUp = useCallback(() => {
    if (dragLine) {
      if (dragLine.snapTargetId) {
        if (dragLine.connectionIndex >= 0) {
          setConnections((prev) => prev.map((conn, i) => {
            if (i !== dragLine.connectionIndex) return conn;
            return dragLine.end === "to" ? { ...conn, to: dragLine.snapTargetId! } : { ...conn, from: dragLine.snapTargetId! };
          }));
        } else {
          setConnections((prev) => [...prev, { from: dragLine.fromNodeId, to: dragLine.snapTargetId! }]);
        }
      } else if (dragLine.connectionIndex >= 0) {
        setConnections((prev) => prev.filter((_, i) => i !== dragLine.connectionIndex));
      }
      setDragLine(null);
      return;
    }
    setIsPanning(false);
    setDraggingNodeId(null);
  }, [dragLine]);

  const handleDeleteConnection = useCallback((index: number) => {
    setConnections((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleExportPng = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, { backgroundColor: "#eef2fb", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `${funnelName || "funil"}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Imagem exportada com sucesso!" });
    } catch {
      toast({ title: "Erro ao exportar imagem", variant: "destructive" });
    }
  }, [funnelName, toast]);

  const canvasW = 1300;
  const canvasH = 680;
  const isConnecting = dragLine !== null;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const templateJson = e.dataTransfer.getData("application/funnel-template");
    if (!templateJson) return;
    const template: BlockTemplate = JSON.parse(templateJson);
    const canvasPos = clientToCanvas(e.clientX, e.clientY);
    const newNode = createNodeFromTemplate(template, canvasPos.x - NODE_W / 2, canvasPos.y - NODE_H / 2);
    setNodes((prev) => [...prev, newNode]);
  }, [clientToCanvas]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleCreateCustomBlock = () => {
    if (!customLabel.trim()) return;
    const colorOpt = COLOR_OPTIONS.find((c) => c.value === customColor) || COLOR_OPTIONS[0];
    const template: BlockTemplate = {
      label: customLabel.trim(),
      icon: customIcon,
      color: colorOpt.value,
      iconBg: colorOpt.bg,
      category: "Personalizado",
      dataSource: "manual",
    };
    const canvasPos = { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 };
    const newNode = createNodeFromTemplate(template, canvasPos.x, canvasPos.y);
    setNodes((prev) => [...prev, newNode]);
    setCustomBlockOpen(false);
    setCustomLabel("");
    setCustomIcon("Layout");
    setCustomColor(COLOR_OPTIONS[0].value);
  };

  const renderNodes = isLinked ? displayNodes : nodes;
  const isDirty = savedSignature !== JSON.stringify({ nodes, connections, name: funnelName });
  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;
  void historyVersion;

  return (
    <div className="space-y-4">
      {/* Header with back + name + save */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {editingName ? (
          <Input
            value={funnelName}
            onChange={(e) => setFunnelName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
            className="h-8 w-64 text-lg font-bold"
            autoFocus
          />
        ) : (
          <h1
            className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors"
            onClick={() => setEditingName(true)}
          >
            {funnelName}
          </h1>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingName(true)}>
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        {isLinked && (
          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 text-[10px]">
            <Link2 className="h-3 w-3 mr-1" /> Vinculado
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className={`hidden rounded-full px-2 py-1 text-[10px] font-semibold sm:inline-flex ${isDirty ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>
            {isDirty ? "Alterações não salvas" : "Salvo"}
          </span>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            Blocos
          </Button>
          <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Linked funnel date filter bar */}
      {isLinked && (
        <div className="flex items-center gap-2 flex-wrap bg-card border rounded-lg p-2.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mr-1">Período:</span>
          {[
            { label: "7 dias", value: "7d" },
            { label: "14 dias", value: "14d" },
            { label: "30 dias", value: "30d" },
            { label: "60 dias", value: "60d" },
            { label: "90 dias", value: "90d" },
          ].map(p => (
            <Button
              key={p.value}
              variant={datePreset === p.value ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleDatePreset(p.value)}
            >
              {p.label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {insightsLoading && <span className="text-xs text-muted-foreground animate-pulse">Carregando dados...</span>}
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => refetchInsights()}>
              <RefreshCw className={`h-3.5 w-3.5 ${insightsLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="gd-panel flex max-w-full items-center gap-2 overflow-x-auto p-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setCustomBlockOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo Bloco
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={undoHistory} disabled={!canUndo} title="Desfazer (Ctrl/⌘ + Z)">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={redoHistory} disabled={!canRedo} title="Refazer (Ctrl/⌘ + Shift + Z)">
          <Redo2 className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(2, z + 0.15))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={resetView}>
          <Maximize2 className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground ml-2">{Math.round(zoom * 100)}%</span>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleExportPng}>
          <Download className="h-4 w-4" />
          Exportar PNG
        </Button>
        <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
          <Move className="h-3.5 w-3.5" />
          Arraste blocos do painel para o canvas
        </div>
      </div>

      {/* Sidebar + Canvas layout */}
      <div className="flex gap-3">
        {/* Block Templates Sidebar */}
        {sidebarOpen && (
          <div className="w-56 shrink-0 border rounded-xl bg-card overflow-hidden flex flex-col" style={{ height: "calc(100vh - 260px)" }}>
            <div className="p-3 border-b flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Blocos</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCustomBlockOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {TEMPLATE_CATEGORIES.map((category) => (
                <div key={category}>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1 block">
                    {category}
                  </span>
                  <div className="space-y-1">
                    {BLOCK_TEMPLATES.filter((t) => t.category === category).map((template) => {
                      const Icon = getIcon(template.icon);
                      const isAutoBlock = isLinked && template.dataSource === "auto";
                      return (
                        <div
                          key={template.label}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/funnel-template", JSON.stringify(template));
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab hover:bg-accent/50 transition-colors group active:cursor-grabbing"
                        >
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                            style={{ backgroundColor: template.iconBg }}
                          >
                            <Icon className="h-3 w-3" style={{ color: template.color }} />
                          </div>
                          <span className="text-xs text-foreground truncate">{template.label}</span>
                          {isAutoBlock && (
                            <span className="text-[8px] text-emerald-600 bg-emerald-500/10 px-1 py-0.5 rounded font-medium shrink-0">AUTO</span>
                          )}
                          <GripVertical className="h-3 w-3 text-muted-foreground/40 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-xl border select-none flex-1"
          style={{
            height: "calc(100vh - 260px)",
            cursor: dragLine || activeTool === "connect" ? "crosshair" : isPanning ? "grabbing" : activeTool === "hand" ? "grab" : "default",
            backgroundColor: "hsl(216, 80%, 97%)",
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div
            className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-[#d6aa35]/25 bg-[#11100d]/92 p-1.5 text-white shadow-[0_18px_60px_-20px_rgba(0,0,0,.85)] backdrop-blur-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Button variant={activeTool === "select" ? "default" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setActiveTool("select")} title="Selecionar e mover blocos">
              <MousePointer2 className="h-4 w-4" />
            </Button>
            <Button variant={activeTool === "hand" ? "default" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setActiveTool("hand")} title="Mover o canvas">
              <Hand className="h-4 w-4" />
            </Button>
            <Button variant={activeTool === "connect" ? "default" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setActiveTool("connect")} title="Conectar etapas">
              <Waypoints className="h-4 w-4" />
            </Button>
            <span className="mx-1 h-6 w-px bg-white/10" />
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCustomBlockOpen(true)} title="Criar bloco">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/60 pointer-events-none z-10">
              <Layers className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">Canvas vazio</p>
              <p className="text-xs mt-1">Arraste blocos do painel lateral para começar</p>
              {isLinked && <p className="text-xs mt-1 text-emerald-600">Blocos com tag "AUTO" serão preenchidos com dados reais</p>}
            </div>
          )}

          {/* Dot grid background */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: "radial-gradient(circle, hsl(216, 40%, 80%) 1px, transparent 1px)",
              backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
            }}
          />

          <div
            className="absolute"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: canvasW,
              height: canvasH,
            }}
          >
            {/* SVG connections */}
            <svg className="absolute inset-0" width={canvasW} height={canvasH} style={{ overflow: "visible" }}>
              <defs>
                <marker id="arrowhead" markerWidth="7" markerHeight="5" refX="6.5" refY="2.5" orient="auto">
                  <path d="M 0 0 L 7 2.5 L 0 5 Z" fill="hsl(221, 83%, 60%)" opacity="0.9" />
                </marker>
              </defs>

              {connections.map((conn, index) => {
                if (dragLine && dragLine.connectionIndex === index) return null;
                const from = renderNodes.find((n) => n.id === conn.from)!;
                const to = renderNodes.find((n) => n.id === conn.to)!;
                if (!from || !to) return null;
                const ac = getNodeCenter(from);
                const bc = getNodeCenter(to);
                const a = getClosestEdgePoint(from, bc.cx, bc.cy);
                const b = getClosestEdgePoint(to, ac.cx, ac.cy);

                return (
                  <g key={`conn-${index}`} onMouseEnter={() => setHoveredConnIndex(index)} onMouseLeave={() => setHoveredConnIndex(null)}>
                    <title>{from.label} → {to.label}</title>
                    <path d={buildCurvePath(from, to)} fill="none" stroke="transparent" strokeWidth="20" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); handleDeleteConnection(index); }} />
                    {hoveredConnIndex === index && (
                      <path d={buildCurvePath(from, to)} fill="none" stroke="hsl(221, 83%, 60%)" strokeWidth="6" strokeOpacity="0.15" strokeLinecap="round" />
                    )}
                    <path d={buildCurvePath(from, to)} fill="none" stroke="hsl(221, 83%, 65%)" strokeWidth={hoveredConnIndex === index ? 2 : 1.5} strokeOpacity={hoveredConnIndex === index ? 0.4 : 0.2} strokeLinecap="round" className="transition-all duration-200" />
                    <path d={buildCurvePath(from, to)} fill="none" stroke="hsl(221, 83%, 60%)" strokeWidth={hoveredConnIndex === index ? 2 : 1.5} strokeOpacity={hoveredConnIndex === index ? 1 : 0.6} strokeDasharray="6 10" strokeLinecap="round" markerEnd="url(#arrowhead)">
                      <animate attributeName="stroke-dashoffset" values="0;-16" dur={hoveredConnIndex === index ? "0.6s" : "1.2s"} repeatCount="indefinite" calcMode="linear" />
                    </path>
                    <circle cx={a.x} cy={a.y} r={6} fill="hsl(221, 83%, 53%)" stroke="hsl(var(--card))" strokeWidth="2" className="cursor-grab opacity-0 hover:opacity-100 transition-opacity" style={{ pointerEvents: "all" }} onMouseDown={(e) => handleEndpointMouseDown(e, index, "from")} />
                    <circle cx={b.x} cy={b.y} r={6} fill="hsl(221, 83%, 53%)" stroke="hsl(var(--card))" strokeWidth="2" className="cursor-grab opacity-0 hover:opacity-100 transition-opacity" style={{ pointerEvents: "all" }} onMouseDown={(e) => handleEndpointMouseDown(e, index, "to")} />
                  </g>
                );
              })}

              {/* Live drag line */}
              {dragLine && (() => {
                const anchorNode = renderNodes.find((n) => n.id === dragLine.fromNodeId)!;
                const anchorCenter = getNodeCenter(anchorNode);
                const snapNode = dragLine.snapTargetId ? renderNodes.find((n) => n.id === dragLine.snapTargetId) : null;
                const targetX = snapNode ? snapNode.x + NODE_W / 2 : dragLine.mouseX;
                const targetY = snapNode ? snapNode.y + NODE_H / 2 : dragLine.mouseY;
                const isFrom = dragLine.end === "from";
                const fromX = isFrom ? targetX : anchorCenter.cx;
                const fromY = isFrom ? targetY : anchorCenter.cy;
                const toX = isFrom ? anchorCenter.cx : targetX;
                const toY = isFrom ? anchorCenter.cy : targetY;

                return (
                  <g>
                    <path d={buildCurveFromPoints(fromX, fromY, toX, toY)} fill="none" stroke="hsl(221, 83%, 53%)" strokeWidth="2" strokeOpacity={snapNode ? "0.8" : "0.4"} strokeDasharray={snapNode ? "none" : "6 4"} markerEnd="url(#arrowhead)" />
                    <circle cx={targetX} cy={targetY} r={snapNode ? 8 : 5} fill={snapNode ? "hsl(221, 83%, 53%)" : "hsl(221, 83%, 73%)"} stroke="hsl(var(--card))" strokeWidth="2" className="transition-all duration-150" />
                  </g>
                );
              })()}
            </svg>

            {/* Nodes */}
            {renderNodes.map((node) => {
              const Icon = getIcon(node.icon);
              const isHovered = hoveredNodeId === node.id;
              const isSnapTarget = dragLine?.snapTargetId === node.id;
              const showPorts = activeTool === "connect" || isConnecting || isHovered;
              const isAutoNode = isLinked && node.dataSource === "auto";

              return (
                <div
                  key={node.id}
                  data-funnel-node
                  className={`absolute rounded-lg shadow-md hover:shadow-xl transition-all duration-200 flex flex-col items-center overflow-hidden group ${
                    isSnapTarget ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105" : ""
                  }`}
                  style={{
                    left: node.x, top: node.y, width: NODE_W, height: NODE_H,
                    cursor: draggingNodeId === node.id ? "grabbing" : activeTool === "connect" || dragLine ? "crosshair" : activeTool === "hand" ? "grab" : "move",
                    zIndex: editingNodeId === node.id ? 20 : isSnapTarget ? 10 : 1,
                    backgroundColor: "#ffffff", border: isAutoNode ? "1.5px solid hsl(152, 60%, 75%)" : "1px solid #e5e7eb",
                  }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  {showPorts && (
                    <>
                      <div data-port className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-white cursor-crosshair hover:scale-150 transition-transform z-10" onMouseDown={(e) => handlePortMouseDown(e, node.id)} />
                      <div data-port className="absolute top-1/2 -right-[7px] -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-white cursor-crosshair hover:scale-150 transition-transform z-10" onMouseDown={(e) => handlePortMouseDown(e, node.id)} />
                      <div data-port className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-white cursor-crosshair hover:scale-150 transition-transform z-10" onMouseDown={(e) => handlePortMouseDown(e, node.id)} />
                      <div data-port className="absolute top-1/2 -left-[7px] -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-white cursor-crosshair hover:scale-150 transition-transform z-10" onMouseDown={(e) => handlePortMouseDown(e, node.id)} />
                    </>
                  )}

                  {/* Auto badge */}
                  {isAutoNode && (
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded z-10">
                      AUTO
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    className="absolute top-1.5 left-1.5 p-1 rounded-md hover:bg-destructive/10 transition-colors z-10 opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setNodeToDelete(node.id); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Excluir bloco"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>

                  {/* Edit button */}
                  <button
                    className="absolute top-1.5 right-1.5 p-1 rounded-md hover:bg-gray-100 transition-colors z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editingNodeId === node.id) {
                        setNodes((prev) => prev.map((n) => n.id === node.id ? { ...n, description: editDescription } : n));
                        setEditingNodeId(null);
                      } else {
                        setEditDescription(node.description);
                        setEditingNodeId(node.id);
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {editingNodeId === node.id ? <Check className="h-3 w-3 text-gray-500" /> : <Pencil className="h-3 w-3 text-gray-400" />}
                  </button>

                  <div className="flex flex-col items-center justify-center gap-1.5 flex-1 px-3 pt-4 pb-2">
                    <div className="w-10 h-10 flex items-center justify-center rotate-45 rounded-md" style={{ backgroundColor: node.iconBg }}>
                      <Icon className="h-5 w-5 -rotate-45" style={{ color: node.color }} />
                    </div>
                    <span className="text-[10px] font-medium text-gray-500 text-center leading-tight truncate w-full mt-1">{node.label}</span>
                    <span className="text-2xl font-bold text-gray-800 leading-none">
                      <AnimatedNumber value={node.value} suffix={typeof node.value === "number" && node.value % 1 !== 0 ? "%" : ""} decimals={node.value % 1 !== 0 ? 2 : 0} duration={500} />
                    </span>
                    <ChangeIndicator change={node.change} />
                    {editingNodeId === node.id ? (
                      <textarea
                        className="w-full text-[9px] leading-tight bg-gray-50 rounded px-1.5 py-1 text-gray-700 resize-none border border-gray-200 outline-none placeholder:text-gray-400"
                        rows={2} placeholder="Adicionar descrição..." value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : node.description ? (
                      <span className="w-full text-[9px] leading-tight text-gray-400 text-center line-clamp-2">{node.description}</span>
                    ) : null}
                  </div>

                  <div className="w-full h-1.5 mt-auto" style={{ backgroundColor: node.change > 0 ? "hsl(152, 60%, 45%)" : node.change < 0 ? "hsl(0, 72%, 55%)" : "hsl(221, 83%, 53%)" }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Custom Block Dialog */}
      <Dialog open={customBlockOpen} onOpenChange={setCustomBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Bloco Personalizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do bloco</Label>
              <Input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Ex: Upsell, Remarketing..."
              />
            </div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select value={customIcon} onValueChange={setCustomIcon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((iconName) => {
                    const Ic = ICON_MAP[iconName];
                    return (
                      <SelectItem key={iconName} value={iconName}>
                        <div className="flex items-center gap-2">
                          <Ic className="h-4 w-4" />
                          <span>{iconName}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${customColor === opt.value ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: opt.value }}
                    onClick={() => setCustomColor(opt.value)}
                    title={opt.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomBlockOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCustomBlock} disabled={!customLabel.trim()}>Criar e Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Node Confirmation */}
      <AlertDialog open={!!nodeToDelete} onOpenChange={(open) => !open && setNodeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bloco</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{nodes.find((n) => n.id === nodeToDelete)?.label}"? As conexões ligadas a este bloco também serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (nodeToDelete) {
                setNodes((prev) => prev.filter((n) => n.id !== nodeToDelete));
                setConnections((prev) => prev.filter((c) => c.from !== nodeToDelete && c.to !== nodeToDelete));
                setNodeToDelete(null);
              }
            }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function migrateToFreeCanvas(initialNodes: FunnelNode[], initialConnections: FunnelConnection[]): FlowData {
  const alreadyModern = initialNodes.length === 0 || initialNodes.every((node) => "type" in (node as unknown as Record<string, unknown>) && "strokeColor" in (node as unknown as Record<string, unknown>));
  const metadata = (initialConnections as unknown as Array<Record<string, any>>).find((connection) => connection.kind === "growdash-flow-view");

  if (alreadyModern) {
    return {
      version: 1,
      elements: initialNodes as unknown as DrawElement[],
      zoom: Number(metadata?.zoom || 1),
      panOffset: metadata?.panOffset || { x: 0, y: 0 },
      showGrid: metadata?.showGrid ?? true,
      snapToGrid: metadata?.snapToGrid ?? false,
      updatedAt: metadata?.updatedAt || new Date().toISOString(),
    };
  }

  const migratedNodes: DrawElement[] = initialNodes.map((node, index) => ({
    id: node.id,
    type: "sticky",
    x: node.x,
    y: node.y,
    width: 220,
    height: 150,
    rotation: 0,
    opacity: 1,
    fillColor: "#fbbf24",
    strokeColor: node.color || "#F5A623",
    strokeWidth: 2,
    text: `${node.label}${node.description ? `\n\n${node.description}` : ""}${node.value ? `\n\nResultado: ${node.value}` : ""}`,
    fontSize: 18,
    fontFamily: "Nunito, Inter, system-ui, sans-serif",
    layerIndex: index,
    locked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  const migratedConnections: DrawElement[] = initialConnections
    .filter((connection) => connection.from && connection.to)
    .map((connection, index) => {
      const from = initialNodes.find((node) => node.id === connection.from);
      const to = initialNodes.find((node) => node.id === connection.to);
      return {
        id: `migrated_arrow_${index}_${connection.from}_${connection.to}`,
        type: "arrow",
        x: (from?.x || 0) + 220,
        y: (from?.y || 0) + 75,
        width: (to?.x || 260) - (from?.x || 0) - 220,
        height: (to?.y || 0) - (from?.y || 0),
        rotation: 0,
        opacity: 1,
        fillColor: "transparent",
        strokeColor: "#F5A623",
        strokeWidth: 2,
        layerIndex: initialNodes.length + index,
        locked: false,
        startBinding: { elementId: connection.from, anchor: "e" },
        endBinding: { elementId: connection.to, anchor: "w" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies DrawElement;
    });

  return { version: 1, elements: [...migratedNodes, ...migratedConnections], zoom: 1, panOffset: { x: 0, y: 0 }, showGrid: true, snapToGrid: false, updatedAt: new Date().toISOString() };
}

function FreeCanvasEditor({ funnelId, initialNodes, initialConnections, initialName, onBack }: { funnelId: string | null; initialNodes: FunnelNode[]; initialConnections: FunnelConnection[]; initialName: string; onBack: () => void }) {
  const updateFunnel = useUpdateFunnel();
  const createFunnel = useCreateFunnel();
  const [savedId, setSavedId] = useState(funnelId);
  const initialFlow = useMemo(() => migrateToFreeCanvas(initialNodes, initialConnections), [initialConnections, initialNodes]);

  const handleSave = async (flow: FlowData) => {
    const viewMetadata = [{
      kind: "growdash-flow-view",
      version: flow.version,
      zoom: flow.zoom,
      panOffset: flow.panOffset,
      showGrid: flow.showGrid,
      snapToGrid: flow.snapToGrid,
      updatedAt: flow.updatedAt,
    }];
    if (savedId) {
      await updateFunnel.mutateAsync({ id: savedId, name: initialName, nodes: flow.elements, connections: viewMetadata });
    } else {
      const created = await createFunnel.mutateAsync({ name: initialName, nodes: flow.elements, connections: viewMetadata, funnel_type: "blank" });
      setSavedId(created.id);
    }
  };

  return <GrowdashFlowCanvas initialFlow={initialFlow} onSave={handleSave} onBack={onBack} title={initialName} />;
}

/* ─── Main Page ─── */
const Funnelytics = () => {
  const [view, setView] = useState<"list" | "canvas">("list");
  const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null);
  const [canvasData, setCanvasData] = useState<{
    nodes: FunnelNode[];
    connections: FunnelConnection[];
    name: string;
    funnelType: "blank" | "linked";
    adAccountId?: string | null;
    campaignIds?: string[];
  } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: funnels = [] } = useFunnels();

  const handleSelectFunnel = (id: string) => {
    const funnel = funnels.find((f) => f.id === id);
    if (funnel) {
      setActiveFunnelId(id);
      setCanvasData({
        nodes: (funnel.nodes as any[]) || [],
        connections: (funnel.connections as any[]) || [],
        name: funnel.name,
        funnelType: (funnel.funnel_type as "blank" | "linked") || "blank",
        adAccountId: funnel.ad_account_id,
        campaignIds: (funnel.campaign_ids as string[]) || [],
      });
      setView("canvas");
    }
  };

  const handleCreated = (funnel: FunnelRecord) => {
    setActiveFunnelId(funnel.id);
    setCanvasData({
      nodes: (funnel.nodes as FunnelNode[]) || [],
      connections: (funnel.connections as FunnelConnection[]) || [],
      name: funnel.name,
      funnelType: funnel.funnel_type,
      adAccountId: funnel.ad_account_id,
      campaignIds: funnel.campaign_ids || [],
    });
    setView("canvas");
  };

  const handleBack = () => {
    setView("list");
    setActiveFunnelId(null);
    setCanvasData(null);
  };

  if (view === "canvas" && canvasData) {
    if (canvasData.funnelType === "blank") {
      return <FreeCanvasEditor key={activeFunnelId || "new-free-canvas"} funnelId={activeFunnelId} initialNodes={canvasData.nodes} initialConnections={canvasData.connections} initialName={canvasData.name} onBack={handleBack} />;
    }
    return (
      <FunnelCanvas
        key={activeFunnelId || "new"}
        funnelId={activeFunnelId}
        initialNodes={canvasData.nodes}
        initialConnections={canvasData.connections}
        initialName={canvasData.name}
        onBack={handleBack}
        funnelType={canvasData.funnelType}
        adAccountId={canvasData.adAccountId}
        campaignIds={canvasData.campaignIds}
      />
    );
  }

  return (
    <>
      <FunnelListing onSelect={handleSelectFunnel} onCreate={() => setCreateDialogOpen(true)} />
      <CreateFunnelDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleCreated}
      />
    </>
  );
};

export default Funnelytics;
