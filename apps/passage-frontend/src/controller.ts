import { makeAutoObservable, runInAction } from 'mobx';
import type { Conversation, Message, WebSocketMessage } from '@passage/shared-types';

// Simple logger with timestamps
const log = {
  info: (msg: string, ...args: unknown[]) => console.log(`[Controller] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[Controller] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[Controller] ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) => console.debug(`[Controller] ${msg}`, ...args),
};

export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'reconnecting';

// Pending message with sending status
export interface PendingMessage extends Message {
  isPending: true;
  pendingId: string;
}

export class MessagesController {
  // Connection state
  connectionStatus: ConnectionStatus = 'connecting';
  connectionError: string | null = null;

  // State
  conversations: Conversation[] = [];
  selectedConversationId: string | null = null;
  messages: Map<string, Message[]> = new Map();
  pendingMessages: Map<string, PendingMessage[]> = new Map();
  isLoading = false;
  error: string | null = null;
  ws: WebSocket | null = null;

  // Singleton pattern
  private static _instance: MessagesController | null = null;

  private constructor() {
    makeAutoObservable(this);
    // Auto-connect on init (same-origin)
    this.connectWebSocket();
  }

  static get instance(): MessagesController {
    if (!MessagesController._instance) {
      MessagesController._instance = new MessagesController();
    }
    return MessagesController._instance;
  }

  // Same-origin URLs
  get apiBaseUrl(): string {
    return window.location.origin;
  }

  get wsUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  get isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }

  get selectedConversation(): Conversation | null {
    return this.conversations.find((c) => c.id === this.selectedConversationId) || null;
  }

  get selectedMessages(): (Message | PendingMessage)[] {
    if (!this.selectedConversationId) return [];
    const confirmed = this.messages.get(this.selectedConversationId) || [];
    const pending = this.pendingMessages.get(this.selectedConversationId) || [];
    return [...confirmed, ...pending];
  }

  // Actions
  async fetchConversations(): Promise<void> {
    log.info('Fetching conversations...');
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/conversations`);
      if (!response.ok) throw new Error('Failed to fetch conversations');

      const data = await response.json();
      log.info(`Fetched ${data.conversations.length} conversations`);
      runInAction(() => {
        this.conversations = data.conversations;
        this.isLoading = false;

        // Auto-select first conversation if none selected
        if (!this.selectedConversationId && data.conversations.length > 0) {
          this.selectConversation(data.conversations[0].id);
        }
      });
    } catch (error: any) {
      log.error('Failed to fetch conversations:', error.message);
      runInAction(() => {
        this.error = error.message;
        this.isLoading = false;
      });
    }
  }

  async fetchMessages(conversationId: string): Promise<void> {
    log.info(`Fetching messages for conversation ${conversationId}...`);
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/conversations/${conversationId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');

      const data = await response.json();
      log.info(`Fetched ${data.messages.length} messages for conversation ${conversationId}`);
      runInAction(() => {
        this.messages.set(conversationId, data.messages);
        this.isLoading = false;
      });
    } catch (error: any) {
      log.error('Failed to fetch messages:', error.message);
      runInAction(() => {
        this.error = error.message;
        this.isLoading = false;
      });
    }
  }

  async sendMessage(recipientId: string, text: string, attachmentPath?: string): Promise<void> {
    log.info(`Sending message to ${recipientId}:`, { text: text?.slice(0, 50), hasAttachment: !!attachmentPath });
    this.error = null;

    if (!this.selectedConversationId) {
      throw new Error('No conversation selected');
    }

    const conversationId = this.selectedConversationId;
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Create optimistic pending message
    const pendingMessage: PendingMessage = {
      id: pendingId,
      conversationId,
      text: text || (attachmentPath ? '' : ''),
      senderId: 'me',
      senderName: 'Me',
      timestamp: Date.now(),
      isFromMe: true,
      isRead: false,
      isSent: false,
      isDelivered: false,
      attachments: [],
      isPending: true,
      pendingId,
    };

    // Add to pending messages immediately
    runInAction(() => {
      const existing = this.pendingMessages.get(conversationId) || [];
      this.pendingMessages.set(conversationId, [...existing, pendingMessage]);
      log.debug(`Added pending message ${pendingId}, total pending: ${existing.length + 1}`);
    });

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId, text, attachmentPath }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      log.info(`Message sent successfully, waiting for WebSocket confirmation`);

      // Safety timeout: clear pending message after 10 seconds if no WebSocket confirmation
      setTimeout(() => {
        runInAction(() => {
          const pending = this.pendingMessages.get(conversationId) || [];
          const stillPending = pending.find((m) => m.pendingId === pendingId);
          if (stillPending) {
            log.warn(`Pending message ${pendingId} timed out, clearing`);
            this.pendingMessages.set(conversationId, pending.filter((m) => m.pendingId !== pendingId));
            // Refresh messages from server to get the real message
            this.fetchMessages(conversationId);
          }
        });
      }, 10000);
    } catch (error: any) {
      log.error('Failed to send message:', error.message);
      runInAction(() => {
        const pending = this.pendingMessages.get(conversationId) || [];
        this.pendingMessages.set(conversationId, pending.filter((m) => m.pendingId !== pendingId));
        this.error = error.message;
      });
      throw error;
    }
  }

  selectConversation(conversationId: string): void {
    this.selectedConversationId = conversationId;

    // Fetch messages if we don't have them cached
    if (!this.messages.has(conversationId)) {
      this.fetchMessages(conversationId);
    }
  }

  // Navigate to next conversation (j or down)
  selectNextConversation(): void {
    if (this.conversations.length === 0) return;

    const currentIndex = this.conversations.findIndex((c) => c.id === this.selectedConversationId);
    const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, this.conversations.length - 1);
    this.selectConversation(this.conversations[nextIndex].id);
  }

  // Navigate to previous conversation (k or up)
  selectPreviousConversation(): void {
    if (this.conversations.length === 0) return;

    const currentIndex = this.conversations.findIndex((c) => c.id === this.selectedConversationId);
    const prevIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0);
    this.selectConversation(this.conversations[prevIndex].id);
  }

  // Jump to first conversation (gg or Home)
  selectFirstConversation(): void {
    if (this.conversations.length === 0) return;
    this.selectConversation(this.conversations[0].id);
  }

  // Jump to last conversation (G or End)
  selectLastConversation(): void {
    if (this.conversations.length === 0) return;
    this.selectConversation(this.conversations[this.conversations.length - 1].id);
  }

  // Jump to conversation with latest unread message (u)
  selectLatestUnread(): void {
    // Find first conversation with unread messages (they're sorted by last message date)
    const unreadConvo = this.conversations.find((c) => c.unreadCount > 0);
    if (unreadConvo) {
      this.selectConversation(unreadConvo.id);
    } else if (this.conversations.length > 0) {
      // If no unreads, select first (most recent) conversation
      this.selectConversation(this.conversations[0].id);
    }
  }

  // WebSocket connection
  private connectWebSocket(): void {
    log.info(`Connecting to WebSocket at ${this.wsUrl}...`);

    runInAction(() => {
      this.connectionStatus = 'connecting';
    });

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      log.info('WebSocket connected');
      runInAction(() => {
        this.connectionStatus = 'connected';
        this.connectionError = null;
      });

      // Fetch initial conversations
      this.fetchConversations();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        log.debug(`WebSocket received: ${message.type}`, message.payload);
        this.handleWebSocketMessage(message);
      } catch (error) {
        log.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      log.error('WebSocket error:', error);
      runInAction(() => {
        this.connectionError = 'WebSocket connection error';
      });
    };

    this.ws.onclose = (event) => {
      log.warn(`WebSocket disconnected (code: ${event.code}, reason: ${event.reason})`);
      runInAction(() => {
        this.connectionStatus = 'reconnecting';
      });
      log.info('Reconnecting in 3s...');
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'new_message': {
        const newMessage = message.payload;
        log.info(`New message in ${newMessage.conversationId}: "${newMessage.text?.slice(0, 30)}..." from ${newMessage.isFromMe ? 'me' : newMessage.senderName}`);

        runInAction(() => {
          const existingMessages = this.messages.get(newMessage.conversationId) || [];
          if (!existingMessages.some((m) => m.id === newMessage.id)) {
            this.messages.set(newMessage.conversationId, [...existingMessages, newMessage]);
            log.debug(`Added message ${newMessage.id} to conversation ${newMessage.conversationId}`);
          } else {
            log.debug(`Message ${newMessage.id} already exists, skipping`);
          }

          // Clear pending messages when we get a message from ourselves
          if (newMessage.isFromMe) {
            // Try to find matching pending in the same conversation
            const pending = this.pendingMessages.get(newMessage.conversationId) || [];
            log.debug(`Checking ${pending.length} pending messages for match`);

            // Match by comparing normalized text (trim whitespace)
            const normalizedNewText = (newMessage.text || '').trim();
            const matchIdx = pending.findIndex((p) => (p.text || '').trim() === normalizedNewText);

            if (matchIdx !== -1) {
              log.info(`Matched pending message at index ${matchIdx}, removing`);
              pending.splice(matchIdx, 1);
              this.pendingMessages.set(newMessage.conversationId, [...pending]);
            } else {
              // If no exact match, just clear the oldest pending message
              // This handles cases where text was transformed
              if (pending.length > 0) {
                log.info(`No exact match, clearing oldest pending message`);
                pending.shift();
                this.pendingMessages.set(newMessage.conversationId, [...pending]);
              } else {
                // Also check if there are pending messages in the currently selected conversation
                // (in case conversationId doesn't match due to ID format differences)
                if (this.selectedConversationId && this.selectedConversationId !== newMessage.conversationId) {
                  const selectedPending = this.pendingMessages.get(this.selectedConversationId) || [];
                  if (selectedPending.length > 0) {
                    log.info(`Clearing pending from selected conversation ${this.selectedConversationId}`);
                    selectedPending.shift();
                    this.pendingMessages.set(this.selectedConversationId, [...selectedPending]);
                  }
                }
              }
            }
          }

          const conversation = this.conversations.find((c) => c.id === newMessage.conversationId);
          if (conversation) {
            conversation.lastMessage = newMessage;
            if (!newMessage.isFromMe) {
              conversation.unreadCount += 1;
            }
          }
        });
        break;
      }

      case 'message_updated': {
        const updatedMessage = message.payload;
        log.debug(`Message updated: ${updatedMessage.id}`);
        runInAction(() => {
          const messages = this.messages.get(updatedMessage.conversationId);
          if (messages) {
            const index = messages.findIndex((m) => m.id === updatedMessage.id);
            if (index !== -1) {
              messages[index] = updatedMessage;
            }
          }
        });
        break;
      }

      case 'conversation_updated': {
        const updatedConversation = message.payload;
        log.debug(`Conversation updated: ${updatedConversation.id} (${updatedConversation.displayName})`);
        runInAction(() => {
          const index = this.conversations.findIndex((c) => c.id === updatedConversation.id);
          if (index !== -1) {
            this.conversations[index] = updatedConversation;
          } else {
            this.conversations.push(updatedConversation);
          }
          // Re-sort by last message timestamp (newest first)
          this.conversations.sort((a, b) => {
            const aTime = a.lastMessage?.timestamp ?? 0;
            const bTime = b.lastMessage?.timestamp ?? 0;
            return bTime - aTime;
          });
        });
        break;
      }

      case 'contacts_ready': {
        log.info('Contacts cache ready, refreshing conversations...');
        this.fetchConversations();
        if (this.selectedConversationId) {
          this.fetchMessages(this.selectedConversationId);
        }
        break;
      }

      case 'error': {
        log.error('Server error:', message.payload.message);
        runInAction(() => {
          this.error = message.payload.message;
        });
        break;
      }
    }
  }

  // Cleanup
  dispose(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
