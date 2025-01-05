import {
  Action,
  GameDelta,
  Lobby,
  PlayerId,
  PublicGameDelta,
} from "@shared/game/types";
import React from "react";
import WaitingLobby from "./waiting-lobby";
import { ensureUnreachable } from "@shared/typescript";
import Game from "./game";

export type LobbyScreenProps = {
  lobby: Lobby;

  me: PlayerId;
  onChangeActivity: (to: "spectate" | "active") => unknown;
  onStart: () => unknown;

  deltas: PublicGameDelta[];
  onPopDelta: () => unknown;
  onUseItem: (useItem: Extract<Action, { type: "useItem" }>) => unknown;
  onShootPlayer: (playerId: string) => unknown;
  onPass: () => unknown;
};

const LobbyScreen = React.memo(function (props: LobbyScreenProps) {
  const {
    lobby,
    onChangeActivity,
    onStart,
    me,
    deltas,
    onPopDelta,
    onUseItem,
    onShootPlayer,
    onPass,
  } = props;
  switch (lobby.state) {
    case "waiting":
      return (
        <WaitingLobby
          lobby={lobby}
          onStart={onStart}
          me={me}
          creator={lobby.creator}
          onChangeActivity={onChangeActivity}
        />
      );
    case "active":
      return (
        <Game
          deltas={deltas}
          onPopDelta={onPopDelta}
          me={me}
          onUseItem={onUseItem}
          onShootPlayer={onShootPlayer}
          onPass={onPass}
        />
      );
    default:
      return ensureUnreachable(lobby);
  }
});
LobbyScreen.displayName = "LobbyScreen";

export default LobbyScreen;
