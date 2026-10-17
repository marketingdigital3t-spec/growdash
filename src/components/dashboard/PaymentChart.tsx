import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { ShoppingCart } from "lucide-react";

interface PaymentChartProps {
  byPayment: { pix: number; cartao: number; boleto: number; outros: number };
  onRegisterSale?: () => void;
}

const COLORS: Record<string, string> = {
  pix: "#16a34a",
  cartao: "#2563eb",
  boleto: "#f59e0b",
  outros: "#8b5cf6",
};

const LABELS: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
  outros: "Outros",
};

export function PaymentChart({ byPayment, onRegisterSale }: PaymentChartProps) {
  const data = Object.entries(byPayment)
    .map(([key, value]) => ({ key, name: LABELS[key], value }))
    .filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <Card className="dashboard-terra-card dashboard-glass-card dashboard-payment-card h-full min-h-0">
        <CardHeader className="dashboard-payment-card-header p-3 pb-2">
          <CardTitle className="text-sm font-medium">Vendas por Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center p-4 pt-0 text-center text-sm text-muted-foreground">
          <div className="dashboard-payment-empty grid max-w-xs justify-items-center gap-2.5">
            <ShoppingCart className="h-8 w-8 opacity-55" aria-hidden="true" />
            <p>Nenhuma venda registrada</p>
            {onRegisterSale && <Button type="button" size="sm" onClick={onRegisterSale}>Registrar venda</Button>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
      <Card className="dashboard-terra-card dashboard-glass-card dashboard-payment-card flex h-full min-h-0 flex-col">
      <CardHeader className="dashboard-payment-card-header p-3 pb-2">
        <CardTitle className="text-sm font-medium">Vendas por Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="dashboard-payment-card-content flex flex-1 flex-col justify-center p-3 pt-0">
        <div className="dashboard-payment-chart-canvas relative h-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((row) => (
                  <Cell key={row.key} fill={COLORS[row.key] || COLORS.outros} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">
                R$ <AnimatedNumber value={total} decimals={0} />
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[d.key] || COLORS.outros }} />
              <span>{d.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
