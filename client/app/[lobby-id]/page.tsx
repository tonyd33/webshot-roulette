import { Suspense } from "react";
import LobbyClient from "./page.client";

async function Lobby({ params }: { params: Promise<{ "lobby-id": string }> }) {
  const { "lobby-id": lobbyId } = await params;
  return (
    <Suspense>
      <LobbyClient lobbyId={lobbyId} />
    </Suspense>
  );
}

export default Lobby;
