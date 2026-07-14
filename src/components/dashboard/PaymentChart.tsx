import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AnimatedNumber } from "@/components/AnimatedNumber";

interface PaymentChartProps {
  byPayment: { pix: number; cartao: number; boleto: number; outros: number };
}

const COLORS = [
  "hsl(142, 71%, 45%)",
  "hsl(221, 83%, 53%)",
  "hsl(38, 92%, 50%)",
  "hsl(262, 83%, 58%)",
];

const LABELS: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
  outros: "Outros",
};

export function PaymentChart({ byPayment }: PaymentChartProps) {
  const data = Object.entries(byPayment)
    .map(([key, value]) => ({ name: LABELS[key], value }))
    .filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Vendas por Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Nenhuma venda registrada
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Vendas por Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-48">
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
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
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
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span>{d.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
