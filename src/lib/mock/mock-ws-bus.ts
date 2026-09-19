import { WsEventName } from '../../types';

type EventHandler<T = any> = (payload: T) => void;

class MockWebSocketBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private isConnectedState: boolean = true;
  private reconnectTimer: number | null = null;
  private channelId: string = 'mock_livechat_ws_channel';

  /**
   * In real-backend mode, route outbound events through the real Socket.IO bridge.
   * Return true from the router to mark the event as handled (no local/broadcast dispatch).
   */
  private sendRouter?: (eventName: string, payload: any) => boolean;

  public setSendRouter(router: (eventName: string, payload: any) => boolean): void {
    this.sendRouter = router;
  }

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(this.channelId);
        this.broadcastChannel.onmessage = (event) => {
          const { eventName, payload, senderInstance } = event.data || {};
          if (eventName && senderInstance !== this.instanceId) {
            this.dispatchLocal(eventName, payload);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported in this environment, falling back to in-memory bus', e);
      }
    }
  }

  private instanceId = Math.random().toString(36).substring(2, 9);

  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      this.isConnectedState = true;
      this.dispatchLocal('connect', { connected: true, timestamp: Date.now() });
      resolve(true);
    });
  }

  public disconnect(): void {
    this.isConnectedState = false;
    this.dispatchLocal('disconnect', { timestamp: Date.now() });
  }

  public isConnected(): boolean {
    return this.isConnectedState;
  }

  public simulateReconnect(): void {
    this.isConnectedState = false;
    this.dispatchLocal('reconnecting', { attempt: 1 });
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      this.isConnectedState = true;
      this.dispatchLocal('connect', { reconnected: true, timestamp: Date.now() });
    }, 1500);
  }

  public send(eventName: WsEventName | string, payload: any): void {
    if (this.sendRouter && this.sendRouter(eventName, payload)) {
      return; // handled by the real socket bridge
    }

    if (!this.isConnectedState) {
      console.warn(`[MockWS] Cannot send '${eventName}', bus is disconnected`);
      return;
    }

    // 1. Dispatch locally in-memory
    this.dispatchLocal(eventName, payload);

    // 2. Broadcast across tabs and iframes
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          eventName,
          payload,
          senderInstance: this.instanceId,
        });
      } catch (err) {
        console.warn('BroadcastChannel postMessage failed', err);
      }
    }
  }

  /**
   * Dispatch an inbound (server-pushed) event to local listeners only.
   * Used by the real socket bridge — real-time data must not re-broadcast
   * across tabs because each tab holds its own socket connection.
   */
  public dispatch(eventName: WsEventName | string, payload: any): void {
    this.dispatchLocal(eventName, payload);
  }

  public on<T = any>(eventName: WsEventName | string, callback: EventHandler<T>): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(callback);

    // Return unbind function
    return () => {
      this.off(eventName, callback);
    };
  }

  public off<T = any>(eventName: WsEventName | string, callback: EventHandler<T>): void {
    const handlers = this.listeners.get(eventName);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  private dispatchLocal(eventName: string, payload: any): void {
    const handlers = this.listeners.get(eventName);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(payload);
        } catch (e) {
          console.error(`Error in MockWS handler for event ${eventName}:`, e);
        }
      });
    }
  }
}

export const mockWsBus = new MockWebSocketBus();
