export function ensureUnreachable(x: never): never {
  throw new Error(`Unreachable code, got ${x}`);
}
