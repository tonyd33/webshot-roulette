import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cycleList<X>(list: X[]) {
  return {
    take: (n: number) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        out.push(list[i % list.length]);
      }
      return out;
    },
  };
}
