import WebSocket from 'ws';
import type { WebSocketMessage, Message, Conversation } from '@passage/shared-types';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export interface WebSocketClientOptions {
  host: string;
  onMessage?: (message: Message) => void;
  onMessageUpdated?: (message: Message) => void;
  onConversationUpdated?: (conversation: Conversation) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: string) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private host: string;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private options: WebSocketClientOptions;
  private status: ConnectionStatus = 'disconnected';
  private shouldReconnect = true;

  constructor(options: WebSocketClientOptions) {
    this.options = options;
    this.host = options.host;
  }

  private getWsUrl(): string {
    const protocol = this.host.startsWith('https') ? 'wss' : 'ws';
    const host = this.host.replace(/^https?:\/\//, '');
    return `${protocol}://${host}/ws`;
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.options.onStatusChange?.(status);
    }
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.setStatus('connecting');
    this.shouldReconnect = true;

    try {
      const url = this.getWsUrl();
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.setStatus('connected');
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('close', () => {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        this.options.onError?.(error.message);
        this.setStatus('disconnected');
        this.scheduleReconnect();
      });
    } catch (error) {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'new_message':
        this.options.onMessage?.(message.payload);
        break;
      case 'message_updated':
        this.options.onMessageUpdated?.(message.payload);
        break;
      case 'conversation_updated':
        this.options.onConversationUpdated?.(message.payload);
        break;
      case 'error':
        this.options.onError?.(message.payload.message);
        break;
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }
}
