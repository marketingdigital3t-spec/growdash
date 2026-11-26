/**
 * Previous query data is safe to render as a placeholder only when every
 * scope dimension is identical. Cross-scope placeholders can briefly show
 * one account's snapshot under another account's selected filters.
 */
export function isSameQueryScope(previousKey: readonly unknown[] | undefined, currentKey: readonly unknown[]) {
  return Boolean(previousKey) && JSON.stringify(previousKey) === JSON.stringify(currentKey);
}
