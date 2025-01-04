import React from "react";
import { GiConvergenceTarget, GiPerson } from "react-icons/gi";

export type PersonProps = {
  name: string;
  enemy: boolean;
};

const Person = React.memo(function (props: PersonProps) {
  const { name, enemy } = props;
  return (
    <div className="relative flex flex-col person">
      <GiPerson className="text-purple-500" size={50} />
      {enemy && (
        <span className="absolute top-0 left-2/4 -translate-x-1/2 pulse">
          <GiConvergenceTarget size={18} />
        </span>
      )}
      <span>{name}</span>
    </div>
  );
});

Person.displayName = "Person";

export default Person;
