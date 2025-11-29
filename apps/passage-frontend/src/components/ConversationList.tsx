import { observer } from 'mobx-react-lite';
import { MessagesController } from '@/controller';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeSelector } from '@/components/ThemeSelector';
import { SettingsDropdown } from '@/components/SettingsDropdown';
import { AboutModal } from '@/components/AboutModal';
import { cn } from '@/lib/utils';
import { DateTime } from 'luxon';
import type { Conversation } from '@passage/shared-types';

function ConversationItem({ conversation, isSelected, isNavMode, onClick }: { conversation: Conversation; isSelected: boolean; isNavMode: boolean; onClick: () => void }) {
  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatTime = (timestamp: number) => {
    const dt = DateTime.fromMillis(timestamp);
    const now = DateTime.now();

    if (dt.hasSame(now, 'day')) {
      return dt.toFormat('h:mm a');
    }
    if (dt.hasSame(now.minus({ days: 1 }), 'day')) {
      return 'Yesterday';
    }
    if (dt.hasSame(now, 'week')) {
      return dt.toFormat('ccc'); // Mon, Tue, etc.
    }
    return dt.toFormat('M/d/yy');
  };

  const lastMessagePreview = conversation.lastMessage?.text?.slice(0, 50) || (conversation.lastMessage ? 'Attachment' : '');

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 transition-all duration-150 focus:outline-none min-h-[72px] rounded-xl mx-2 my-0.5',
        isSelected
          ? 'bg-imessage-blue text-imessage-blue-foreground shadow-md'
          : 'hover:bg-accent/80 active:scale-[0.98]',
        isSelected && isNavMode && 'ring-2 ring-offset-2 ring-offset-sidebar',
      )}
      style={isSelected && isNavMode ? { '--tw-ring-color': 'var(--color-nav-focus)' } as React.CSSProperties : undefined}
    >
      <Avatar className="h-12 w-12 shadow-sm">
        <AvatarFallback className={cn(
          'text-sm font-semibold',
          isSelected
            ? 'bg-white/20 text-white'
            : 'bg-muted text-muted-foreground',
        )}>
          {getInitials(conversation.displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <h3 className={cn(
            'font-semibold text-[15px] truncate',
            isSelected ? 'text-imessage-blue-foreground' : 'text-foreground'
          )}>
            {conversation.displayName}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {conversation.lastMessage && (
              <span className={cn(
                'text-xs',
                isSelected ? 'text-imessage-blue-foreground/70' : 'text-muted-foreground'
              )}>
                {formatTime(conversation.lastMessage.timestamp)}
              </span>
            )}
            {conversation.unreadCount > 0 && !isSelected && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
        <p className={cn(
          'text-sm truncate',
          isSelected ? 'text-imessage-blue-foreground/70' : 'text-muted-foreground'
        )}>
          {lastMessagePreview}
        </p>
      </div>
    </button>
  );
}

export const ConversationList = observer(({ isNavMode }: { isNavMode: boolean }) => {
  const controller = MessagesController.instance;

  return (
    <div className="h-full flex flex-col bg-sidebar">
      <div className="px-4 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Passage</h1>
          {!controller.isConnected && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              Reconnecting...
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <AboutModal />
          <SettingsDropdown />
          <ThemeSelector />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col pb-2">
          {controller.conversations.length === 0 && !controller.isLoading && (
            <div className="p-8 text-center text-muted-foreground">
              <p>No conversations yet</p>
            </div>
          )}

          {controller.conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={controller.selectedConversationId === conversation.id}
              isNavMode={isNavMode}
              onClick={() => controller.selectConversation(conversation.id)}
            />
          ))}

          {controller.isLoading && (
            <div className="p-8 text-center text-muted-foreground">
              <p>Loading conversations...</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
