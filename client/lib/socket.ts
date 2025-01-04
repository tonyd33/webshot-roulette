"use client";
import { io } from "socket.io-client";

const socket = io({
  // defaults
  autoConnect: true,
  transports: ["polling", "websocket"],

  // proxy
  path: "/api/v1/ws/socket.io",
  // when reloading, I think the fact that the existing websocket connection
  // doesn't close causes problems? Or maybe only during hot reload. Either way,
  // this allows us to use the websocket transport again after a reload.
  closeOnBeforeunload: true,
});

export default socket;
