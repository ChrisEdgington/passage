import type { Conversation, Message, Attachment } from '@passage/shared-types';
import type { ConnectionStatus } from '../api/websocket.js';

export type Pane = 'conversations' | 'messages';
export type Mode = 'normal' | 'compose' | 'help' | 'search' | 'imageView';

export interface ImageViewState {
  attachment: Attachment;
  renderedImage: string | null;
  loading: boolean;
  error: string | null;
}

export interface AppState {
  // Connection
  connectionStatus: ConnectionStatus;
  host: string;

  // Data
  conversations: Conversation[];
  messages: Map<string, Message[]>;

  // Selection
  selectedConversationId: string | null;
  selectedConversationIndex: number;
  selectedMessageIndex: number;

  // UI state
  activePane: Pane;
  mode: Mode;
  composerText: string;
  searchText: string;

  // Scroll positions
  conversationScrollOffset: number;
  messageScrollOffset: number;

  // Error state
  error: string | null;

  // Image viewer state
  imageView: ImageViewState | null;
}

// Listeners for state changes
type Listener = () => void;
const listeners: Set<Listener> = new Set();

// Initial state
const initialState: AppState = {
  connectionStatus: 'disconnected',
  host: 'localhost:3000',

  conversations: [],
  messages: new Map(),

  selectedConversationId: null,
  selectedConversationIndex: 0,
  selectedMessageIndex: 0,

  activePane: 'conversations',
  mode: 'normal',
  composerText: '',
  searchText: '',

  conversationScrollOffset: 0,
  messageScrollOffset: 0,

  error: null,

  imageView: null,
};

// Current state
let state: AppState = { ...initialState };

// Get current state (readonly)
export function getState(): Readonly<AppState> {
  return state;
}

// Update state and notify listeners
export function setState(updates: Partial<AppState>): void {
  state = { ...state, ...updates };
  notifyListeners();
}

// Subscribe to state changes
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Notify all listeners
function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

// Reset state
export function resetState(): void {
  state = { ...initialState };
  notifyListeners();
}

// Helper functions for common state operations

export function setConversations(conversations: Conversation[]): void {
  setState({ conversations });

  // Auto-select first conversation if none selected
  if (!state.selectedConversationId && conversations.length > 0) {
    setState({
      selectedConversationId: conversations[0].id,
      selectedConversationIndex: 0,
    });
  }
}

export function setMessages(conversationId: string, messages: Message[]): void {
  const newMessages = new Map(state.messages);
  newMessages.set(conversationId, messages);
  setState({ messages: newMessages });
}

export function addMessage(message: Message): void {
  const newMessages = new Map(state.messages);
  const existing = newMessages.get(message.conversationId) || [];

  // Check if message already exists (by id)
  const existingIndex = existing.findIndex((m) => m.id === message.id);
  if (existingIndex >= 0) {
    // Update existing message
    existing[existingIndex] = message;
  } else {
    // Add new message
    existing.push(message);
  }

  newMessages.set(message.conversationId, existing);
  setState({ messages: newMessages });
}

export function updateMessage(message: Message): void {
  const newMessages = new Map(state.messages);
  const existing = newMessages.get(message.conversationId) || [];
  const index = existing.findIndex((m) => m.id === message.id);

  if (index >= 0) {
    existing[index] = message;
    newMessages.set(message.conversationId, existing);
    setState({ messages: newMessages });
  }
}

export function updateConversation(conversation: Conversation): void {
  const index = state.conversations.findIndex((c) => c.id === conversation.id);
  if (index >= 0) {
    const newConversations = [...state.conversations];
    newConversations[index] = conversation;
    setState({ conversations: newConversations });
  }
}

export function selectConversation(id: string): void {
  const index = state.conversations.findIndex((c) => c.id === id);
  if (index >= 0) {
    setState({
      selectedConversationId: id,
      selectedConversationIndex: index,
      messageScrollOffset: 0,
    });
  }
}

export function selectConversationByIndex(index: number): void {
  if (index >= 0 && index < state.conversations.length) {
    setState({
      selectedConversationId: state.conversations[index].id,
      selectedConversationIndex: index,
      messageScrollOffset: 0,
    });
  }
}

export function moveConversationSelection(delta: number): void {
  const newIndex = Math.max(
    0,
    Math.min(state.conversations.length - 1, state.selectedConversationIndex + delta)
  );
  selectConversationByIndex(newIndex);
}

export function moveMessageSelection(delta: number): void {
  const messages = getCurrentMessages();
  const newIndex = Math.max(
    0,
    Math.min(messages.length - 1, state.selectedMessageIndex + delta)
  );
  setState({ selectedMessageIndex: newIndex });
}

export function getCurrentMessages(): Message[] {
  if (!state.selectedConversationId) return [];
  return state.messages.get(state.selectedConversationId) || [];
}

export function getCurrentConversation(): Conversation | null {
  if (!state.selectedConversationId) return null;
  return state.conversations.find((c) => c.id === state.selectedConversationId) || null;
}

export function setError(error: string | null): void {
  setState({ error });
  // Auto-clear error after 5 seconds
  if (error) {
    setTimeout(() => {
      if (state.error === error) {
        setState({ error: null });
      }
    }, 5000);
  }
}

export function setComposerText(text: string): void {
  setState({ composerText: text });
}

export function clearComposer(): void {
  setState({ composerText: '' });
}

export function setMode(mode: Mode): void {
  setState({ mode });
}

export function switchPane(): void {
  setState({
    activePane: state.activePane === 'conversations' ? 'messages' : 'conversations',
  });
}

export function jumpToTop(): void {
  if (state.activePane === 'conversations') {
    selectConversationByIndex(0);
    setState({ conversationScrollOffset: 0 });
  } else {
    setState({ selectedMessageIndex: 0, messageScrollOffset: 0 });
  }
}

export function jumpToBottom(): void {
  if (state.activePane === 'conversations') {
    selectConversationByIndex(state.conversations.length - 1);
  } else {
    const messages = getCurrentMessages();
    setState({ selectedMessageIndex: messages.length - 1 });
  }
}

export function findNextUnread(): string | null {
  for (const conv of state.conversations) {
    if (conv.unreadCount > 0) {
      return conv.id;
    }
  }
  return null;
}

export function openImageView(attachment: Attachment): void {
  setState({
    mode: 'imageView',
    imageView: {
      attachment,
      renderedImage: null,
      loading: true,
      error: null,
    },
  });
}

export function setImageViewRendered(renderedImage: string): void {
  if (state.imageView) {
    setState({
      imageView: {
        ...state.imageView,
        renderedImage,
        loading: false,
      },
    });
  }
}

export function setImageViewError(error: string): void {
  if (state.imageView) {
    setState({
      imageView: {
        ...state.imageView,
        error,
        loading: false,
      },
    });
  }
}

export function closeImageView(): void {
  setState({
    mode: 'normal',
    imageView: null,
  });
}

export function getAttachmentsInCurrentConversation(): Attachment[] {
  const messages = getCurrentMessages();
  const attachments: Attachment[] = [];
  for (const msg of messages) {
    for (const att of msg.attachments) {
      if (att.mimeType.startsWith('image/')) {
        attachments.push(att);
      }
    }
  }
  return attachments;
}
