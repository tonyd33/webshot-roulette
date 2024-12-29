"use client";

import { Button } from "@/components/ui/button";

// const socket = io("http://localhost:3001", { path: "/api/socket.io" });

function HomeClient() {
  // const [game, setGame] = useState(null);

  // const [lobbyId, setLobbyId] = useState();

  // useEffect(() => {
  // socket.on("updateState", (newGame) => {
  // setGame(newGame);
  // });

  // socket.on("createdLobby", (id) => {
  // console.log("foo", id);
  // setLobbyId(id);
  // });
  // socket.on("chat", (chat) => {
  // console.log("chat");
  // });

  // return () => {};
  // }, []);

  // const createLobby = () => {
  // socket.emit("createLobby");
  // };

  // const joinLobby = (lobbyId: string) => {
  // socket.emit("joinLobby", lobbyId);
  // };

  return (
    <div>
      <Button onClick={() => {}}>Create lobby</Button>
      <Button
        onClick={() => {
          // socket.emit("chat", { lobbyId, msg: "hello!" });
        }}
      >
        Create lobby
      </Button>
    </div>
  );
}

export default HomeClient;
