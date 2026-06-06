import { Button } from "@/components/ui/button";
import { FileText, Globe, MessageCircle, Users } from "lucide-react";

export type ObjectiveType = "leads" | "native_form" | "landing_page" | "messages";

// NOTE: Classification by `campaign.objective` was removed (Meta ODAX no longer
// uses LEAD_GENERATION — everything is OUTCOME_LEADS). Tabs now filter by the
// real conversion mechanism observed per campaign (lead_grouped, landing_page_view,
// messaging_conversation_started_7d). See DefaultDashboardContent.tsx.

const OPTIONS: { key: ObjectiveType; label: string; icon: React.ReactNode }[] = [
  { key: "leads", label: "Leads", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "native_form", label: "Formulário Nativo", icon: <FileText className="h-3.5 w-3.5" /> },
  { key: "landing_page", label: "Landing page", icon: <Globe className="h-3.5 w-3.5" /> },
  { key: "messages", label: "Mensagens", icon: <MessageCircle className="h-3.5 w-3.5" /> },
];

interface Props {
  value: ObjectiveType;
  onChange: (v: ObjectiveType) => void;
}

export function ObjectiveTabs({ value, onChange }: Props) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {OPTIONS.map((o) => (
        <Button
          key={o.key}
          size="sm"
          variant={value === o.key ? "default" : "outline"}
          className="h-8 gap-1.5 text-xs"
          onClick={() => onChange(o.key)}
        >
          {o.icon}
          {o.label}
        </Button>
      ))}
    </div>
  );
}
