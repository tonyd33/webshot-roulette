import React, { useMemo } from "react";
import { Item } from "@shared/game/types";
import {
  GiBodySwapping,
  GiCardboardBox,
  GiHandcuffs,
  GiHandSaw,
  GiMagnifyingGlass,
  GiPotato,
  GiShinyApple,
  GiSodaCan,
} from "react-icons/gi";
import { ensureUnreachable } from "@shared/typescript";
import classNames from "classnames";

export type ItemIconProps = {
  item: Item;
  size?: number;
  className?: string;
};

const ItemIcon = React.memo(function (props: ItemIconProps) {
  const { item, className, ...iconProps } = props;
  const Icon = useMemo(() => {
    switch (item) {
      case Item.apple:
        return GiShinyApple;
      case Item.magnifyingGlass:
        return GiMagnifyingGlass;
      case Item.pop:
        return GiSodaCan;
      case Item.handcuff:
        return GiHandcuffs;
      case Item.handsaw:
        return GiHandSaw;
      case Item.hotPotato:
        return GiPotato;
      case Item.inverter:
        return GiBodySwapping;
      case Item.nothing:
        return GiCardboardBox;
      default:
        ensureUnreachable(item);
    }
  }, [item]);
  const iconClassName = useMemo(() => {
    switch (item) {
      case Item.apple:
        return "text-red-600";
      case Item.magnifyingGlass:
        return "text-blue-600";
      case Item.pop:
        return "text-orange-500";
      case Item.handcuff:
        return "text-gray-700";
      case Item.handsaw:
        return "text-gray-700";
      case Item.nothing:
        return "text-slate-500";
      case Item.hotPotato:
        return "text-orange-500";
      case Item.inverter:
        return "text-gray-700";
      default:
        ensureUnreachable(item);
    }
  }, [item]);

  return (
    <span className={classNames(className, iconClassName)}>
      <Icon {...iconProps} />
    </span>
  );
});

ItemIcon.displayName = "ItemIcon";

export default ItemIcon;
