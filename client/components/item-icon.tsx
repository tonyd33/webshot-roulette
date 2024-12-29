import React, { useMemo } from "react";
import { Item } from "../types/game";
import {
  GiCardboardBox,
  GiMagnifyingGlass,
  GiShinyApple,
  GiSodaCan,
} from "react-icons/gi";
import { ensureUnreachable } from "@/lib/typescript";

export type ItemIconProps = {
  item: Item;
};

const ItemIcon = React.memo(function (props: ItemIconProps) {
  const Icon = useMemo(() => {
    switch (props.item) {
      case Item.apple:
        return GiShinyApple;
      case Item.magnifyingGlass:
        return GiMagnifyingGlass;
      case Item.pop:
        return GiSodaCan;
      case Item.nothing:
        return GiCardboardBox;
      default:
        ensureUnreachable(props.item);
    }
  }, [props.item]);

  return <Icon />;
});

ItemIcon.displayName = "ItemIcon";

export default ItemIcon;
