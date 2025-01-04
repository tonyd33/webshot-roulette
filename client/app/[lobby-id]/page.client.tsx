"use client";
import Chat from "@/components/chat";
import { useCallback, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { useStableCallback } from "@/hooks/use-stable-callback";
import { Button } from "@/components/ui/button";
import { Code } from "@nextui-org/code";
import {
  Action,
  ActionType,
  ClientEvent,
  Lobby,
  PublicGameDelta,
  ServerEvent,
} from "@shared/game/types";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LobbyScreen from "@/components/lobby-screen";
import socket from "@/lib/socket";
import FakeProgress from "@/components/fake-progress";

function LobbyClient({ lobbyId }: { lobbyId: string }) {
  const { toast } = useToast();
  const [chats, setChats] = useState<{ nonce: number; msg: string }[]>([]);
  const [playerId, setPlayerId] = useState<string>();
  const [deltas, setDeltas] = useState<PublicGameDelta[]>([]);
  const [lobby, setLobby] = useState<Lobby>();

  const socketRef = useRef<Socket>(socket);
  useEffect(() => {
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
    // });

    return () => {
      socket.disconnect();
    };
  }, [lobbyId, toast]);

  const handleChatMsg = useStableCallback(
    (msg: string) => socketRef.current?.emit("chat", { lobbyId, msg }),
    [lobbyId]
  );

  const handleStart = useStableCallback(() => {
    console.log(socketRef.current);
    socketRef.current?.emit("start", { lobbyId });
  }, [lobbyId]);

  const handleShoot = useCallback(
    (playerIdToShoot: string) => {
      const action: Action = { type: ActionType.shoot, who: playerIdToShoot };
      socketRef.current?.emit(ClientEvent.act, { lobbyId, action });
    },
    [lobbyId]
  );

  const handleUseItem = useStableCallback(
    (useItem: Extract<Action, { type: "useItem" }>) => {
      socketRef.current?.emit(ClientEvent.act, { lobbyId, action: useItem });
    },
    [lobbyId]
  );
  const handlePass = useStableCallback(
    () =>
      socketRef.current?.emit(ClientEvent.act, {
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

  return (
    <div>
      {lobby && playerId ? (
        <LobbyScreen
          lobby={lobby}
          onChangeActivity={() => {}}
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