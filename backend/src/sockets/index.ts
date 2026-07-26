import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { env } from "../config/env";
import { verifyAccessToken } from "../utils/jwt";
import { eventBus, EVENTS } from "../services/eventBus";
import { logger } from "../utils/logger";

interface AuthedSocket extends Socket {
  orgId?: string;
}

export function initSockets(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = verifyAccessToken(token);
      socket.orgId = payload.orgId;
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    const room = `org:${socket.orgId}`;
    socket.join(room);
    logger.debug({ socketId: socket.id, room }, "Socket connected");

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Socket disconnected");
    });
  });

  // Bridge domain events -> all connected clients in that org's room.
  // In a multi-instance deployment this subscribe would be on Redis
  // pub/sub instead of the local eventBus (see ARCHITECTURE.md §1/§15).
  const forward = (event: string) => (payload: Record<string, unknown>) => {
    io.emit(event, payload); // single-org demo app: broadcast is fine
  };

  eventBus.on(EVENTS.HEALTH_UPDATE, forward(EVENTS.HEALTH_UPDATE));
  eventBus.on(EVENTS.INCIDENT_NEW, forward(EVENTS.INCIDENT_NEW));
  eventBus.on(EVENTS.INCIDENT_RESOLVED, forward(EVENTS.INCIDENT_RESOLVED));
  eventBus.on(EVENTS.DEPLOYMENT_STATUS_CHANGE, forward(EVENTS.DEPLOYMENT_STATUS_CHANGE));
  eventBus.on(EVENTS.ALERT_FIRED, forward(EVENTS.ALERT_FIRED));

  return io;
}
