"use client";
import { motion } from "motion/react";
import _ from "lodash";
import * as R from "ramda";
import { Action, PlayerState } from "@shared/game/types";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import StatusCarousel from "./status-carousel";
import ItemButton from "./item-button";
import Healthbar from "./healthbar";
import { AnimatePresence } from "framer-motion";
import { GiCrosshair } from "react-icons/gi";
import { useHighlight } from "@/hooks/use-highlight";

export type PlayerBoardProps = {
  me: PlayerState;
  other: PlayerState;
  interactable: boolean;
  onUseItem: (x: Extract<Action, { type: "useItem" }>) => unknown;
  targeted?: boolean;
  thinking?: boolean;
  highlightPicture?: boolean;
};

const PlayerBoard = React.memo(function (props: PlayerBoardProps) {
  const {
    me,
    other,
    interactable,
    onUseItem,
    targeted,
    thinking,
    highlightPicture,
  } = props;
  const thinkingInterval = useRef<NodeJS.Timeout>(null);
  const [numThinkingDots, setNumThinkingDots] = useState(1);

  const { highlight, clear } = useHighlight();

  const meHighlightId = `${me.id}_highlight`;

  useEffect(() => {
    if (highlightPicture) highlight(meHighlightId);
    else clear();
  }, [clear, highlight, highlightPicture, meHighlightId]);

  useEffect(() => {
    if (!thinking && thinkingInterval.current) {
      clearInterval(thinkingInterval.current);
      return;
    }

    thinkingInterval.current = setInterval(() => {
      setNumThinkingDots((prev) => (prev + 1) % 3);
    }, 1000);

    return () => {
      if (thinkingInterval.current) {
        clearInterval(thinkingInterval.current);
      }
    };
  }, [thinking]);

  return (
    <div className="flex flex-row items-center space-x-2 p-2 justify-evenly border border-4 border-black rounded-sm bg-slate-500">
      <div
        className="flex flex-col items-center justify-center bg-slate-300 basis-1/4 rounded h-32 relative"
        id={meHighlightId}
      >
        <Image
          src={`https://api.dicebear.com/9.x/dylan/svg?seed=${me.id}`}
          width={100}
          height={100}
          alt="Icon of me"
        />
        <span className="-mt-4 bg-white border border-white rounded text-xs p-0.5 w-[100px] text-center whitespace-nowrap break-all overflow-hidden text-ellipsis">
          {me.id}
        </span>
        {/* FUCK I DONT KNOW WHY THE EXIT ANIMATION ISNT PLAYING EVEN THOUGH ITS */}
        {/* BASICALLY EXACTLY THE SAME AS THE EXAMPLE ON MOTION DOCS */}
        {/* TODO: Fix exit animation */}
        <AnimatePresence>
          {targeted ? (
            <motion.div
              className="absolute top-[25%] left-50"
              key={`${targeted}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <GiCrosshair size={64} color="red" />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {thinking && (
            <motion.span
              className="absolute top-0 left-50 rounded bg-white p-2 text-xs min-w-10 text-center"
              key={numThinkingDots}
              exit={{ opacity: 0 }}
            >
              {R.repeat("•", numThinkingDots + 1).join(" ")}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <Healthbar
        health={me.health}
        maxHealth={10}
        className="bg-slate-300 rounded p-2 h-32 basis-[12.5%]"
      />
      <StatusCarousel
        statuses={me.statuses}
        className="bg-slate-300 rounded p-2 h-32 basis-[12.5%]"
      />
      <div className="grid grid-rows-2 grid-cols-4 gap-4 p-2 m-4 basis-3/4 bg-slate-300 rounded items-center justify-items-center h-32">
        <AnimatePresence>
          {me?.items.map((item, i) => (
            <ItemButton
              key={i}
              item={item}
              slot={i}
              meId={me.id}
              otherId={other.id}
              onUseItem={onUseItem}
              disabled={!interactable}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});

PlayerBoard.displayName = "PlayerBoard";

export default PlayerBoard;
