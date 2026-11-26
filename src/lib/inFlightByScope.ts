/** Coalesce duplicate work for the same scope without blocking other scopes. */
export function withInFlightScope<T>(
  inFlight: Map<string, Promise<T>>,
  scope: string,
  run: () => Promise<T>,
): Promise<T> {
  const existing = inFlight.get(scope);
  if (existing) return existing;

  let task: Promise<T>;
  task = Promise.resolve()
    .then(run)
    .finally(() => {
      if (inFlight.get(scope) === task) inFlight.delete(scope);
    });
  inFlight.set(scope, task);
  return task;
}
