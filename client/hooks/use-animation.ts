import { useRef, useState } from "react";
import { useStableCallback } from "./use-stable-callback";

export type AnimationStep<T> =
  | { state: T; duration: number }
  | { setState: (x: T) => T; duration: number }
  | { effect: () => unknown; duration: number };

export function useAnimationSteps<T>({
  state,
  setState,
  steps,
  onCompletion,
}: {
  state: T;
  setState: (x: T) => unknown;
  steps: AnimationStep<T>[];
  onCompletion: () => unknown;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const update = useStableCallback(() => {
    if (stepIndex >= steps.length) {
      onCompletion();
      setStepIndex(0);
      return;
    }
    const step = steps[stepIndex];
    if ("state" in step) {
      setState(step.state);
    } else if ("setState" in step) {
      setState(step.setState(state));
    } else if ("effect" in step) {
      step.effect();
    }

    setStepIndex((prevIndex) => prevIndex + 1);
    timeoutRef.current = setTimeout(update, step.duration);
  }, [stepIndex, steps, onCompletion, setState, state]);

  const start = useStableCallback(() => {
    setStepIndex(0);
    update();
  }, [update]);

  return { start };
}
