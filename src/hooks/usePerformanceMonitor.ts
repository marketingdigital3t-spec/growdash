import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SUPABASE_URL, supabase } from "@/integrations/supabase/client";

type PerformanceMetric = "navigation" | "route_commit" | "api_batch";

function round(value: number) {
  return Math.round(value * 100) / 100;
}

async function recordPerformanceEvent(input: {
  workspaceId?: string;
  userId: string;
  route: string;
  metricName: PerformanceMetric;
  durationMs: number;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isFinite(input.durationMs) || input.durationMs < 0) return;
  try {
    await (supabase as any).from("platform_performance_events").insert({
      workspace_id: input.workspaceId || null,
      user_id: input.userId,
      route: input.route.slice(0, 200),
      metric_name: input.metricName,
      duration_ms: round(input.durationMs),
      status: "ok",
      metadata: input.metadata || {},
    });
  } catch {
    // Telemetry must never block a screen or surface an error to the user.
  }
}

export function usePerformanceMonitor(workspaceId?: string) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const firstNavigationRecorded = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    const routeStartedAt = performance.now();
    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      void recordPerformanceEvent({
        workspaceId,
        userId: user.id,
        route: pathname,
        metricName: "route_commit",
        durationMs: performance.now() - routeStartedAt,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, user?.id, workspaceId]);

  useEffect(() => {
    if (!user?.id || firstNavigationRecorded.current) return;
    firstNavigationRecorded.current = true;
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation) {
      void recordPerformanceEvent({
        workspaceId,
        userId: user.id,
        route: window.location.pathname,
        metricName: "navigation",
        durationMs: navigation.duration,
        metadata: {
          ttfbMs: round(navigation.responseStart),
          domContentLoadedMs: round(navigation.domContentLoadedEventEnd),
          loadEventMs: round(navigation.loadEventEnd),
          type: navigation.type,
        },
      });
    }
    const resources = performance.getEntriesByType("resource")
      .filter((entry): entry is PerformanceResourceTiming => typeof PerformanceResourceTiming !== "undefined" && entry instanceof PerformanceResourceTiming)
      .filter((entry) => entry.name.startsWith(SUPABASE_URL))
      .slice(-25);
    if (resources.length) {
      void recordPerformanceEvent({
        workspaceId,
        userId: user.id,
        route: window.location.pathname,
        metricName: "api_batch",
        durationMs: resources.reduce((sum, entry) => sum + entry.duration, 0) / resources.length,
        metadata: { requestCount: resources.length, maxDurationMs: round(Math.max(...resources.map((entry) => entry.duration))) },
      });
    }
  }, [user?.id, workspaceId]);
}
