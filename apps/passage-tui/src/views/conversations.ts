import type { Conversation } from '@passage/shared-types';
import { terminal } from '../core/terminal.js';
import { colors } from '../core/themes.js';
import { truncate, padRight, stripAnsi, formatTime } from '../core/render.js';
import { clearPane, writePaneLine, type LayoutDimensions } from './layout.js';

export interface ConversationsViewProps {
  conversations: Conversation[];
  selectedIndex: number;
  scrollOffset: number;
  isActive: boolean;
  layout: LayoutDimensions;
}

export function renderConversations(props: ConversationsViewProps): void {
  const { conversations, selectedIndex, scrollOffset, isActive, layout } = props;
  const { convPaneLeft: left, convPaneTop: top, convPaneWidth: width, convPaneHeight: height } = layout;

  // Clear the pane
  clearPane(left, top, width, height);

  // If no conversations, show placeholder
  if (conversations.length === 0) {
    const message = colors.fgMuted()('No conversations');
    writePaneLine(left, top + Math.floor(height / 2), width, '  ' + message);
    return;
  }

  // Calculate visible range
  const visibleCount = height;
  const startIndex = scrollOffset;
  const endIndex = Math.min(startIndex + visibleCount, conversations.length);

  // Render visible conversations
  for (let i = startIndex; i < endIndex; i++) {
    const conv = conversations[i];
    const row = top + (i - startIndex);
    const isSelected = i === selectedIndex;

    renderConversationRow(left, row, width, conv, isSelected, isActive);
  }

  // Show scroll indicators if needed
  if (scrollOffset > 0) {
    terminal.writeAt(left + width - 2, top, colors.fgMuted()('↑'));
  }
  if (endIndex < conversations.length) {
    terminal.writeAt(left + width - 2, top + height - 1, colors.fgMuted()('↓'));
  }
}

function renderConversationRow(
  left: number,
  row: number,
  width: number,
  conversation: Conversation,
  isSelected: boolean,
  paneActive: boolean
): void {
  const { displayName, unreadCount, lastMessage } = conversation;

  // Selection marker
  const marker = isSelected ? '▸ ' : '  ';

  // Unread indicator
  const unreadBadge = unreadCount > 0 ? ` (${unreadCount})` : '';

  // Name (truncated to fit)
  const maxNameLen = width - 4 - unreadBadge.length;
  const name = truncate(displayName, maxNameLen);

  // Build the line content
  let content: string;

  if (isSelected && paneActive) {
    // Active selection: highlighted background
    const text = marker + name + unreadBadge;
    content = colors.selected()(padRight(text, width));
  } else if (isSelected) {
    // Selected but pane not active: just marker, no highlight
    content = colors.fg()(marker) + colors.fg()(padRight(name + unreadBadge, width - 2));
  } else if (unreadCount > 0) {
    // Unread: colored name
    content = colors.fg()(marker) + colors.unread()(name) + colors.unread()(unreadBadge);
    content = padRight(content, width);
  } else {
    // Normal
    content = colors.fg()(marker) + colors.fgMuted()(name);
    content = padRight(content, width);
  }

  terminal.writeAt(left, row, content);
}

// Calculate scroll offset to keep selection visible
export function calculateScrollOffset(
  selectedIndex: number,
  currentOffset: number,
  viewportHeight: number,
  totalItems: number
): number {
  // Ensure selected item is visible
  if (selectedIndex < currentOffset) {
    return selectedIndex;
  }
  if (selectedIndex >= currentOffset + viewportHeight) {
    return selectedIndex - viewportHeight + 1;
  }
  return currentOffset;
}
