import { motion } from "motion/react";
import ItemIcon from "./item-icon";
import { Action, ActionType, Item } from "@shared/game/types";
import { ensureUnreachable } from "@shared/typescript";
import { useStableCallback } from "@/hooks/use-stable-callback";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

type ItemButtonProps = {
  item: Item;
  meId: string;
  otherId: string;
  slot: number;
  onUseItem: (x: Extract<Action, { type: "useItem" }>) => unknown;
  disabled: boolean;
};

const itemTooltip: Record<Item, string> = {
  [Item.pop]: "Reveal and discard the next bullet.",
  [Item.magnifyingGlass]: "Reveal the next bullet.",
  [Item.apple]: "Heal 1HP.",
  [Item.handcuff]: "Skip the opponent's next turn.",
  [Item.nothing]: "Nothing here, wait for the next round!",
};

const ItemButton = React.memo(function (props: ItemButtonProps) {
  const { item, onUseItem, otherId, slot, disabled } = props;
  const handleClick = useStableCallback(() => {
    switch (item) {
      case Item.apple:
      case Item.magnifyingGlass:
      case Item.pop:
        onUseItem({ type: ActionType.useItem, which: slot, item });
        break;
      case Item.handcuff:
        onUseItem({
          type: ActionType.useItem,
          which: slot,
          item,
          who: otherId,
        });
        break;
      case Item.nothing:
        break;
      default:
        ensureUnreachable(item);
    }
  }, [item, onUseItem, otherId, slot]);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger className="rounded p-2 w-16 h-16" asChild>
          <motion.span
            className="inline-flex items-center justify-center"
            key={item}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <button
              onClick={handleClick}
              disabled={disabled || item === Item.nothing}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 px-4 py-2 w-10 h-10 hover:animate-pulse"
            >
              <ItemIcon item={item} size={32} />
            </button>
          </motion.span>
        </TooltipTrigger>
        <TooltipContent>{itemTooltip[item]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
ItemButton.displayName = "ItemButton";

export default ItemButton;
