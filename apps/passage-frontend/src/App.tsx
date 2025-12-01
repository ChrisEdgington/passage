import { useState, useCallback, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { ConversationList } from '@/components/ConversationList';
import { MessageThread } from '@/components/MessageThread';
import { MessageComposer } from '@/components/MessageComposer';
import { LoadingScreen } from '@/components/LoadingScreen';
import { MessagesController } from '@/controller';
import { initializeTheme } from '@/lib/theme';

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 400;

// Track 'g' key for vim-style 'gg' command
let lastKeyTime = 0;
let lastKey = '';

const App = observer(function App() {
  const controller = MessagesController.instance;
  const composerInputRef = useRef<HTMLInputElement>(null);
  const [isNavMode, setIsNavMode] = useState(true); // Track keyboard nav vs typing mode

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('passage-sidebar-width');
    return saved ? Number(saved) : DEFAULT_SIDEBAR_WIDTH;
  });
  const isDragging = useRef(false);

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  // Vim-style keyboard navigation
  useEffect(() => {
    const getComposerInput = () => document.querySelector('input[placeholder="iMessage"]') as HTMLInputElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const composerInput = getComposerInput();

      // Tab toggles between composer and navigation mode
      if (e.key === 'Tab') {
        e.preventDefault();
        if (isTyping) {
          // Exit typing mode
          (target as HTMLInputElement).blur();
          setIsNavMode(true);
        } else {
          // Enter typing mode
          if (composerInput) {
            composerInput.focus();
            setIsNavMode(false);
          }
        }
        return;
      }

      // Escape also exits typing mode
      if (e.key === 'Escape' && isTyping) {
        e.preventDefault();
        (target as HTMLInputElement).blur();
        setIsNavMode(true);
        return;
      }

      // Don't intercept typing (except Tab/Escape handled above)
      if (isTyping) return;

      const now = Date.now();

      switch (e.key) {
        // Navigation: j/k or arrow keys
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          controller.selectNextConversation();
          break;

        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          controller.selectPreviousConversation();
          break;

        // Jump to first: gg or Home
        case 'g':
          if (lastKey === 'g' && now - lastKeyTime < 500) {
            e.preventDefault();
            controller.selectFirstConversation();
            lastKey = '';
          } else {
            lastKey = 'g';
            lastKeyTime = now;
          }
          break;

        case 'Home':
          e.preventDefault();
          controller.selectFirstConversation();
          break;

        // Jump to last: G or End
        case 'G':
        case 'End':
          e.preventDefault();
          controller.selectLastConversation();
          break;

        // Jump to latest unread: u
        case 'u':
          e.preventDefault();
          controller.selectLatestUnread();
          break;

        // Focus composer: i (insert mode) or Enter
        case 'i':
        case 'Enter':
          e.preventDefault();
          if (composerInput) {
            composerInput.focus();
            setIsNavMode(false);
          }
          break;

        // Refresh conversations: r
        case 'r':
          e.preventDefault();
          controller.fetchConversations();
          if (controller.selectedConversationId) {
            controller.fetchMessages(controller.selectedConversationId);
          }
          break;

        default:
          // Reset 'g' tracking for other keys
          if (e.key !== 'g') {
            lastKey = '';
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controller]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('passage-sidebar-width', String(sidebarWidth));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarWidth]);

  // Show loading screen while initially connecting (no data yet)
  if (controller.connectionStatus === 'connecting' && controller.conversations.length === 0) {
    return <LoadingScreen />;
  }

  // Show main app (even during reconnection if we have data)
  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar - Conversation List */}
      <div className="flex-shrink-0 h-full" style={{ width: sidebarWidth }}>
        <ConversationList isNavMode={isNavMode} />
      </div>

      {/* Resize Handle */}
      <div
        className="w-1 h-full bg-border hover:bg-primary/50 cursor-col-resize transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown}
      />

      {/* Main Content - Message Thread + Composer */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 min-h-0">
          <MessageThread />
        </div>
        <MessageComposer />
      </div>
    </div>
  );
});

export default App;
