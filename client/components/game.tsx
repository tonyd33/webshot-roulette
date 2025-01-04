"use client";
import * as R from "ramda";
import useSound from "use-sound";
import {
  Action,
  ActionType,
  Item,
  PlayerId,
  PublicGame,
  PublicGameDelta,
} from "@shared/game/types";
import { SetStateAction, useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useStableCallback } from "@/hooks/use-stable-callback";
import GameLayout, { EphemeralGameLayout } from "./game-layout";
import { ensureUnreachable } from "@shared/typescript";
import { AnimationStep, useAnimationSteps } from "@/hooks/use-animation";

export type GameProps = {
  /** A list of deltas that are consumed in this component */
  deltas: PublicGameDelta[];
  /** Notify parent upon successful consumption */
  onPopDelta: () => unknown;
  me: string;
  onUseItem: (useItem: Extract<Action, { type: "useItem" }>) => unknown;
  onShootPlayer: (playerId: string) => unknown;
  onPass: () => unknown;
};

const Game = function (props: GameProps) {
  const {
    deltas,
    me: playerId,
    onUseItem,
    onPopDelta,
    onShootPlayer,
    onPass,
  } = props;

  const [currGameDelta, setCurrGameDelta] = useState<PublicGameDelta>();
  const [game, setGame] = useState<PublicGame>();
  const [ephemeral, setEphemeral] = useState<EphemeralGameLayout>({});

  const me = useMemo(
    () => game?.playerStates.find((x) => x.id === playerId),
    [game?.playerStates, playerId]
  );
  const other = useMemo(
    () => game?.playerStates.find((x) => x.id !== playerId),
    [game?.playerStates, playerId]
  );

  const isMyTurn = me?.turn === game?.turn;
  const interactable = deltas.length === 0 && isMyTurn;

  const handlePop = useStableCallback(() => {
    setGame(currGameDelta?.game);
    setCurrGameDelta(undefined);
    setEphemeral({});
    // Without the `setTimeout`, I get an error saying a component cannot be
    // updated from another component or something.
    onPopDelta();
  }, [currGameDelta?.game, onPopDelta]);

  const { reload: startReloadAnimation } = useBulletsAnimation({
    ephemeral,
    setEphemeral,
    onCompletion: handlePop,
    holdInitialInterval: 1500,
  });
  const { shoot: startShootAnimation } = useShootAnimation({
    ephemeral,
    setEphemeral,
    onCompletion: handlePop,
  });
  const { eat: startEatAnimation } = useEatAnimation({
    setEphemeral,
    onCompletion: handlePop,
  });

  // Dequeue a delta into currGameDelta
  useEffect(() => {
    // only when there are deltas and we aren't currently processing a delta.
    if (deltas.length === 0 || currGameDelta) return;

    const [first] = deltas;
    // The first delta is skipped. We immediately set the game
    if (!game) {
      setGame(first.game);
    } else {
      setCurrGameDelta(first);
    }
  }, [currGameDelta, deltas, game]);

  // When a delta is received, play an animation. Upon success, set the
  // current game to the result of the delta and notify that the delta
  // has been consumed.
  useEffect(() => {
    if (!currGameDelta) return;

    const delta = currGameDelta.delta;
    switch (delta.type) {
      case "noop":
        handlePop();
        break;
      case "pass":
        handlePop();
        break;
      case "shoot":
        startShootAnimation(delta.who, delta.hurt);
        break;
      case "inspect":
        // honestly this should use a different animation but fuck it
        // TODO: Create a different animation
        setEphemeral({
          bullets: {
            live: delta.bullet === "live" ? 1 : 0,
            blank: delta.bullet === "blank" ? 1 : 0,
          },
        });
        startReloadAnimation({
          live: delta.bullet === "live" ? 1 : 0,
          blank: delta.bullet === "blank" ? 1 : 0,
        });
        break;
      case "pop":
        // honestly this should use a different animation but fuck it
        // TODO: Create a different animation
        setEphemeral({
          bullets: {
            live: delta.bullet === "live" ? 1 : 0,
            blank: delta.bullet === "blank" ? 1 : 0,
          },
        });
        startReloadAnimation({
          live: delta.bullet === "live" ? 1 : 0,
          blank: delta.bullet === "blank" ? 1 : 0,
        });
        break;
      case "nomnom":
        startEatAnimation();
        break;
      case "statusChanges":
        setTimeout(handlePop, 500);
        break;
      case "itemChanges":
        setTimeout(handlePop, 50);
        break;
      case "reload":
        startReloadAnimation({ live: delta.lives, blank: delta.blanks });
        break;
      case "gg":
        toast({ description: `Playing effect ${currGameDelta.delta.type}` });
        setTimeout(handlePop, 1000);
        break;
      default:
        ensureUnreachable(delta);
    }
  }, [
    currGameDelta,
    handlePop,
    startShootAnimation,
    startReloadAnimation,
    startEatAnimation,
  ]);

  const handleShoot = useStableCallback(
    (who: "me" | "other") => {
      if (who === "me") {
        if (!me) {
          toast({ description: "I don't know who to shoot" });
          return;
        }
        onShootPlayer(me.id);
      } else if (who === "other") {
        if (!other) {
          toast({ description: "I don't know who to shoot" });
          return;
        }
        onShootPlayer(other.id);
      }
    },
    [me, onShootPlayer, other]
  );

  return (
    me &&
    other && (
      <GameLayout
        me={me}
        other={other}
        onUseItem={onUseItem}
        interactable={interactable}
        onPass={onPass}
        onShoot={handleShoot}
        isMyTurn={isMyTurn}
        ephemeral={ephemeral}
      />
    )
  );
};

