/**
 * Runs `worker` over `items` with at most `concurrency` in flight and returns
 * the results in input order. `onProgress(done, total)` fires after each one.
 * The first failure rejects; workers already started are left to finish.
 */
export async function runPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  let failed = false;
  const run = async () => {
    while (!failed) {
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index] as T, index);
      } catch (error) {
        failed = true;
        throw error;
      }
      done += 1;
      onProgress?.(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, run));
  return results;
}
