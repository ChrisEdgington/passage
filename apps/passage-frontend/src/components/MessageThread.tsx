import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { MessagesController, type PendingMessage } from '@/controller';
import { cn } from '@/lib/utils';
import { DateTime } from 'luxon';
import type { Message, Attachment, Reaction, ReactionType } from '@passage/shared-types';
import { X } from 'lucide-react';

// Check if attachment is an image
function isImageAttachment(attachment: Attachment): boolean {
  return attachment.mimeType.startsWith('image/');
}

// Get the API URL for an attachment
function getAttachmentUrl(attachment: Attachment): string {
  const controller = MessagesController.instance;
  if (!controller.apiBaseUrl) return '';

  // The filePath from the DB looks like ~/Library/Messages/Attachments/xx/yy/uuid/filename
  // We need to strip the prefix and pass just the relative part to the API
  const prefix = '~/Library/Messages/Attachments/';
  let relativePath = attachment.filePath;
  if (relativePath.startsWith(prefix)) {
    relativePath = relativePath.slice(prefix.length);
  }
  return `${controller.apiBaseUrl}/api/v1/attachments/${relativePath}`;
}

// Type guard for pending messages
function isPendingMessage(message: Message | PendingMessage): message is PendingMessage {
  return 'isPending' in message && message.isPending === true;
}

// Check if text is only emojis (1-3 emojis, no other characters)
function isEmojiOnlyMessage(text: string | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  // Regex to match emoji sequences (including skin tone modifiers, ZWJ sequences, etc.)
  // This pattern matches most common emoji including compound emojis
  const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji}\u200D\p{Emoji})+$/u;

  // Also check it's reasonably short (1-5 emojis typically)
  // Emojis can be 1-8 code points each due to ZWJ sequences
  if (trimmed.length > 40) return false;

  return emojiRegex.test(trimmed);
}

// Reaction type to emoji mapping
const REACTION_EMOJI: Record<ReactionType, string> = {
  love: '❤️',
  like: '👍',
  dislike: '👎',
  laugh: '😂',
  emphasis: '‼️',
  question: '❓',
};

// Group reactions by type and count them
function groupReactions(reactions: Reaction[]): { type: ReactionType; emoji: string; count: number; names: string[] }[] {
  const groups = new Map<ReactionType, { count: number; names: string[] }>();

  for (const reaction of reactions) {
    const existing = groups.get(reaction.type);
    if (existing) {
      existing.count++;
      existing.names.push(reaction.senderName);
    } else {
      groups.set(reaction.type, { count: 1, names: [reaction.senderName] });
    }
  }

  return Array.from(groups.entries()).map(([type, data]) => ({
    type,
    emoji: REACTION_EMOJI[type],
    count: data.count,
    names: data.names,
  }));
}

