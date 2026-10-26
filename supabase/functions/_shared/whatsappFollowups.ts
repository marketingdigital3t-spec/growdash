export async function scheduleWhatsAppFollowups(admin: any, input: { workspaceId: string; whatsappNumberId: string; conversationId: string; agentId?: string | null; inboundAt?: string }) {
  const base = new Date(input.inboundAt || Date.now()).getTime();
  const delays = [4 * 60, 8 * 60, 24 * 60, 48 * 60, 72 * 60, 96 * 60, 120 * 60, 144 * 60, 168 * 60];
  const rows = delays.map((minutes, index) => ({ workspace_id: input.workspaceId, whatsapp_number_id: input.whatsappNumberId, conversation_id: input.conversationId, agent_id: input.agentId || null, sequence_no: index + 1, scheduled_at: new Date(base + minutes * 60_000).toISOString(), status: "pending", reason: "seller_silent" }));
  await admin.from("whatsapp_followups").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("conversation_id", input.conversationId).eq("status", "pending");
  return admin.from("whatsapp_followups").upsert(rows, { onConflict: "conversation_id,sequence_no" });
}

export async function cancelWhatsAppFollowups(admin: any, conversationId: string) {
  return admin.from("whatsapp_followups").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("status", "pending");
}
