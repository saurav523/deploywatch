import { Socket } from "socket.io-client";

export function getSocket(): Socket | null {
  return null;
}

export function disconnectSocket() {
  // Demo mode: no backend socket connection.
}
