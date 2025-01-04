import { DependencyList, useCallback, useRef } from "react";

export function useStableCallback<I extends Array<unknown>, T>(
  cb: (...x: I) => T,
  deps: DependencyList
): (...x: I) => T {
  const cbRef = useRef<(...x: I) => T>(useCallback(cb, [cb, ...deps]));
  cbRef.current = cb;
  return useCallback((...x: I) => cbRef.current(...x), [cbRef]);
}
