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
  let nextIndex = 0;

  const workerCount = Math.min(limit, items.length);
  const workers = new Array(workerCount);

  for (let i = 0; i < workerCount; i++) {
    workers[i] = (async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        const item = items[index]!;
        results[index] = await fn(item);
      }
    })();
  }

  await Promise.all(workers);
  return results;
}
