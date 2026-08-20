export type ConnectedRDFunnel = {
  id: string;
  rd_funnel_id: string | null;
  is_active: boolean;
};

/** Only funnels currently linked to RD may define the operational CRM board. */
export function connectedRDFunnelIds(funnels: ConnectedRDFunnel[]) {
  return new Set(funnels.filter((funnel) => funnel.is_active && !!funnel.rd_funnel_id).map((funnel) => funnel.id));
}
