type QueryError = { message: string } | null;
export function checked<T>(result: { data: T | null; error: QueryError }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Daten konnten nicht geladen werden.");
  return result.data;
}

export async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: QueryError }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const page = checked(await query(from, from + 499));
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
