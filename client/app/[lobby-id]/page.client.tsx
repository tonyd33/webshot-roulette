"use client";
import Chat from "@/components/chat";
import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { useStableCallback } from "../hooks/useStableCallback";
import { Button } from "@/components/ui/button";
import { Code } from "@nextui-org/code";
import {
  Action,
  ActionEffect,
  ClientEvent,
  PublicDelta,
  PublicGame,
  ServerEvent,
  Waiting,
} from "@/types/game";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Game from "@/components//game";

const socket = io("http://localhost:3001", { path: "/api/v1/socket.io/" });

function LobbyClient({ lobbyId }: { lobbyId: string }) {
  const { toast } = useToast();
  const [chats, setChats] = useState<{ nonce: number; msg: string }[]>([]);
  const [game, setGame] = useState<PublicGame>();
  const [playerId, setPlayerId] = useState<string>();
  const [fxq, setFxq] = useState<ActionEffect[]>([]);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      socket.emit(ClientEvent.join, lobbyId);
      socket.emit(ClientEvent.whoami);
    });

    socket.on(ServerEvent.whoyouare, (id: string) => {
      console.log(`I am ${id}`);
      setPlayerId(id);
    });

    socket.on(ServerEvent.chat, (msg: string) => {
      setChats((prevChats) => [...prevChats, { nonce: Date.now(), msg }]);
    });

    socket.on(ServerEvent.sync, (data: Waiting) => {
      console.log(`Sync received `, data);
      // TODO: consider unifying sync and delta
    });

    socket.on(ServerEvent.delta, (data: PublicDelta) => {
      console.log(`Delta received `, data);
      setGame(data.game);
      setFxq((prevFxq) => [...prevFxq, ...data.effects]);
    });

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
      const action: Action = { type: "shoot", who: playerIdToShoot };
      socket.emit(ClientEvent.act, { lobbyId, action });
    },
    [lobbyId]
  );

  const handleUseItem = useStableCallback(
    (which: number) => {
      const action: Action = { type: "useItem", which };
      socket.emit(ClientEvent.act, { lobbyId, action });
    },
    [lobbyId]
  );

  return (
    <div>
      <div className="flex flex-row">
        <div className="grow">
          <Button onClick={handleStart}>Start</Button>
        </div>
        <Chat onMsg={handleChatMsg} msgs={chats} />
      </div>
      {game && playerId && (
        <Game
          game={game}
          fx={fxq}
          playerId={playerId}
          onUseItem={handleUseItem}
          onFxChange={setFxq}
          onShootPlayer={handleShoot}
        />
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Game</TableHead>
            <TableHead>Effects</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>
              <Code className="whitespace-pre-wrap">
                {JSON.stringify(game, null, 2)}
              </Code>
            </TableCell>
            <TableCell>
              <Code className="whitespace-pre-wrap">
                {JSON.stringify(fxq, null, 2)}
              </Code>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div className="flex flex-row"></div>
    </div>
  );
}

export default LobbyClient;
