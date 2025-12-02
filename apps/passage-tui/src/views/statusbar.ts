import { terminal } from '../core/terminal.js';
import { colors, getTheme } from '../core/themes.js';
import { padRight, stripAnsi } from '../core/render.js';
import type { ConnectionStatus } from '../api/websocket.js';
import type { LayoutDimensions } from './layout.js';
import chalk from 'chalk';

export interface StatusBarProps {
  title: string;
  status: ConnectionStatus;
  host: string;
  error: string | null;
  layout: LayoutDimensions;
}

export function renderStatusBar(props: StatusBarProps): void {
  const { title, status, host, error, layout } = props;
  const { statusBarRow, statusBarWidth: width } = layout;
  const theme = getTheme();

  // Left side: title (or error if present)
  let left: string;
  if (error) {
    left = colors.error()(' ⚠ ' + error);
  } else {
    left = colors.accent()(' 💬 ' + title);
  }

  // Right side: connection status + host
  const statusIcon = status === 'connected' ? '●' : status === 'connecting' ? '◐' : '○';
  const statusColor = status === 'connected' ? colors.online() : colors.offline();
  const statusText = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting' : 'Disconnected';
  const right = statusColor(statusIcon + ' ' + statusText) + ' ' + colors.fgMuted()(host) + ' ';

  // Calculate padding
  const leftLen = stripAnsi(left).length;
  const rightLen = stripAnsi(right).length;
  const padding = Math.max(0, width - leftLen - rightLen);

  const line = chalk.bgHex(theme.bgAlt)(left + ' '.repeat(padding) + right);

  terminal.writeAt(0, statusBarRow, line);
}
