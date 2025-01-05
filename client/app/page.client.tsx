"use client";

import { Button } from "@/components/ui/button";
import socket from "@/lib/socket";
import { ClientEvent, Lobby, ServerEvent } from "@shared/game/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function HomeClient() {
  const router = useRouter();
  useEffect(() => {
    socket.removeAllListeners();
    socket.connect();
    socket.on(ServerEvent.connect, () => {
      socket.emit(ClientEvent.whoami);
    });
    socket.on(ServerEvent.syncLobby, (data: Lobby) => {
      router.push(`/${data.id}`);
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [router]);

  return (
    <div className="flex flex-col justify-center items-center p-8">
      <Button
        onClick={() => {
          socket.emit(ClientEvent.create);
        }}
      >
        Create lobby
      </Button>
    </div>
  );
}

export default HomeClient;
