import classNames from "classnames";
import * as R from "ramda";
import { Status, StatusType } from "@shared/game/types";
import React, { useMemo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import StatusIcon from "./status-icon";
import { motion } from "motion/react";
import { FaChevronCircleDown, FaChevronCircleUp } from "react-icons/fa";
import { useStableCallback } from "@/hooks/use-stable-callback";

const MAX_ITEMS_PER_PAGE = 2;

type StatusDisplayProps = Pick<Status, "type" | "turns"> & {
  className?: string;
};

const statusTooltip: Record<StatusType, string> = {
  [StatusType.handcuffed]: "Player's turn will be skipped.",
  [StatusType.sawed]: "Player's next shot will deal double damage.",
  [StatusType.slipperyHands]: "Player cannot be handcuffed.",
  [StatusType.hotPotatoReceiver]:
    "Player will receive the hot potato. If inventory is full, damage is taken instead.",
};

const StatusDisplay = React.memo(function (props: StatusDisplayProps) {
  const { type, turns, className } = props;
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger
          className={classNames(
            "relative flex items-center justify-center bg-slate-200 rounded-full",
            carouselItemSizeClass,
            className
          )}
        >
          <StatusIcon type={type} size={24} />
          <span className="absolute -top-1 -right-3 -translate-x-1 text-[10px] leading-[12px] text-white p-0.5 border border-black rounded-[50%] bg-black w-4 h-4">
            {turns ?? "∞"}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusTooltip[type]}</p>
          <p>{turns ?? "∞"} turn(s) remaining.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
StatusDisplay.displayName = "StatusDisplay";

const carouselItemSizeClass = "w-8 h-8";
const carouselItemClass = classNames(carouselItemSizeClass, "my-2");
const carouselNavClass = "disabled:opacity-50";

export type StatusCarouselProps = {
  statuses: Status[];
  className?: string;
};

const FillerStatus = () => (
  <div
    className={classNames(
      carouselItemClass,
      "text-sm text-gray-400 inline-flex items-center justify-center"
    )}
  >
    N/A
  </div>
);

const StatusCarousel = React.memo(function (props: StatusCarouselProps) {
  const { statuses, className } = props;
  const pages = useMemo(
    () => R.splitEvery(MAX_ITEMS_PER_PAGE, statuses),
    [statuses]
  );
  const [page, setPage] = useState(0);
  const handlePageUp = useStableCallback(
    () => setPage((prevPage) => prevPage - 1),
    []
  );
  const handlePageDown = useStableCallback(
    () => setPage((prevPage) => prevPage + 1),
    []
  );
  const upButtonDisabled = page <= 0;
  const downButtonDisabled = page >= pages.length - 1;
  const displayInfo = useMemo(() => {
    const statusesOnPage = (pages[page] ?? []).map((status) => ({
      type: "status" as const,
      key: `${status.index}_${status.turns}`,
      status,
    }));
    const filler = R.range(statusesOnPage.length, MAX_ITEMS_PER_PAGE).map(
      (i) => ({
        type: "filler" as const,
        key: i,
      })
    );
    return [...statusesOnPage, ...filler];
  }, [page, pages]);

  return (
    <div
      className={classNames(
        "flex flex-col items-center justify-evenly",
        className
      )}
    >
      <button
        onClick={handlePageUp}
        disabled={upButtonDisabled}
        className={carouselNavClass}
      >
        <FaChevronCircleUp />
      </button>
      <div className="flex flex-col items-center -my-2">
        {displayInfo.map((item) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.5 }}
            className={classNames(carouselItemClass)}
          >
            {item.type === "status" ? (
              <StatusDisplay {...item.status} />
            ) : (
              <FillerStatus />
            )}
          </motion.div>
        ))}
      </div>
      <button
        onClick={handlePageDown}
        disabled={downButtonDisabled}
        className={carouselNavClass}
      >
        <FaChevronCircleDown />
      </button>
    </div>
  );
});
StatusCarousel.displayName = "StatusCarousel";

export default StatusCarousel;
