import type { Message, Conversation } from '@passage/shared-types';
import { terminal } from '../core/terminal.js';
import { colors } from '../core/themes.js';
import {
  wrapText,
  truncate,
  padRight,
  stripAnsi,
  formatTime,
  formatSize,
} from '../core/render.js';
import { clearPane, writePaneLine, type LayoutDimensions } from './layout.js';

export interface MessagesViewProps {
  messages: Message[];
  conversation: Conversation | null;
  scrollOffset: number;
  isActive: boolean;
  layout: LayoutDimensions;
}

interface RenderedLine {
  content: string;
  messageIndex: number;
}

export function renderMessages(props: MessagesViewProps): void {
  const { messages, conversation, scrollOffset, isActive, layout } = props;
  const { msgPaneLeft: left, msgPaneTop: top, msgPaneWidth: width, msgPaneHeight: height } = layout;

  // Clear the pane first
  clearPane(left, top, width, height);

  // Render conversation header
  if (conversation) {
    const headerText = isActive ? colors.accent()(conversation.displayName) : colors.fg()(conversation.displayName);
    writePaneLine(left, top, width, ' ' + headerText);
    // Separator line under header
    writePaneLine(left, top + 1, width, colors.border()('─'.repeat(width)));
  } else {
    const placeholder = colors.fgMuted()('Select a conversation');
    writePaneLine(left, top + Math.floor(height / 2), width, '  ' + placeholder);
    return;
  }

  // If no messages, show placeholder
  if (messages.length === 0) {
    const placeholder = colors.fgMuted()('No messages yet');
    writePaneLine(left, top + Math.floor(height / 2), width, '  ' + placeholder);
    return;
  }

  // Pre-render all messages into lines
  const contentWidth = width - 4; // Padding on sides
  const allLines = renderAllMessages(messages, contentWidth);

  // Calculate visible range (accounting for header which takes 2 rows)
  const contentTop = top + 2;
  const contentHeight = height - 2;

  // Auto-scroll to bottom (show most recent messages)
  const totalLines = allLines.length;
  let startLine = Math.max(0, totalLines - contentHeight);

  // Apply manual scroll offset if any
  startLine = Math.max(0, startLine - scrollOffset);

  // Render visible lines
  for (let i = 0; i < contentHeight && startLine + i < totalLines; i++) {
    const line = allLines[startLine + i];
    writePaneLine(left, contentTop + i, width, '  ' + line.content);
  }

  // Scroll indicator at top if not showing oldest messages
  if (startLine > 0) {
    terminal.writeAt(left + width - 2, contentTop, colors.fgMuted()('↑'));
  }
}

function renderAllMessages(messages: Message[], width: number): RenderedLine[] {
  const lines: RenderedLine[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgLines = renderMessage(msg, width);
    for (const line of msgLines) {
      lines.push({ content: line, messageIndex: i });
    }
    // Add blank line between messages from different senders
    if (i < messages.length - 1 && messages[i + 1].isFromMe !== msg.isFromMe) {
      lines.push({ content: '', messageIndex: i });
    }
  }

  return lines;
}

function renderMessage(message: Message, width: number): string[] {
  const lines: string[] = [];
  const { text, isFromMe, timestamp, attachments } = message;

  // Format timestamp
  const time = formatTime(timestamp);

  // Handle attachments
  for (const attachment of attachments) {
    const line = renderAttachment(attachment, isFromMe, width, time);
    lines.push(line);
  }

  // Handle text
  if (text) {
    const textLines = renderTextMessage(text, isFromMe, width, time);
    lines.push(...textLines);
  }

  return lines;
}

function renderTextMessage(
  text: string,
  isFromMe: boolean,
  width: number,
  time: string
): string[] {
  // Calculate available width for text (leave room for timestamp)
  const timeWidth = time.length + 2; // space + time
  const maxTextWidth = Math.floor(width * 0.7) - 2; // 70% width, minus padding

  // Wrap text if needed
  const wrappedLines = wrapText(text, maxTextWidth);
  const result: string[] = [];

  for (let i = 0; i < wrappedLines.length; i++) {
    const lineText = wrappedLines[i];
    const isLastLine = i === wrappedLines.length - 1;

    // Only show timestamp on last line
    const lineTime = isLastLine ? time : '';

    if (isFromMe) {
      // Right-aligned with blue background
      const content = colors.sent()(` ${lineText} `);
      const timestamp = lineTime ? ' ' + colors.fgMuted()(lineTime) : '';
      const totalLen = lineText.length + 2 + (lineTime ? lineTime.length + 1 : 0);
      const padding = Math.max(0, width - totalLen);
      result.push(' '.repeat(padding) + content + timestamp);
    } else {
      // Left-aligned with gray background
      const content = colors.received()(` ${lineText} `);
      const timestamp = lineTime ? ' ' + colors.fgMuted()(lineTime) : '';
      result.push(content + timestamp);
    }
  }

  return result;
}

function renderAttachment(
  attachment: { filename: string; totalBytes: number; mimeType: string },
  isFromMe: boolean,
  width: number,
  time: string
): string {
  const icon = attachment.mimeType.startsWith('image/') ? '📷' : '📎';
  const size = formatSize(attachment.totalBytes);
  const name = truncate(attachment.filename, 20);
  const hint = colors.fgMuted()('[o]');

  const content = `${icon} ${name} (${size}) `;

  if (isFromMe) {
    // Right-aligned
    const bg = colors.sent()(` ${content}`);
    const timestamp = ' ' + colors.fgMuted()(time);
    const totalLen = content.length + 1 + time.length + 1 + 3; // +3 for hint
    const padding = Math.max(0, width - totalLen);
    return ' '.repeat(padding) + bg + ' ' + hint + timestamp;
  } else {
    // Left-aligned
    const bg = colors.received()(` ${content}`);
    const timestamp = ' ' + colors.fgMuted()(time);
    return bg + ' ' + hint + timestamp;
  }
}
