type Handlers<
  ObjT,
  DiscriminatorName extends keyof ObjT,
  ValueT
> = ObjT[DiscriminatorName] extends string | number
  ? {
      [Discriminator in ObjT[DiscriminatorName]]: (
        action: Extract<ObjT, Record<DiscriminatorName, Discriminator>>
      ) => ValueT;
    }
  : never;

export function matchlike<ObjT>(
  obj: ObjT
): <K extends keyof ObjT>(
  discriminator: K
) => <V>(cases: Handlers<ObjT, K, V>) => V {
  return (discriminator) => (cases) => {
    const handler = cases[obj[discriminator]];
    if (typeof handler === "function") {
      return handler(obj);
    } else {
      throw new Error(`Unhandled discriminator: ${obj[discriminator]}`);
    }
  };
}

export function ensureUnreachable(x: never): never {
  throw new Error(`Unreachable code, got ${x}`);
}
