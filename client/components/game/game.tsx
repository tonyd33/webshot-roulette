"use client";
import * as R from "ramda";
import useSound from "use-sound";
import {
  Action,
  Bullet,
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
  const { pass: startPassAnimation } = usePassAnimation({
    setEphemeral,
    onCompletion: handlePop,
  });
  const { pop: startPopAnimation } = usePopAnimation({
    ephemeral,
    setEphemeral,
    onCompletion: handlePop,
  });
  const { inspect: startInspectAnimation } = useInspectAnimation({
    ephemeral,
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
        startPassAnimation();
        break;
      case "shoot":
        startShootAnimation(delta.who, delta.hurt);
        break;
      case "inspect":
        startInspectAnimation(delta.bullet);
        break;
      case "pop":
        startPopAnimation(delta.bullet);
        break;
      case "nomnom":
        startEatAnimation();
        break;
      case "hurt":
        handlePop();
        break;
      case "inverted":
        toast({ description: `Playing effect ${currGameDelta.delta.type}` });
        setTimeout(handlePop, 1000);
        break;
      case "statusChanges":
        setTimeout(handlePop, 10);
        break;
      case "itemChanges":
        setTimeout(handlePop, 10);
        break;
      case "reload":
        startReloadAnimation({ live: delta.lives, blank: delta.blanks });
        break;
      case "gg":
        toast({
          title: "Game finished",
          description: `${delta.winner} has won!`,
        });
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
    startPassAnimation,
    startPopAnimation,
    startInspectAnimation,
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

function usePassAnimation({
  onCompletion,
}: {
  setEphemeral: React.Dispatch<SetStateAction<EphemeralGameLayout>>;
  onCompletion: () => unknown;
}) {
  const [playPass] = useSound("/sounds/pass.mp3", {
    volume: 0.25,
    onend: onCompletion,
  });
  const pass = useStableCallback(() => {
    playPass();
  }, [playPass]);

  return { pass };
}

function usePopAnimation({
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

  const [playPop] = useSound("/sounds/pop.mp3", { volume: 0.25 });

  const { start } = useAnimationSteps({
    state: ephemeral,
    setState: setEphemeral,
    steps: animationSteps,
    onCompletion,
  });

  const pop = useStableCallback(
    (bullet: Bullet) => {
      setAnimationSteps([
        { effect: playPop, duration: 1 },
        {
          state: {
            bullets:
              bullet === "live" ? { live: 1, blank: 0 } : { blank: 1, live: 0 },
          },
          duration: 2000,
        },
      ]);

      setTimeout(start, 1);
    },
    [playPop, start]
  );

  return { pop };
}

function useInspectAnimation({
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

  const [playInspect] = useSound("/sounds/inspect.mp3", { volume: 0.25 });

  const { start } = useAnimationSteps({
    state: ephemeral,
    setState: setEphemeral,
    steps: animationSteps,
    onCompletion,
  });

  const inspect = useStableCallback(
    (bullet: Bullet) => {
      setAnimationSteps([
        { effect: playInspect, duration: 1 },
        {
          state: {
            bullets:
              bullet === "live" ? { live: 1, blank: 0 } : { blank: 1, live: 0 },
          },
          duration: 2000,
        },
      ]);

      setTimeout(start, 1);
    },
    [playInspect, start]
  );

  return { inspect };
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
  const [playLockOn] = useSound("/sounds/lock-on.mp3", { volume: 0.25 });

  const { start } = useAnimationSteps({
    state: ephemeral,
    setState: setEphemeral,
    steps: animationSteps,
    onCompletion,
  });

  const shoot = useStableCallback(
    (target: PlayerId, dmg: number) => {
      setAnimationSteps([
        { effect: playLockOn, duration: 1 },
        {
          state: {
            targeting: [target],
            highlight: { type: "player", playerId: target },
          },
          duration: 500,
        },
        {
          state: {
            targeting: [],
            highlight: { type: "player", playerId: target },
          },
          duration: 500,
        },
        {
          state: {
            targeting: [target],
            highlight: { type: "player", playerId: target },
          },
          duration: 750,
        },
        dmg > 0
          ? {
              setState: (x) => {
                playShoot();
                return { ...x, bullets: { live: 1, blank: 0 } };
              },
              duration: shootSoundDuration ?? 1000,
            }
          : {
              setState: (x) => {
                playEmpty();
                return { ...x, bullets: { live: 0, blank: 1 } };
              },
              duration: emptySoundDuration ?? 1000,
            },
      ]);

      setTimeout(start, 1);
    },
    [
      emptySoundDuration,
      playEmpty,
      playLockOn,
      playShoot,
      shootSoundDuration,
      start,
    ]
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
        ...R.range(0, live + blank).flatMap(
          (i): AnimationStep<EphemeralGameLayout>[] => {
            const liveNow = R.clamp(0, live, live - i);
            const blankNow = live + blank - liveNow - i;

            return [
              {
                state: {
                  bullets: { live: liveNow, blank: blankNow },
                },
                duration: i === 0 ? holdInitialInterval : 1,
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