// Reactions badge component - positioned on top corner of bubble like iMessage
function ReactionsBadge({ reactions, isFromMe }: { reactions: Reaction[]; isFromMe: boolean }) {
  if (!reactions || reactions.length === 0) return null;

  const grouped = groupReactions(reactions);

  return (
    <div className={cn(
      'absolute -top-3 z-10 flex items-center',
      isFromMe ? '-left-1' : '-right-1'
    )}>
      <div className={cn(
        'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full',
        'bg-background/95 backdrop-blur-sm',
        'border border-border/50',
        'shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]'
      )}>
        {grouped.map(({ type, emoji, count, names }, index) => (
          <span
            key={type}
            title={names.join(', ')}
            className={cn(
              'inline-flex items-center',
              index > 0 && '-ml-0.5'
            )}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {count > 1 && (
              <span className="ml-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                {count}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// Image lightbox component
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
        aria-label="Close"
      >
        <X className="w-8 h-8" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[95vw] max-h-[95vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function MessageBubble({
  message,
  onImageClick,
  onCopy,
  isGroup
}: {
  message: Message | PendingMessage;
  onImageClick: (src: string, alt: string) => void;
  onCopy: (text: string) => void;
  isGroup: boolean;
}) {
  const formatTime = (timestamp: number) => {
    return DateTime.fromMillis(timestamp).toFormat('h:mm a');
  };

  const isPending = isPendingMessage(message);
  const hasAttachments = message.attachments && message.attachments.length > 0;
  const hasText = message.text && message.text.trim().length > 0;
  const isEmojiOnly = isEmojiOnlyMessage(message.text);

  const handleCopy = () => {
    if (message.text) {
      onCopy(message.text);
    }
  };

  const hasReactions = !isPending && 'reactions' in message && message.reactions.length > 0;

  return (
    <div className={cn('flex min-w-0', message.isFromMe ? 'justify-end' : 'justify-start', hasReactions ? 'mb-1 mt-3' : 'mb-1')}>
      <div className={cn('flex flex-col max-w-[85%] min-w-0', message.isFromMe ? 'items-end' : 'items-start')}>
        {/* Only show sender name for group conversations */}
        {!message.isFromMe && isGroup && (
          <span className="text-[11px] font-medium text-muted-foreground mb-0.5 px-1">
            {message.senderName}
          </span>
        )}

        {/* Image attachments - rendered outside the bubble for cleaner look */}
        {hasAttachments && (
          <div className={cn('relative', hasText && 'mb-1')}>
            {/* Reactions badge for image-only messages */}
            {!hasText && !isPending && 'reactions' in message && message.reactions.length > 0 && (
              <ReactionsBadge reactions={message.reactions} isFromMe={message.isFromMe} />
            )}
            <div className="space-y-1">
              {message.attachments!.filter(isImageAttachment).map((attachment) => (
                <img
                  key={attachment.id}
                  src={getAttachmentUrl(attachment)}
                  alt={attachment.filename || 'Image'}
                  className={cn(
                    'max-w-full rounded-lg max-h-72 object-contain cursor-pointer',
                    'hover:brightness-95 transition-all duration-150',
                    isPending && 'opacity-60'
                  )}
                  loading="lazy"
                  onClick={() => onImageClick(getAttachmentUrl(attachment), attachment.filename || 'Image')}
                />
              ))}
            </div>
          </div>
        )}

        {/* Emoji-only messages - larger, no bubble */}
        {hasText && isEmojiOnly && (
          <div className="relative">
            {!isPending && 'reactions' in message && message.reactions.length > 0 && (
              <ReactionsBadge reactions={message.reactions} isFromMe={message.isFromMe} />
            )}
            <div
              onClick={handleCopy}
              className={cn(
                'cursor-pointer active:scale-[0.98] transition-transform',
                isPending && 'opacity-60',
              )}
            >
              <p className="text-[48px] leading-none">{message.text}</p>
              <span className={cn(
                'text-[10px] block mt-1 text-muted-foreground',
                message.isFromMe ? 'text-right' : 'text-left',
                isPending && 'italic'
              )}>
                {isPending ? 'Sending...' : formatTime(message.timestamp)}
              </span>
            </div>
          </div>
        )}

        {/* Text bubble with reactions badge */}
        {hasText && !isEmojiOnly && (
          <div className="relative">
            {/* Reactions badge */}
            {!isPending && 'reactions' in message && message.reactions.length > 0 && (
              <ReactionsBadge reactions={message.reactions} isFromMe={message.isFromMe} />
            )}
            <div
              onClick={handleCopy}
              className={cn(
                'px-2.5 py-1 rounded-md overflow-hidden cursor-pointer active:scale-[0.98] transition-transform',
                message.isFromMe
                  ? 'bg-[var(--color-imessage-blue)] text-[var(--color-imessage-blue-foreground)] text-right'
                  : 'bg-[var(--color-sms-gray)] text-[var(--color-sms-gray-foreground)] text-left',
                isPending && 'opacity-60',
              )}
            >
              <p className="text-[14px] leading-[1.3] break-words whitespace-pre-wrap [overflow-wrap:anywhere]">{message.text}</p>
              <span className={cn(
                'text-[10px]',
                message.isFromMe ? 'float-right ml-2 text-white/70' : 'float-left mr-2 text-muted-foreground',
                isPending && 'italic'
              )}>
                {isPending ? 'Sending...' : formatTime(message.timestamp)}
              </span>
            </div>
          </div>
        )}

        {/* Non-image attachments */}
        {hasAttachments && message.attachments!.filter(a => !isImageAttachment(a)).length > 0 && (
          <div className={cn('space-y-1', hasText && 'mt-1')}>
            {message.attachments!.filter(a => !isImageAttachment(a)).map((attachment) => (
              <a
                key={attachment.id}
                href={getAttachmentUrl(attachment)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded-lg text-sm',
                  'bg-secondary hover:bg-secondary/80 transition-colors'
                )}
              >
                <span className="text-sm">📎</span>
                <span className="truncate">{attachment.filename || attachment.transferName || 'Attachment'}</span>
              </a>
            ))}
          </div>
        )}

        {/* Timestamp for image-only messages */}
        {hasAttachments && !hasText && (
          <span className={cn(
            'text-[10px] mt-0.5 px-1',
            isPending ? 'text-muted-foreground/70 italic' : 'text-muted-foreground'
          )}>
            {isPending ? 'Sending...' : formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

export const MessageThread = observer(() => {
  const controller = MessagesController.instance;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-scroll to bottom when conversation changes or new messages arrive
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated before scrolling
    const scrollToBottom = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };

    // Double RAF to ensure layout is complete (after React render + browser paint)
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottom);
    });
  }, [controller.selectedConversationId, controller.selectedMessages.length]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleImageClick = (src: string, alt: string) => {
    setLightboxImage({ src, alt });
  };

  const handleCopy = async (text: string) => {
    try {
      // Try the modern clipboard API first (requires secure context)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setToast('Copied');
        return;
      }

      // Fallback for non-secure contexts (HTTP over LAN)
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const success = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (success) {
        setToast('Copied');
      } else {
        setToast('Failed to copy');
      }
    } catch {
      setToast('Failed to copy');
    }
  };

  if (!controller.selectedConversation) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <p className="text-xl mb-2">No conversation selected</p>
          <p className="text-sm">Select a conversation from the list to view messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <h2 className="text-base font-semibold truncate">{controller.selectedConversation.displayName}</h2>
        {controller.selectedConversation.isGroup && (
          <p className="text-xs text-muted-foreground">{controller.selectedConversation.participants.length} participants</p>
        )}
      </div>

      {/* Messages - using native overflow scroll for proper resize handling */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-3 py-3"
      >
        <div className="space-y-1 w-full">
          {controller.selectedMessages.length === 0 && !controller.isLoading && (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages in this conversation</p>
            </div>
          )}

          {controller.selectedMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onImageClick={handleImageClick}
              onCopy={handleCopy}
              isGroup={controller.selectedConversation?.isGroup ?? false}
            />
          ))}

          {controller.isLoading && (
            <div className="text-center text-muted-foreground py-4">
              <p>Loading messages...</p>
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.src}
          alt={lightboxImage.alt}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-foreground text-background px-3 py-1.5 rounded-md text-sm shadow-lg animate-in fade-in zoom-in-95 duration-150">
          {toast}
        </div>
      )}
    </div>
  );
});