function useEatAnimation({
  onCompletion,
}: {
  setEphemeral: React.Dispatch<SetStateAction<EphemeralGameLayout>>;
  onCompletion: () => unknown;
}) {
  const [playEat] = useSound("/sounds/nomnom.mp3", {
    volume: 0.25,
    onend: onCompletion,
  });
  const eat = useStableCallback(() => {
    playEat();
  }, [playEat]);

  return { eat };
}

function useShootAnimation({
  ephemeral,
  setEphemeral,
  onCompletion,
}: {
  ephemeral: EphemeralGameLayout;
  setEphemeral: React.Dispatch<SetStateAction<EphemeralGameLayout>>;
  onCompletion: () => unknown;
}) {
  const [animationSteps, setAnimationSteps] = useState<
    AnimationStep<EphemeralGameLayout>[]
  >([]);

  const [playShoot, { duration: shootSoundDuration }] = useSound(
    "/sounds/shotgun-fire.mp3",
    { volume: 0.25 }
  );
  const [playEmpty, { duration: emptySoundDuration }] = useSound(
    "/sounds/shotgun-empty.mp3",
    { volume: 0.25 }
  );

  const { start } = useAnimationSteps({
    state: ephemeral,
    setState: setEphemeral,
    steps: animationSteps,
    onCompletion,
  });

  const shoot = useStableCallback(
    (target: PlayerId, dmg: number) => {
      setAnimationSteps([
        { state: { targeting: [target] }, duration: 500 },
        { state: { targeting: [] }, duration: 500 },
        { state: { targeting: [target] }, duration: 500 },
        dmg > 0
          ? { effect: playShoot, duration: shootSoundDuration ?? 1000 }
          : { effect: playEmpty, duration: emptySoundDuration ?? 1000 },
      ]);

      setTimeout(start, 1);
    },
    [emptySoundDuration, playEmpty, playShoot, shootSoundDuration, start]
  );

  return { shoot };
}

function useBulletsAnimation({
  ephemeral,
  setEphemeral,
  onCompletion,
  holdInitialInterval,
}: {
  ephemeral: EphemeralGameLayout;
  setEphemeral: React.Dispatch<SetStateAction<EphemeralGameLayout>>;
  onCompletion: () => unknown;
  holdInitialInterval: number;
}) {
  const [animationSteps, setAnimationSteps] = useState<
    AnimationStep<EphemeralGameLayout>[]
  >([]);

  const [playLoadShotgun, { duration: playLoadShotgunDuration }] = useSound(
    "/sounds/shotgun-cock.mp3",
    { volume: 0.25 }
  );

  const { start } = useAnimationSteps({
    state: ephemeral,
    setState: setEphemeral,
    steps: animationSteps,
    onCompletion,
  });

  const reload = useStableCallback(
    ({ live, blank }: { live: number; blank: number }) => {
      const steps = [
        { state: { bullets: { live, blank } }, duration: holdInitialInterval },
        ...R.range(1, live + blank).flatMap(
          (i): AnimationStep<EphemeralGameLayout>[] => {
            const liveNow = R.clamp(0, live, live - i);
            const blankNow = live + blank - liveNow - i;

            return [
              {
                state: {
                  bullets: { live: liveNow, blank: blankNow },
                },
                duration: 1,
              },
              {
                effect: playLoadShotgun,
                duration: playLoadShotgunDuration ?? 1000,
              },
            ];
          }
        ),
      ];
      setAnimationSteps(steps);

      setTimeout(start, 1);
    },
    [holdInitialInterval, playLoadShotgun, playLoadShotgunDuration, start]
  );

  return { reload };
}

export default Game;
