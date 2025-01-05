"use client";
import Chat from "@/components/game/chat";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStableCallback } from "@/hooks/use-stable-callback";
import {
  Action,
  ActionType,
  ClientEvent,
  GameSettings,
  Lobby,
  PublicGameDelta,
  ServerEvent,
} from "@shared/game/types";
import { useToast } from "@/hooks/use-toast";
import LobbyScreen from "@/components/game/lobby-screen";
import socket from "@/lib/socket";
import FakeProgress from "@/components/fake-progress";

function LobbyClient({ lobbyId }: { lobbyId: string }) {
  const { toast } = useToast();
  const [chats, setChats] = useState<{ nonce: number; msg: string }[]>([]);
  const [playerId, setPlayerId] = useState<string>();
  const [deltas, setDeltas] = useState<PublicGameDelta[]>([]);
  const [lobby, setLobby] = useState<Lobby>();

  useEffect(() => {
    socket.removeAllListeners();

    socket.connect();
    socket.on("connect", () => {
      socket.emit(ClientEvent.join, lobbyId);
      socket.emit(ClientEvent.poll, lobbyId);
      socket.emit(ClientEvent.whoami);
    });

    socket.on(ServerEvent.whoyouare, (id: string) => {
      console.log(`I am ${id}`);
      setPlayerId(id);
    });

    socket.on(ServerEvent.chat, (msg: string) => {
      setChats((prevChats) => [...prevChats, { nonce: Date.now(), msg }]);
    });

    socket.on(ServerEvent.syncLobby, (data: Lobby) => {
      setLobby(data);

      if (data.state === "active") {
        setDeltas((prevDeltas) => [
          ...prevDeltas,
          { game: data.game, delta: { type: "noop" } },
        ]);
      }
    });

    socket.on(ServerEvent.delta, (data: PublicGameDelta[]) => {
      console.log(`Delta received `, data);
      setDeltas((prev) => [...prev, ...data]);
    });

    socket.on(
      ServerEvent.start,
      ({ lobby, deltas }: { lobby: Lobby; deltas: PublicGameDelta[] }) => {
        console.log(`Start received `, { lobby, deltas });
        setDeltas((prev) => [...prev, ...deltas]);
        setLobby(lobby);
      }
    );

    socket.on(ServerEvent.error, (data: string) => {
      toast({
        variant: "destructive",
        title: "Something went wrong!",
        description: data,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [lobbyId, toast]);

  const handleChatMsg = useStableCallback(
    (msg: string) => socket.emit("chat", { lobbyId, msg }),
    [lobbyId]
  );

  const handleStart = useStableCallback(() => {
    socket.emit("start", { lobbyId });
  }, [lobbyId]);

  const handleShoot = useCallback(
    (playerIdToShoot: string) => {
      const action: Action = { type: ActionType.shoot, who: playerIdToShoot };
      socket.emit(ClientEvent.act, { lobbyId, action });
    },
    [lobbyId]
  );

  const handleUseItem = useStableCallback(
    (useItem: Extract<Action, { type: "useItem" }>) => {
      socket.emit(ClientEvent.act, { lobbyId, action: useItem });
    },
    [lobbyId]
  );
  const handlePass = useStableCallback(
    () =>
      socket.emit(ClientEvent.act, {
        lobbyId,
        action: { type: ActionType.pass },
      }),
    [lobbyId]
  );
  const handlePopDelta = useStableCallback(
    () =>
      setDeltas((prev) => {
        const [_whatever, ...rest] = prev;
        return rest ?? [];
      }),
    []
  );
  const handleChangeActivity = useStableCallback(
    (to: "spectate" | "active") => {
      socket.emit(ClientEvent.changeActivity, {
        lobbyId,
        to,
      });
    },
    [lobbyId]
  );

  const handleChangeSettings = useStableCallback(
    (settings: Partial<GameSettings>) => {
      socket.emit(ClientEvent.changeSettings, { lobbyId, settings });
    },
    [lobbyId]
  );

  return (
    <div className="p-8 md:p-14">
      {lobby && playerId ? (
        <LobbyScreen
          lobby={lobby}
          onChangeActivity={handleChangeActivity}
          onChangeSettings={handleChangeSettings}
          onStart={handleStart}
          deltas={deltas}
          onPopDelta={handlePopDelta}
          me={playerId}
          onUseItem={handleUseItem}
          onShootPlayer={handleShoot}
          onPass={handlePass}
        />
      ) : (
        <FakeProgress />
      )}
    </div>
  );
}

export default LobbyClient;
