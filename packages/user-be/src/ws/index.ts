import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { getUserLatestLocation, setUserLatestLocation } from "./location.service";

interface AuthenticatedSocket extends WebSocket {
  userId: string;
  email: string;
  role: string;
  isAlive: boolean;
}

interface WsMessage {
  type: string;
  payload?: unknown;
}

const clients = new Map<string, Set<AuthenticatedSocket>>();
// targetUserId -> Set of sockets actively watching that user
const locationSubscribers = new Map<string, Set<AuthenticatedSocket>>();

let wss: WebSocketServer;

export function initWebSocket(server: HttpServer) {
  wss = new WebSocketServer({ server, path: "/ws" });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients as Set<AuthenticatedSocket>) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));

  wss.on("connection", (ws: AuthenticatedSocket, req) => {
    // ── JWT Auth from query string: ws://host/ws?token=xxx ──
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Missing token");
      return;
    }

    try {
      const decoded = jwt.verify(token, env.jwtSecret) as {
        sub: string;
        email: string;
        role: string;
      };

      ws.userId = decoded.sub;
      ws.email = decoded.email;
      ws.role = decoded.role;
      ws.isAlive = true;
    } catch {
      ws.close(4002, "Invalid token");
      return;
    }

    // ── Track connected client ──
    if (!clients.has(ws.userId)) {
      clients.set(ws.userId, new Set());
    }
    clients.get(ws.userId)!.add(ws);

    console.log(`[ws] connected: ${ws.userId} (${ws.email})`);

  
    send(ws, { type: "connected", payload: { userId: ws.userId } });


    ws.on("pong", () => {
      ws.isAlive = true;
    });


    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;
        await handleMessage(ws, msg);
      } catch (err) {
        send(ws, { type: "error", payload: { message: "Invalid JSON" } });
      }
    });

  
    ws.on("close", () => {
      const userSockets = clients.get(ws.userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) clients.delete(ws.userId);
      }
      
      // Cleanup: remove this socket from any location subscriptions
      for (const subscribers of locationSubscribers.values()) {
        subscribers.delete(ws);
      }

      console.log(`[ws] disconnected: ${ws.userId}`);
    });
  });

  console.log("[ws] WebSocket server ready on /ws");
  return wss;
}

async function handleMessage(ws: AuthenticatedSocket, msg: WsMessage) {
  switch (msg.type) {
    case "ping":
      send(ws, { type: "pong" });
      break;

    case "location:subscribe": {
      const { targetUserId } = (msg.payload as { targetUserId?: string }) || {};
      if (!targetUserId) {
        return send(ws, { type: "error", payload: { message: "targetUserId required" } });
      }

      if (!locationSubscribers.has(targetUserId)) {
        locationSubscribers.set(targetUserId, new Set());
      }
      locationSubscribers.get(targetUserId)!.add(ws);
      
      console.log(`[ws] User ${ws.userId} subscribed to live location of ${targetUserId}`);

      // Immediately send last known location if available
      const lastLoc = await getUserLatestLocation(targetUserId);
      if (lastLoc) {
        send(ws, {
          type: "location:update",
          payload: { userId: targetUserId, ...lastLoc },
        });
      }
      break;
    }

    case "location:unsubscribe": {
      const { targetUserId } = (msg.payload as { targetUserId?: string }) || {};
      if (targetUserId && locationSubscribers.has(targetUserId)) {
        locationSubscribers.get(targetUserId)!.delete(ws);
        console.log(`[ws] User ${ws.userId} unsubscribed from live location of ${targetUserId}`);
      }
      break;
    }

    case "location:update": {
      const payload = msg.payload as any;
      if (!payload || typeof payload.latitude !== "number" || typeof payload.longitude !== "number") {
        return send(ws, { type: "error", payload: { message: "Invalid location payload" } });
      }

      // Save to Redis
      const locationData = await setUserLatestLocation(ws.userId, {
        latitude: payload.latitude,
        longitude: payload.longitude,
        heading: payload.heading,
        speed: payload.speed,
      });

      // Broadcast to all active subscribers watching this user
      const subscribers = locationSubscribers.get(ws.userId);
      if (subscribers && subscribers.size > 0) {
        const broadcastPayload = {
          type: "location:update",
          payload: { userId: ws.userId, ...locationData },
        };
        for (const subscriberWs of subscribers) {
          send(subscriberWs, broadcastPayload);
        }
      }
      break;
    }

    default:
      send(ws, { type: "error", payload: { message: `Unknown type: ${msg.type}` } });
  }
}

function send(ws: WebSocket, data: WsMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function sendToUser(userId: string, data: WsMessage) {
  const userSockets = clients.get(userId);
  if (!userSockets) return;
  for (const ws of userSockets) {
    send(ws, data);
  }
}

export function broadcast(data: WsMessage) {
  if (!wss) {
    console.warn("[ws] Cannot broadcast, wss not initialized");
    return;
  }
  console.log(`[ws] Broadcasting ${data.type} to ${wss.clients.size} clients`);
  for (const ws of wss.clients) {
    send(ws, data);
  }
}


export function broadcastToRole(role: string, data: WsMessage) {
  if (!wss) return;
  for (const ws of wss.clients as Set<AuthenticatedSocket>) {
    if (ws.role === role && ws.readyState === WebSocket.OPEN) {
      send(ws, data);
    }
  }
}

// ── Get count of connected clients ──
export function getConnectedCount(): number {
  return wss ? wss.clients.size : 0;
}
