import { getToken } from './auth-store';
import { BASE_URL } from './api';
const getWsUrl = (apiBase: string) => {
  // apiBase is like http://172.x.x.x:5001/api/v1
  // We want ws://172.x.x.x:5001/ws
  try {
    const url = new URL(apiBase);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws`;
  } catch (err) {
    // Fallback if URL is invalid
    return apiBase.replace('http', 'ws').replace('/api/v1', '/ws');
  }
};

const WS_BASE = getWsUrl(BASE_URL);
type SocketMessage = {
  type: string;
  payload?: any;
};

type Listener = (payload: any) => void;

class SocketService {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private reconnectTimer: any = null;
  private isConnecting = false;

  async connect() {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;
    const token = await getToken();
    if (!token) {
      this.isConnecting = false;
      return;
    }

    const url = `${WS_BASE}?token=${token}`;
    console.log('[socket] connecting to', WS_BASE);

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('[socket] connected');
      this.isConnecting = false;
      this.clearReconnect();
    };

    this.socket.onmessage = (event) => {
      try {
        const data: SocketMessage = JSON.parse(event.data);
        console.log('[socket] message:', data.type);
        const set = this.listeners.get(data.type);
        if (set) {
          set.forEach((l) => l(data.payload));
        }
      } catch (err) {
        console.warn('[socket] parse error', err);
      }
    };

    this.socket.onclose = (e) => {
      console.log('[socket] closed', e.code, e.reason);
      this.isConnecting = false;
      this.socket = null;
      this.scheduleReconnect();
    };

    this.socket.onerror = (e) => {
      console.warn('[socket] error', e);
      this.isConnecting = false;
    };
  }

  on(type: string, listener: Listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => this.off(type, listener);
  }

  off(type: string, listener: Listener) {
    const set = this.listeners.get(type);
    if (set) {
      set.delete(listener);
    }
  }

  private scheduleReconnect() {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  disconnect() {
    this.clearReconnect();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
