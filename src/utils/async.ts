/**
 * Executes async tasks over an array of items with a maximum concurrency limit.
 */
export async function limitConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array<R>(items.length);
  const iterator = items.entries();

  const workers = Array(Math.min(limit, items.length))
    .fill(null)
    .map(async () => {
      for (const [index, item] of iterator) {
        results[index] = await fn(item);
      }
    });

  await Promise.all(workers);
  return results;
}
