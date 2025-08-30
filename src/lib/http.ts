// Lightweight HTTP helpers: retrying GET JSON and limited-concurrency map

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function httpGetJson<T>(
  url: string,
  headers: Record<string, string>,
  maxRetry = 5,
  baseDelayMs = 600,
): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(url, { headers });
    if (res.ok) {
      return (await res.json()) as T;
    }
    attempt++;
    const retryable =
      res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!retryable || attempt > maxRetry) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `HTTP ${res.status} ${res.statusText} for ${url}\n${body}`,
      );
    }
    const wait = baseDelayMs * 2 ** (attempt - 1);
    await sleep(wait);
  }
}

export async function mapWithConcurrency<T, U>(
  items: T[],
  worker: (item: T, idx: number) => Promise<U>,
  concurrency = 5,
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let i = 0;
  async function run() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    run,
  );
  await Promise.all(workers);
  return results;
}
