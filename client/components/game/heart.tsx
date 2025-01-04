import React from "react";
import { GiHearts } from "react-icons/gi";

export type HeartProps = {
  num: number;
};

const Heart = React.memo(function (props: HeartProps) {
  const { num } = props;
  return (
    <div className="relative">
      <GiHearts className="text-heart" size={50} />
      <span className="absolute inset-0 flex flex-row justify-center items-center text-white">
        {num}
      </span>
    </div>
  );
});

Heart.displayName = "Heart";

export default Heart;
