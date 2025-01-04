import React, { useMemo } from "react";
import { Item, Status } from "@shared/game/types";
import { GiHandcuffs } from "react-icons/gi";
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
      case "handcuffed":
        return GiHandcuffs;
      default:
        ensureUnreachable(type);
    }
  }, [type]);
  const iconClassName = useMemo(() => {
    switch (type) {
      case "handcuffed":
        return "text-gray-700";
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
