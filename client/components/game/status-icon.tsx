import React, { useMemo } from "react";
import { Item, Status, StatusType } from "@shared/game/types";
import { GiBabyBottle, GiHandcuffs, GiHandSaw, GiPotato } from "react-icons/gi";
import { ensureUnreachable } from "@shared/typescript";
import classNames from "classnames";

export type StatusIconProps = {
  type: Status["type"];
  size?: number;
  className?: string;
};

const StatusIcon = React.memo(function (props: StatusIconProps) {
  const { type, className, ...iconProps } = props;
  const Icon = useMemo(() => {
    switch (type) {
      case StatusType.handcuffed:
        return GiHandcuffs;
      case StatusType.slipperyHands:
        return GiBabyBottle;
      case StatusType.sawed:
        return GiHandSaw;
      case StatusType.hotPotatoReceiver:
        return GiPotato;
      default:
        ensureUnreachable(type);
    }
  }, [type]);
  const iconClassName = useMemo(() => {
    switch (type) {
      case StatusType.handcuffed:
        return "text-gray-700";
      case StatusType.sawed:
        return "text-gray-700";
      case StatusType.slipperyHands:
        return "text-blue-700";
      case StatusType.hotPotatoReceiver:
        return "text-orange-500";
      default:
        ensureUnreachable(type);
    }
  }, [type]);

  return (
    <span className={classNames(className, iconClassName)}>
      <Icon {...iconProps} />
    </span>
  );
});

StatusIcon.displayName = "StatusIcon";

export default StatusIcon;
