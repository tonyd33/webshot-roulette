import { motion } from "motion/react";
import * as R from "ramda";
import React from "react";
import { GiHalfHeart, GiHearts } from "react-icons/gi";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import classNames from "classnames";
import { AnimatePresence } from "framer-motion";
import { IconType } from "react-icons/lib";

const HEARTS_TO_DISPLAY = 5;
const HEART_SIZE = 16;

export type HealthbarProps = {
  health: number;
  maxHealth: number;
  className?: string;
};

type Heart = "empty" | "half" | "filled";

const heartToClassName: Record<Heart, string> = {
  empty: "text-gray opacity-50",
  half: "text-red-500",
  filled: "text-red-500",
};
const heartToIcon: Record<Heart, IconType> = {
  empty: GiHearts,
  half: GiHalfHeart,
  filled: GiHearts,
};

const Healthbar = React.memo(function (props: HealthbarProps) {
  const { health, maxHealth, className } = props;

  const healthBounded = Math.max(health, 0);
  const numHearts = (healthBounded / maxHealth) * HEARTS_TO_DISPLAY;
  const numFilledHearts = Math.floor(numHearts);
  const numEmptyHearts = HEARTS_TO_DISPLAY - Math.ceil(numHearts);
  const numHalfHearts = HEARTS_TO_DISPLAY - (numFilledHearts + numEmptyHearts);

  const hearts: Heart[] = [
    ...R.range(0, numEmptyHearts).map(() => "empty" as const),
    ...R.range(0, numHalfHearts).map(() => "half" as const),
    ...R.range(0, numFilledHearts).map(() => "filled" as const),
  ];

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger
          className={classNames(
            "flex flex-col items-center justify-evenly",
            className
          )}
        >
          <AnimatePresence>
            {hearts.map((heart, i) => {
              const Icon = heartToIcon[heart];
              return (
                <motion.span
                  key={`${i}_${heart}`}
                  className={heartToClassName[heart]}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <Icon size={HEART_SIZE} />
                </motion.span>
              );
            })}
          </AnimatePresence>
        </TooltipTrigger>
        <TooltipContent>
          {health}/{maxHealth}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
Healthbar.displayName = "Healthbar";

export default Healthbar;
