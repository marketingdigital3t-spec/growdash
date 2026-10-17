export type DealEditStatus = "open" | "won" | "lost";

export type DealEditDraft = {
  name: string;
  status: DealEditStatus;
  hold: boolean;
  rating: string;
  predictionDate: string;
  lostNote: string;
};

export type DealEditSnapshot = DealEditDraft;

export function statusFromRDDeal(deal: {
  win?: boolean | null;
  stage_bucket?: string | null;
  lost_reason?: string | null;
}): DealEditStatus {
  if (deal.win === true || deal.stage_bucket === "client") return "won";
  if (deal.stage_bucket === "lost" || Boolean(deal.lost_reason)) return "lost";
  // The RD API sends win=false for open deals as well as lost deals. The
  // stage bucket/reason are therefore authoritative for distinguishing them.
  return "open";
}

/**
 * Builds only fields that the user actually changed. In particular, an open
 * RD deal must never be serialized as `win: false`: RD interprets that value
 * as a loss. A loss is emitted only after the user explicitly selects it and
 * the backend receives confirm_loss=true.
 */
export function buildRDDealUpdate(initial: DealEditSnapshot, draft: DealEditDraft): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const name = draft.name.trim();
  if (name !== initial.name.trim() && name) fields.name = name;
  if (draft.hold !== initial.hold) fields.hold = draft.hold;
  if (draft.rating.trim() !== initial.rating.trim()) {
    fields.rating = draft.rating.trim() ? Number(draft.rating) : null;
  }
  if (draft.predictionDate !== initial.predictionDate) fields.prediction_date = draft.predictionDate || null;
  if (draft.lostNote.trim() !== initial.lostNote.trim()) fields.deal_lost_note = draft.lostNote.trim() || null;

  if (draft.status !== initial.status) {
    if (draft.status === "won") fields.win = true;
    else if (draft.status === "lost") {
      fields.win = false;
      fields.confirm_loss = true;
    } else {
      // The provider accepts null as the non-terminal/open state. This is
      // explicit only when the user changes a terminal status to open.
      fields.win = null;
    }
  }
  return fields;
}

/** Keeps the explicit loss confirmation at the request root, as required by
 * the rd-update-deal Edge Function, instead of treating it as an RD field. */
export function serializeRDDealUpdate(fields: Record<string, unknown>) {
  const { confirm_loss, ...dealFields } = fields;
  return { fields: dealFields, confirm_loss: confirm_loss === true };
}
