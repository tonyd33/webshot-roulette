import {
  GameSettings,
  PlayerId,
  WaitingLobby as WaitingLobbyType,
} from "@shared/game/types";
import React from "react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import classNames from "classnames";
import { FaChevronDown, FaChevronUp, FaCopy, FaCrown } from "react-icons/fa";
import { useStableCallback } from "@/hooks/use-stable-callback";
import SettingsDialogButton from "./settings-dialog-button";

export type WaitingLobbyProps = {
  lobby: WaitingLobbyType;
  onStart: () => unknown;
  me?: PlayerId;
  creator?: PlayerId;
  onChangeActivity: (to: "active" | "spectate") => unknown;
  onChangeSettings: (settings: Partial<GameSettings>) => unknown;
};

const PlayersList = React.memo(function (props: {
  players: PlayerId[];
  me?: PlayerId;
  creator?: PlayerId;
  className?: string;
}) {
  const { players, className, me, creator } = props;
  return (
    <ul className={classNames("space-y-4", className)}>
      {players.map((player) => (
        <li key={player} className="flex flex-row items-center space-x-2">
          <span className="relative">
            <Avatar>
              <AvatarImage
                src={`https://api.dicebear.com/9.x/dylan/svg?seed=${player}`}
              />
              <AvatarFallback>{player}</AvatarFallback>
            </Avatar>
            {player === creator && (
              <span
                className={"absolute -top-1 -translate-x-2 text-yellow-600"}
              >
                <FaCrown size={20} />
              </span>
            )}
          </span>
          <span>
            {player}
            {player === me && <span className="font-bold"> (me)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
});
PlayersList.displayName = "PlayersList";

const WaitingLobby = React.memo(function (props: WaitingLobbyProps) {
  const { lobby, onStart, me, creator, onChangeActivity, onChangeSettings } =
    props;
  const handleChangePlaying = useStableCallback(
    () => onChangeActivity("active"),
    [onChangeActivity]
  );
  const handleChangeSpectating = useStableCallback(
    () => onChangeActivity("spectate"),
    [onChangeActivity]
  );

  const handleCopy = useStableCallback(() => {
    navigator.clipboard.writeText(window.location.href);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center space-y-6">
      <div className="flex flex-row items-center space-x-4">
        <Button onClick={handleCopy} variant="ghost" className="text-lg">
          <span>{window.location.href}</span>
          <FaCopy />
        </Button>
      </div>
      <div
        className={classNames("grow text-center", {
          "opacity-50": me && !lobby.players.includes(me),
        })}
      >
        <h1 className="text-xl underline decoration-wavy">Playing</h1>
        <PlayersList players={lobby.players} me={me} creator={creator} />
      </div>
      <div className="flex flex-row items-center space-x-4">
        <Button size="icon" onClick={handleChangePlaying}>
          <FaChevronUp />
        </Button>
        <Button size="lg" onClick={onStart}>
          Start
        </Button>
        <SettingsDialogButton
          onChangeSettings={onChangeSettings}
          settings={lobby.settings}
          canSave={creator === me}
        />
        <Button size="icon" onClick={handleChangeSpectating}>
          <FaChevronDown />
        </Button>
      </div>
      {lobby.spectators.length > 0 && (
        <div
          className={classNames("grow text-center", {
            "opacity-50": me && !lobby.spectators.includes(me),
          })}
        >
          <h1 className="text-xl underline decoration-wavy">Spectating</h1>
          <PlayersList players={lobby.spectators} me={me} creator={creator} />
        </div>
      )}
    </div>
  );
});
WaitingLobby.displayName = "WaitingLobby";

export default WaitingLobby;
