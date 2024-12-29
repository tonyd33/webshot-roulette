"use client";
import { Action, ActionEffect, Item, PublicGame } from "@/types/game";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { toast } from "@/hooks/use-toast";
import { useStableCallback } from "@/app/hooks/useStableCallback";
import ItemIcon from "./item-icon";
import { GiPerson, GiSawedOffShotgun } from "react-icons/gi";

export type GameProps = {
  game: PublicGame;
  fx: ActionEffect[];
  onFxChange: (fx: ActionEffect[]) => unknown;
  playerId: string;
  onUseItem: (which: number) => unknown;
  onShootPlayer: (playerId: string) => unknown;
};

const Game = function (props: GameProps) {
  const { game, fx, playerId, onUseItem, onFxChange, onShootPlayer } = props;

  const [currFx, setCurrFx] = useState<ActionEffect>();

  const me = useMemo(
    () => game.playerStates.find((x) => x.id === playerId),
    [game.playerStates, playerId]
  );
  const other = useMemo(
    () => game.playerStates.find((x) => x.id !== playerId),
    [game.playerStates, playerId]
  );

  const isMyTurn = me?.turn === game.turn;
  const interactable = fx.length === 0 && isMyTurn;

  useEffect(() => {
    if (fx.length === 0 || currFx) return;

    const [first] = fx;
    setCurrFx(first);
  }, [currFx, fx, onFxChange]);

  useEffect(() => {
    if (!currFx) return;
    toast({ description: `Playing effect ${currFx.type}` });
    setTimeout(() => {
      setCurrFx(undefined);
      onFxChange(fx.slice(1));
    }, 1000);
  }, [currFx, fx, onFxChange]);

  const handleShootMe = useStableCallback(() => {
    if (!me) {
      toast({ description: "I don't know who to shoot" });
      return;
    }
    onShootPlayer(me.id);
  }, [me, onShootPlayer]);

  const handleShootOther = useStableCallback(() => {
    const other = game.playerStates.find((x) => x.id !== me?.id);
    if (!other) {
      toast({ description: "I don't know who to shoot" });
      return;
    }
    onShootPlayer(other.id);
  }, [game.playerStates, me, onShootPlayer]);

  const shotgun = useMemo(() => <GiSawedOffShotgun />, []);

  return (
    <div>
      <div className="flex flex-row justify-center text-5xl">
        <GiPerson />
        <div className={isMyTurn ? "hidden" : ""}>{shotgun}</div>
      </div>
      <div className="grid grid-rows-2 grid-flow-col gap-4">
        {other?.items.map((item, i) => (
          <Button key={i} disabled>
            <ItemIcon item={item} />
          </Button>
        ))}
      </div>
      <div>
        <Button onClick={handleShootMe}>Shoot me</Button>
        <Button onClick={handleShootOther}>Shoot you</Button>
      </div>
      <div className="grid grid-rows-2 grid-flow-col gap-4">
        {me?.items.map((item, i) => (
          <Button
            key={i}
            onClick={() => onUseItem(i)}
            disabled={item === Item.nothing || !interactable}
          >
            <ItemIcon item={item} />
          </Button>
        ))}
      </div>
      <div className="flex flex-row justify-center text-5xl">
        <GiPerson />
        <div className={!isMyTurn ? "hidden" : ""}>{shotgun}</div>
      </div>
    </div>
  );
};

// const Game = function (props: GameProps) {
// const pixiContainer = useRef<HTMLDivElement>(null);
// const app = useRef<PIXI.Application<PIXI.Renderer<HTMLCanvasElement>>>(null);

// useEffect(() => {
// (async () => {
// app.current = new PIXI.Application<PIXI.Renderer<HTMLCanvasElement>>();
// await app.current?.init({
// width: 800,
// height: 600,
// // resizeTo: window,
// background: "#1099bb",
// });
// pixiContainer.current?.appendChild(app.current?.canvas);
// const [garyTexture, bareTexture, gunTexture] = await Promise.all([
// PIXI.Assets.load("/sprites/gary/gary.png"),
// PIXI.Assets.load("/sprites/bare/bare.png"),
// PIXI.Assets.load("/sprites/gun/gun.png"),
// ]);
// const gary = new PIXI.Sprite(garyTexture);
// const bare = new PIXI.Sprite(bareTexture);
// const gun = new PIXI.Sprite(gunTexture);

// gary.anchor.set(0.5);
// gary.x = 50;
// gary.y = 100;
// app.current.stage.addChild(gary);

// bare.anchor.set(0.5);
// bare.x = 200
// bare.y = 100;
// app.current.stage.addChild(bare);

// gun.anchor.set(0.5);
// gun.x = 100;
// gun.y = 100;
// app.current.stage.addChild(gun);

// pixiContainer.current?.appendChild(app.current?.canvas);
// })();

// // Cleanup on component unmount
// return () => {
// app.current?.destroy(true, true);
// };
// }, []);

// return <div ref={pixiContainer} />;
// };

export default Game;
