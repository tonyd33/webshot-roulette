import R from 'ramda';
import Result from './result';
import Unit from './unit';
import { z } from 'zod';

export const thenGuard =
  <X>(pred: (x: X) => boolean) =>
  (x: Result<X, Unit>): Result<X, Unit> =>
    x.andThen((xi) => (pred(xi) ? Result.ok(xi) : Result.err()));

export const catchPromise = (x: any, message?: string) => {
  if (message) return Result.err(message);
  if (x instanceof Error) return Result.err(x.message);
  else if (typeof x === 'string') return Result.err(x);
  else return Result.err('Unknown error');
};

export const pop = function <X>(
  pred: (x: X) => boolean,
  xs: X[],
): Result<[X, X[]], Unit> {
  const idx = xs.findIndex(pred);
  if (idx === -1) return Result.err();
  const item = xs[idx];
  return Result.ok([item, R.remove(idx, 1, xs)]);
};

export function transposeResArray<T extends unknown[], E>(ress: {
  [K in keyof T]: Result<T[K], E>;
}): Result<{ [K in keyof T]: T[K] }, E> {
  return ress.reduce(
    (acc: Result<unknown[], E>, c) =>
      acc.andThen((rs) => c.map((c) => [...rs, c])),
    Result.ok([]),
  ) as Result<{ [K in keyof T]: T[K] }, E>;
}

export async function invertResultPromise<X, E>(
  x: Result<Promise<X>, E>,
): Promise<Result<X, E>> {
  if (x.isOk) {
    return Result.ok(await x.value);
  } else {
    return Result.err(x.error);
  }
}

export const then =
  <X, Y>(cb: (x: X) => Y) =>
  (x: Promise<X>) =>
    x.then(cb);

export const guardPromise =
  <X>(pred: (x: X) => boolean, msg: string) =>
  (x: X) => {
    if (!pred(x)) {
      throw msg;
    }
    return x;
  };

export const unwrapOrThrow = <X, E>(x: Result<X, E>): X => {
  if (x.isOk) return x.value;
  throw x.error;
};

export function zodParseResult(schema: z.ZodTypeAny, toParse: any) {
  const result = schema.safeParse(toParse);
  return result.success ? Result.ok(result.data) : Result.err();
}

export function firstRest<X>(arr: X[]): Result<[X, X[]], string> {
  if (arr.length === 0) return Result.err('No items');
  const [first, ...rest] = arr;
  return Result.ok([first, rest]);
}

export function ensureUnreachable(x: never): Result<never, string> {
  return Result.err(`Unreachable code, got ${x}`);
}
