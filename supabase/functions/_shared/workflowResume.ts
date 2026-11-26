type Connection = { source: string; target: string };

export function resumeWorkflow(connectionList: Connection[], approvalNodeId: string) {
  return {
    queue: connectionList.filter((connection) => connection.source === approvalNodeId).map((connection) => connection.target),
    visited: [approvalNodeId],
  };
}
