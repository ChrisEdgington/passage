// Contact/Participant types
export interface Contact {
  id: string;
  displayName: string;
  handleIdentifier: string; // Raw handle (phone number or email) for sending messages
  phoneNumber?: string;
  email?: string;
  isMe: boolean;
}

// Reaction (tapback) types
export interface Reaction {
  type: ReactionType;
  senderId: string;
  senderName: string;
  isFromMe: boolean;
  emoji?: string; // For custom emoji reactions (iOS 18+)
}

export type ReactionType = 'love' | 'like' | 'dislike' | 'laugh' | 'emphasis' | 'question';

// Message types
export interface Message {
  id: string;
  conversationId: string;
  text: string | null;
  senderId: string;
  senderName: string;
  timestamp: number; // Unix timestamp in milliseconds
  isFromMe: boolean;
  isRead: boolean;
  isSent: boolean;
  isDelivered: boolean;
  attachments: Attachment[];
  reactions: Reaction[]; // Tapback reactions on this message
  associatedMessageGuid?: string; // For reactions/replies
  associatedMessageType?: number; // Type of association (reaction, reply, etc.)
  expressiveSendStyleId?: string; // For message effects (slam, loud, etc.)
}

// Attachment types
export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  totalBytes: number;
  transferName: string;
  filePath: string;
  isSticker: boolean;
  hideAttachment: boolean;
}

// Conversation types
export interface Conversation {
  id: string;
  displayName: string;
  participants: Contact[];
  lastMessage: Message | null;
  unreadCount: number;
  isGroup: boolean;
  groupPhotoPath?: string;
}

// API Request/Response types
export interface GetConversationsResponse {
  conversations: Conversation[];
}

export interface GetConversationResponse {
  conversation: Conversation;
}

export interface GetMessagesRequest {
  conversationId: string;
  limit?: number;
  before?: number; // Timestamp for pagination
}

export interface GetMessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

export interface SendMessageRequest {
  conversationId?: string;
  recipientId?: string; // Phone number or email
  text: string;
  attachments?: string[]; // File paths
}

export interface SendMessageResponse {
  success: boolean;
  error?: string;
  messageId?: string;
}

// WebSocket message types
export type WebSocketMessage =
  | {
      type: 'new_message';
      payload: Message;
    }
  | {
      type: 'message_updated';
      payload: Message;
    }
  | {
      type: 'conversation_updated';
      payload: Conversation;
    }
  | {
      type: 'contacts_ready';
      payload: Record<string, never>;
    }
  | {
      type: 'error';
      payload: {
        message: string;
      };
    };

// Utility types
export interface ApiError {
  error: string;
  details?: unknown;
}
