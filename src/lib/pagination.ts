/** Returns whether a page can have another row after it. */
export function shouldFetchNextPage(rowCount: number, pageSize: number) {
  return rowCount >= pageSize && pageSize > 0;
}
