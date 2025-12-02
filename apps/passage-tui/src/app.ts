import { terminal, setupCleanup } from './core/terminal.js';
import { startKeyListener, stopKeyListener, type KeyEvent } from './core/input.js';
import { setTheme, listThemes } from './core/themes.js';
import { ApiClient } from './api/client.js';
import { WebSocketClient, type ConnectionStatus } from './api/websocket.js';
import {
  getState,
  setState,
  subscribe,
  setConversations,
  setMessages,
  addMessage,
  updateMessage,
  updateConversation,
  selectConversation,
  moveConversationSelection,
  setError,
  setComposerText,
  clearComposer,
  setMode,
  switchPane,
  jumpToTop,
  jumpToBottom,
  findNextUnread,
  getCurrentMessages,
  getCurrentConversation,
  openImageView,
  closeImageView,
  setImageViewRendered,
  setImageViewError,
  getAttachmentsInCurrentConversation,
  type Mode,
} from './state/store.js';
import { calculateLayout, renderFrame, type LayoutDimensions } from './views/layout.js';
import { renderConversations, calculateScrollOffset } from './views/conversations.js';
import { renderMessages } from './views/messages.js';
import { renderComposer, type ComposerState, handleComposerInput, handleComposerBackspace, handleComposerLeft, handleComposerRight, handleComposerHome, handleComposerEnd } from './views/composer.js';
import { renderStatusBar } from './views/statusbar.js';
import { renderHelpOverlay, renderHelpBar } from './views/help.js';
import { renderImageViewer, renderImageToString } from './views/imageViewer.js';

export interface AppOptions {
  host: string;
  theme?: string;
}

let apiClient: ApiClient;
let wsClient: WebSocketClient;
let layout: LayoutDimensions;
let composerState: ComposerState = { text: '', cursorPosition: 0 };

export async function startApp(options: AppOptions): Promise<void> {
  const { host, theme } = options;

  // Set theme if specified
  if (theme) {
    if (!setTheme(theme)) {
      console.error(`Unknown theme: ${theme}`);
      console.error(`Available themes: ${listThemes().join(', ')}`);
      process.exit(1);
    }
  }

  // Initialize state
  setState({ host, connectionStatus: 'disconnected' });

  // Create API clients
  apiClient = new ApiClient(host);
  wsClient = new WebSocketClient({
    host,
    onMessage: (message) => {
      addMessage(message);
      render();
    },
    onMessageUpdated: (message) => {
      updateMessage(message);
      render();
    },
    onConversationUpdated: (conversation) => {
      updateConversation(conversation);
      render();
    },
    onStatusChange: (status) => {
      setState({ connectionStatus: status });
      render();
    },
    onError: (error) => {
      setError(error);
      render();
    },
  });

  // Setup terminal
  terminal.enterFullscreen();
  terminal.hideCursor();
  terminal.clear();

  // Calculate layout
  layout = calculateLayout();

  // Setup cleanup
  setupCleanup(cleanup);

  // Handle terminal resize
  process.stdout.on('resize', () => {
    layout = calculateLayout();
    terminal.clear();
    renderFrame(layout);
    render();
  });

  // Render initial frame
  renderFrame(layout);
  render();

  // Start keyboard listener
  terminal.enableRawMode();
  startKeyListener(handleKey);

  // Connect WebSocket
  wsClient.connect();

  // Load initial data
  try {
    const conversations = await apiClient.getConversations();
    setConversations(conversations);

    // Load messages for first conversation
    if (conversations.length > 0) {
      const { messages } = await apiClient.getMessages(conversations[0].id);
      setMessages(conversations[0].id, messages);
    }
  } catch (error) {
    setError(`Failed to load conversations: ${(error as Error).message}`);
  }

  render();
}

function cleanup(): void {
  stopKeyListener();
  terminal.disableRawMode();
  terminal.showCursor();
  terminal.exitFullscreen();
  wsClient?.disconnect();
}

function render(): void {
  const state = getState();

  // Status bar
  renderStatusBar({
    title: 'Passage',
    status: state.connectionStatus,
    host: state.host,
    error: state.error,
    layout,
  });

  // Conversations pane
  const convScrollOffset = calculateScrollOffset(
    state.selectedConversationIndex,
    state.conversationScrollOffset,
    layout.convPaneHeight,
    state.conversations.length
  );
  if (convScrollOffset !== state.conversationScrollOffset) {
    setState({ conversationScrollOffset: convScrollOffset });
  }

  renderConversations({
    conversations: state.conversations,
    selectedIndex: state.selectedConversationIndex,
    scrollOffset: convScrollOffset,
    isActive: state.activePane === 'conversations' && state.mode === 'normal',
    layout,
  });

  // Messages pane
  renderMessages({
    messages: getCurrentMessages(),
    conversation: getCurrentConversation(),
    scrollOffset: state.messageScrollOffset,
    isActive: state.activePane === 'messages' && state.mode === 'normal',
    layout,
  });

  // Composer
  renderComposer({
    text: composerState.text,
    cursorPosition: composerState.cursorPosition,
    isActive: state.mode === 'compose',
    layout,
  });

  // Help bar
  renderHelpBar({ mode: state.mode, layout });

  // Help overlay (if in help mode)
  if (state.mode === 'help') {
    renderHelpOverlay({ layout });
  }

  // Image viewer overlay (if in imageView mode)
  if (state.mode === 'imageView' && state.imageView) {
    renderImageViewer({
      attachment: state.imageView.attachment,
      renderedImage: state.imageView.renderedImage,
      loading: state.imageView.loading,
      error: state.imageView.error,
      layout,
    });
  }

  // Hide cursor unless in compose mode
  if (state.mode !== 'compose') {
    terminal.hideCursor();
  }
}

