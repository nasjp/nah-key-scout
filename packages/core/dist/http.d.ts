export declare function sleep(ms: number): Promise<void>;
export declare function httpGetJson<T>(url: string, headers: Record<string, string>, maxRetry?: number, baseDelayMs?: number): Promise<T>;
export declare function mapWithConcurrency<T, U>(items: T[], worker: (item: T, idx: number) => Promise<U>, concurrency?: number): Promise<U[]>;
