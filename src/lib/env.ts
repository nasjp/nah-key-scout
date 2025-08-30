export function requireEnv(name: string): string {
  const v = process.env[name];
  if (v == null || v === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}
