"use client";
import _ from "lodash";
import React, { useEffect, useState } from "react";
import { Progress } from "./ui/progress";

/**
 * Range of values to start from. 0-100. Setting different values may cause
 * NextJS to complain that hydration was mismatched on server vs client.
 */
const defaultStartRange = [50, 50] as const;
/** How fast to fill the remaining value. 0-1 */
const defaultSpeedMultRange = [0.3, 0.5] as const;
/** How fast to run each tick, milliseconds. */
const defaultTickTimeMs = 1000;

export type FakeProgressProps = {
  startRange?: [number, number];
  speedMultRange?: [number, number];
  tickTimeMs?: number;
};

const FakeProgress = React.memo(function (props: FakeProgressProps) {
  const {
    startRange = defaultStartRange,
    speedMultRange = defaultSpeedMultRange,
    tickTimeMs = defaultTickTimeMs,
  } = props;

  const [value, setValue] = useState(_.random(startRange[0], startRange[1]));

  useEffect(() => {
    const interval = setInterval(() => {
      setValue(
        (v) => v + (100 - v) * _.random(speedMultRange[0], speedMultRange[1])
      );
    }, tickTimeMs);

    return () => clearInterval(interval);
  }, [speedMultRange, tickTimeMs]);

  return <Progress value={value} />;
});
FakeProgress.displayName = "FakeProgress";

export default FakeProgress;
