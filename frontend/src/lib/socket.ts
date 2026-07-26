import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  const token = localStorage.getItem("dw_access_token");
  if (!token) return null;
  if (socket) return socket;

  const base = import.meta.env.VITE_API_URL ?? window.location.origin;
  socket = io(base, { auth: { token }, transports: ["websocket"] });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
