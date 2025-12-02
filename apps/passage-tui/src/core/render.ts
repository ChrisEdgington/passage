import { colors, box, getTheme } from './themes.js';
import chalk from 'chalk';

// Render a sent message (right-aligned, themed background)
export function renderSentMessage(text: string, time: string, width: number): string {
  const content = colors.sent()(` ${text} `);
  const timestamp = colors.fgMuted()(time);
  const contentLength = text.length + 2; // text + 2 spaces padding
  const timeLength = time.length;
  const totalLength = contentLength + 1 + timeLength; // +1 for space before time
  const padding = Math.max(0, width - totalLength);
  return ' '.repeat(padding) + content + ' ' + timestamp;
}

// Render a received message (left-aligned, themed background)
export function renderReceivedMessage(text: string, time: string): string {
  const content = colors.received()(` ${text} `);
  const timestamp = colors.fgMuted()(time);
  return content + ' ' + timestamp;
}

// Word wrap text to fit width, returns array of lines
export function wrapText(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) return [text];

  const lines: string[] = [];
  const words = text.split(' ');
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

// Render a horizontal line
export function renderHorizontalLine(width: number): string {
  return colors.border()(box.horizontal.repeat(width));
}

// Render a bordered box top
export function renderBoxTop(width: number): string {
  return colors.border()(box.topLeft + box.horizontal.repeat(width - 2) + box.topRight);
}

// Render a bordered box bottom
export function renderBoxBottom(width: number): string {
  return colors.border()(box.bottomLeft + box.horizontal.repeat(width - 2) + box.bottomRight);
}

// Render text padded to width
export function padRight(text: string, width: number): string {
  const visibleLength = stripAnsi(text).length;
  if (visibleLength >= width) return text;
  return text + ' '.repeat(width - visibleLength);
}

export function padLeft(text: string, width: number): string {
  const visibleLength = stripAnsi(text).length;
  if (visibleLength >= width) return text;
  return ' '.repeat(width - visibleLength) + text;
}

export function padCenter(text: string, width: number): string {
  const visibleLength = stripAnsi(text).length;
  if (visibleLength >= width) return text;
  const leftPad = Math.floor((width - visibleLength) / 2);
  const rightPad = width - visibleLength - leftPad;
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
}

// Strip ANSI codes to get actual visible length
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Truncate text to max length with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

// Render a conversation list item
export function renderConversationItem(
  name: string,
  unreadCount: number,
  isSelected: boolean,
  width: number
): string {
  const marker = isSelected ? '▸ ' : '  ';
  const unread = unreadCount > 0 ? ` (${unreadCount})` : '';
  const nameWithUnread = truncate(name, width - 6) + unread;

  let content: string;
  if (isSelected) {
    content = colors.selected()(marker + padRight(nameWithUnread, width - 2));
  } else if (unreadCount > 0) {
    content = colors.fg()(marker) + colors.unread()(padRight(nameWithUnread, width - 2));
  } else {
    content = colors.fg()(marker + padRight(nameWithUnread, width - 2));
  }

  return content;
}

// Render the status bar
export function renderStatusBar(
  title: string,
  status: 'connected' | 'disconnected' | 'connecting',
  host: string,
  width: number
): string {
  const theme = getTheme();

  // Left side: title
  const left = colors.accent()(' ' + title);

  // Right side: connection status
  const statusIcon = status === 'connected' ? '●' : status === 'connecting' ? '◐' : '○';
  const statusColor = status === 'connected' ? colors.online() : colors.offline();
  const right = statusColor(statusIcon) + ' ' + colors.fgMuted()(host) + ' ';

  // Calculate padding
  const leftLen = stripAnsi(left).length;
  const rightLen = stripAnsi(right).length;
  const padding = Math.max(0, width - leftLen - rightLen);

  return chalk.bgHex(theme.bgAlt)(left + ' '.repeat(padding) + right);
}

// Render help bar at bottom
export function renderHelpBar(items: Array<{ key: string; desc: string }>, width: number): string {
  const parts = items.map(({ key, desc }) => colors.accent()(key) + colors.fgMuted()(' ' + desc));
  const joined = parts.join(colors.border()(' │ '));
  return ' ' + padRight(joined, width - 1);
}

// Render the composer input line
export function renderComposer(text: string, width: number): string {
  const prompt = colors.accent()('▸ ');
  const placeholder = text.length === 0 ? colors.fgMuted()('Message...') : colors.fg()(text);
  const hint = colors.fgMuted()('Enter ⏎');

  const promptLen = 2;
  const hintLen = 7;
  const contentWidth = width - promptLen - hintLen - 4;

  const displayText = truncate(text || 'Message...', contentWidth);
  const content = text.length === 0 ? colors.fgMuted()(displayText) : colors.fg()(displayText);
  const padding = Math.max(0, contentWidth - displayText.length);

  return ' ' + prompt + content + ' '.repeat(padding) + '  ' + hint + ' ';
}

// Render an attachment placeholder
export function renderAttachment(filename: string, size: string, width: number): string {
  const icon = '📷';
  const hint = colors.fgMuted()('[o]');
  const content = `${icon} ${truncate(filename, 20)} (${size}) `;
  return content + hint;
}

// Format timestamp for display
export function formatTime(date: Date | string | number): string {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // Check if this week
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (d > weekAgo) {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }

  // Older
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format file size
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
