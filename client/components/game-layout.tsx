import * as R from "ramda";
import { Action, PlayerId, PlayerState } from "@shared/game/types";
import React from "react";
import PlayerBoard from "./player-board";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStableCallback } from "@/hooks/use-stable-callback";
import { GiSawedOffShotgun, GiShotgunRounds } from "react-icons/gi";

export type GameLayoutProps = {
  me: PlayerState;
  other: PlayerState;

  interactable: boolean;
  isMyTurn: boolean;

  onUseItem: (x: Extract<Action, { type: "useItem" }>) => unknown;
  onPass: () => unknown;
  onShoot: (who: "me" | "other") => unknown;

  ephemeral: EphemeralGameLayout;
};

/** Properties that are supposed to be used for effects */
export type EphemeralGameLayout = {
  bullets?: { live: number; blank: number };
  targeting?: PlayerId[];
};

const Shotgun = () => (
  <GiSawedOffShotgun className="text-amber-900" size={64} />
);

const GameLayout = React.memo(function (props: GameLayoutProps) {
  const {
    me,
    other,
    interactable,
    onUseItem,
    onPass,
    onShoot,
    isMyTurn,
    ephemeral,
  } = props;
  const handleShootMe = useStableCallback(() => onShoot("me"), [onShoot]);
  const handleShootOther = useStableCallback(() => onShoot("other"), [onShoot]);

  return (
    <div className="flex flex-col space-y-4">
      <PlayerBoard
        me={other}
        other={me}
        interactable={false}
        onUseItem={onUseItem}
        targeted={ephemeral?.targeting?.includes(other.id)}
        thinking={!isMyTurn}
      />
      <div className="flex flex-row justify-start items-center">
        <Shotgun />
        {ephemeral?.bullets?.live && ephemeral.bullets.live > 0
          ? R.range(0, ephemeral.bullets.live).map((i) => (
              <GiShotgunRounds key={i} color="red" size={24} />
            ))
          : null}
        {ephemeral?.bullets?.blank && ephemeral.bullets.blank > 0
          ? R.range(0, ephemeral.bullets.blank).map((i) => (
              <GiShotgunRounds key={i} color="orange" size={24} />
            ))
          : null}
      </div>
      <div className="flex flex-row justify-center items-center space-x-4">
        <DropdownMenu>
          <DropdownMenuTrigger disabled={!interactable} asChild>
            <Button>Shoot</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleShootMe}>Myself</DropdownMenuItem>
            <DropdownMenuItem onClick={handleShootOther}>
              Other
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={onPass} disabled={!interactable}>
          Pass
        </Button>
      </div>
      <PlayerBoard
        me={me}
        other={other}
        interactable={interactable}
        onUseItem={onUseItem}
        targeted={ephemeral?.targeting?.includes(me.id)}
        thinking={isMyTurn && interactable}
      />
    </div>
  );
});

GameLayout.displayName = "GameLayout";

export default GameLayout;
