import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import { scaleQuantile, scaleQuantize } from "d3-scale";
import { Plus, Minus, Maximize2 } from "lucide-react";

interface BrazilMapProps {
  data: Record<string, number>;
  colorScheme?: "brand" | "blue" | "green";
  metricLabel?: string;
  title?: string;
  subtitle?: string;
  source?: "meta_leads" | "rd" | "meta" | "mixed";
  coverage?: { withState: number; total: number; pct: number };
}

const GEO_URL = "/geo/br-states.json";

const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

// Choropleth ramps (light → dark)
const RAMPS = {
  brand: [
    "hsl(var(--primary) / .10)", "hsl(var(--primary) / .20)",
    "hsl(var(--primary) / .34)", "hsl(var(--primary) / .50)",
    "hsl(var(--primary) / .66)", "hsl(var(--primary) / .82)", "hsl(var(--primary))",
  ],
  blue: ["#eff4ff", "#dbe6ff", "#b8ccff", "#8aaaff", "#5b86f7", "#3b6fe8", "#1d4ed8"],
  green: ["#ecfdf5", "#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#047857"],
} as const;

export function BrazilMap({
  data,
  colorScheme = "brand",
  metricLabel = "leads",
  title = "Leads por estado",
  subtitle,
  source,
  coverage,
}: BrazilMapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; uf: string; value: number } | null>(null);
  const INITIAL = { coordinates: [-54, -15] as [number, number], zoom: 1 };
  const [view, setView] = useState(INITIAL);
  const setZoom = (z: number) => setView((v) => ({ ...v, zoom: Math.min(8, Math.max(0.5, z)) }));

  const maxValue = Math.max(...Object.values(data), 1);
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const activeStates = Object.keys(data).filter((k) => data[k] > 0).length;

  const ramp = RAMPS[colorScheme];
  // Use scaleQuantile so the gradient is distributed by the actual data distribution
  // (avoids outliers like MG=121 making all other states look almost white).
  // Fall back to scaleQuantize when there are too few distinct values for quantiles.
  const colorScale = useMemo(() => {
    const values = Object.values(data).filter((v) => v > 0);
    if (values.length >= 3) {
      return scaleQuantile<string>().domain(values).range(ramp as unknown as string[]);
    }
    return scaleQuantize<string>().domain([0, maxValue]).range(ramp as unknown as string[]);
  }, [data, maxValue, ramp]);

  const accentText = colorScheme === "green" ? "text-emerald-600" : colorScheme === "blue" ? "text-blue-600" : "text-primary";

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {subtitle ?? `${total.toLocaleString("pt-BR")} ${metricLabel} em ${activeStates} estados`}
            </p>
          </div>
          {(source || coverage) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {source && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  Fonte: {source === "meta_leads" ? "Meta Leads (real)" : source === "rd" ? "RD Station" : source === "mixed" ? "RD + Meta" : "Meta regiões"}
                </Badge>
              )}
              {coverage && coverage.total > 0 && (
                <Badge
                  variant={coverage.pct >= 80 ? "default" : coverage.pct >= 50 ? "secondary" : "destructive"}
                  className="text-[10px] font-normal tabular-nums"
                >
                  {coverage.withState}/{coverage.total} c/ estado ({coverage.pct.toFixed(0)}%)
                </Badge>
              )}
              {coverage && coverage.total - coverage.withState > 0 && (
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                  Sem região: {coverage.total - coverage.withState}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="relative w-full"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Vertical legend */}
          <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10 flex flex-col items-start gap-1.5 pointer-events-none">
            <span className="text-[10px] text-muted-foreground">Volume de {metricLabel}</span>
            <span className="text-[10px] text-foreground/70">Mais {metricLabel}</span>
            <div
              className="w-3 h-24 rounded-sm"
              style={{
                background: `linear-gradient(to bottom, ${ramp[ramp.length - 1]}, ${ramp[0]})`,
              }}
            />
            <span className="text-[10px] text-foreground/70">Menos {metricLabel}</span>
          </div>

          {/* Zoom controls */}
          <div className="absolute right-2 top-2 z-20 flex flex-col gap-1">
            <Button size="icon" variant="outline" className="h-7 w-7 bg-background/90" onClick={() => setZoom(view.zoom * 1.4)} aria-label="Aumentar zoom">
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="outline" className="h-7 w-7 bg-background/90" onClick={() => setZoom(view.zoom / 1.4)} aria-label="Diminuir zoom">
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="outline" className="h-7 w-7 bg-background/90" onClick={() => setView(INITIAL)} aria-label="Resetar zoom">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 700, center: [-54, -15] }}
            width={500}
            height={360}
            style={{ width: "100%", height: "auto", maxHeight: 360 }}
          >
            <ZoomableGroup
              center={view.coordinates}
              zoom={view.zoom}
              minZoom={0.5}
              maxZoom={8}
              onMoveEnd={({ coordinates, zoom }) => setView({ coordinates: coordinates as [number, number], zoom })}
            >
            <Geographies geography={GEO_URL}>
              {({ geographies }) => (
                <>
                  {geographies.map((geo) => {
                    const uf: string = geo.properties.sigla;
                    const value = data[uf] || 0;
                    const fill = value > 0 ? colorScale(value) : "hsl(var(--muted))";
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="#ffffff"
                        strokeWidth={0.6}
                        onMouseEnter={(e) => {
                          const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                          setTooltip({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                            uf,
                            value,
                          });
                        }}
                        onMouseMove={(e) => {
                          const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                          setTooltip({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                            uf,
                            value,
                          });
                        }}
                        style={{
                          default: { outline: "none", transition: "fill 200ms" },
                          hover: { outline: "none", fill, opacity: 0.85, cursor: "pointer" },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })}

                  {/* Sigla badges only for states with data */}
                  {geographies
                    .filter((g) => (data[g.properties.sigla] || 0) > 0)
                    .map((geo) => {
                      const uf: string = geo.properties.sigla;
                      const centroid = geoCentroid(geo);
                      return (
                        <Marker key={`m-${geo.rsmKey}`} coordinates={centroid}>
                          <g transform={`translate(-14, -8) scale(${1 / Math.sqrt(view.zoom)})`} style={{ transformOrigin: "14px 8px" }}>
                            <rect
                              width={28}
                              height={16}
                              rx={8}
                              ry={8}
                              fill="#ffffff"
                              stroke="rgba(0,0,0,0.06)"
                              strokeWidth={1}
                              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.12))" }}
                            />
                            <text
                              x={14}
                              y={11}
                              textAnchor="middle"
                              className={accentText}
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                fill: "currentColor",
                                pointerEvents: "none",
                              }}
                            >
                              {uf}
                            </text>
                          </g>
                        </Marker>
                      );
                    })}
                </>
              )}
            </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {tooltip && (
            <div
              className="pointer-events-none absolute z-20 rounded-md border bg-popover px-2 py-1 text-[11px] shadow-lg"
              style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
            >
              <div className="font-semibold">{STATE_NAMES[tooltip.uf] || tooltip.uf}</div>
              <div className="text-muted-foreground">
                {tooltip.value.toLocaleString("pt-BR")} {metricLabel}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