async function handleKey(key: KeyEvent): Promise<void> {
  const state = getState();

  // Global keys (work in all modes)
  if (key.key === 'ctrl+c') {
    cleanup();
    process.exit(0);
  }

  // Mode-specific handling
  switch (state.mode) {
    case 'help':
      handleHelpKey(key);
      break;
    case 'compose':
      await handleComposeKey(key);
      break;
    case 'imageView':
      handleImageViewKey(key);
      break;
    default:
      await handleNormalKey(key);
  }

  render();
}

function handleHelpKey(key: KeyEvent): void {
  if (key.key === 'escape' || key.key === '?') {
    setMode('normal');
  }
}

function handleImageViewKey(key: KeyEvent): void {
  if (key.key === 'escape' || key.key === 'q') {
    closeImageView();
  }
}

async function handleComposeKey(key: KeyEvent): Promise<void> {
  const state = getState();

  switch (key.key) {
    case 'escape':
      setMode('normal');
      composerState = { text: '', cursorPosition: 0 };
      break;

    case 'enter':
      if (composerState.text.trim()) {
        await sendMessage();
      }
      break;

    case 'backspace':
      composerState = handleComposerBackspace(composerState);
      break;

    case 'left':
      composerState = handleComposerLeft(composerState);
      break;

    case 'right':
      composerState = handleComposerRight(composerState);
      break;

    case 'home':
      composerState = handleComposerHome(composerState);
      break;

    case 'end':
      composerState = handleComposerEnd(composerState);
      break;

    default:
      // Regular character input
      if (key.char && key.char.length === 1 && !key.ctrl && !key.alt) {
        composerState = handleComposerInput(composerState, key.char);
      }
  }
}

async function sendMessage(): Promise<void> {
  const state = getState();
  const conversation = getCurrentConversation();

  if (!conversation || !composerState.text.trim()) return;

  // Get the recipient (first participant that isn't me)
  const recipient = conversation.participants.find((p) => !p.isMe);
  if (!recipient) {
    setError('No recipient found');
    return;
  }

  try {
    const response = await apiClient.sendMessage({
      recipientId: recipient.handleIdentifier,
      text: composerState.text.trim(),
    });

    if (!response.success) {
      setError(response.error || 'Failed to send message');
      return;
    }

    // Clear composer on success
    composerState = { text: '', cursorPosition: 0 };
    setMode('normal');
  } catch (error) {
    setError(`Failed to send: ${(error as Error).message}`);
  }
}

async function handleNormalKey(key: KeyEvent): Promise<void> {
  const state = getState();

  switch (key.key) {
    // Quit
    case 'q':
      cleanup();
      process.exit(0);
      break;

    // Open image attachment
    case 'o':
      await openMostRecentImage();
      break;

    // Help
    case '?':
      setMode('help');
      break;

    // Compose
    case 'i':
    case 'r':
      if (state.selectedConversationId) {
        setMode('compose');
      }
      break;

    // Switch pane
    case 'tab':
      switchPane();
      break;

    // Navigation
    case 'j':
    case 'down':
      if (state.activePane === 'conversations') {
        moveConversationSelection(1);
        loadMessagesForSelected();
      } else {
        setState({ messageScrollOffset: Math.max(0, state.messageScrollOffset - 1) });
      }
      break;

    case 'k':
    case 'up':
      if (state.activePane === 'conversations') {
        moveConversationSelection(-1);
        loadMessagesForSelected();
      } else {
        setState({ messageScrollOffset: state.messageScrollOffset + 1 });
      }
      break;

    case 'gg':
      jumpToTop();
      if (state.activePane === 'conversations') {
        loadMessagesForSelected();
      }
      break;

    case 'G':
      jumpToBottom();
      if (state.activePane === 'conversations') {
        loadMessagesForSelected();
      }
      break;

    // Select conversation
    case 'enter':
      if (state.activePane === 'conversations') {
        switchPane(); // Move to messages pane
      }
      break;

    // Navigate conversations with [ and ]
    case '[':
      moveConversationSelection(-1);
      loadMessagesForSelected();
      break;

    case ']':
      moveConversationSelection(1);
      loadMessagesForSelected();
      break;

    // Jump to next unread
    case 'u':
      const unreadId = findNextUnread();
      if (unreadId) {
        selectConversation(unreadId);
        loadMessagesForSelected();
      }
      break;

    // Escape - back to conversations
    case 'escape':
      if (state.activePane === 'messages') {
        switchPane();
      }
      break;
  }
}

async function loadMessagesForSelected(): Promise<void> {
  const state = getState();
  const { selectedConversationId: id } = state;

  if (!id) return;

  // Check if we already have messages
  if (state.messages.has(id)) return;

  try {
    const { messages } = await apiClient.getMessages(id);
    setMessages(id, messages);
    render();
  } catch (error) {
    setError(`Failed to load messages: ${(error as Error).message}`);
  }
}

async function openMostRecentImage(): Promise<void> {
  const attachments = getAttachmentsInCurrentConversation();
  if (attachments.length === 0) {
    setError('No images in this conversation');
    return;
  }

  // Get the most recent image (last in the list)
  const attachment = attachments[attachments.length - 1];

  // Open the image viewer (shows loading state)
  openImageView(attachment);
  render();

  // Fetch and render the image
  try {
    const buffer = await apiClient.fetchAttachmentBuffer(attachment.filePath);
    const rendered = await renderImageToString(buffer, layout.width, layout.height);
    setImageViewRendered(rendered);
    render();
  } catch (error) {
    setImageViewError((error as Error).message);
    render();
  }
}
