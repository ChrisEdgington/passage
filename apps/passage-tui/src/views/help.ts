import { terminal } from '../core/terminal.js';
import { colors, box } from '../core/themes.js';
import { padRight, padCenter, stripAnsi } from '../core/render.js';
import type { LayoutDimensions } from './layout.js';

const HELP_CONTENT = [
  { section: 'Navigation' },
  { key: 'j / ↓', desc: 'Move down' },
  { key: 'k / ↑', desc: 'Move up' },
  { key: 'g g', desc: 'Jump to top' },
  { key: 'G', desc: 'Jump to bottom' },
  { key: 'Tab', desc: 'Switch pane' },
  { key: 'Enter', desc: 'Select / Open' },
  { key: 'Esc', desc: 'Cancel / Back' },
  { section: 'Actions' },
  { key: 'i / r', desc: 'Compose message' },
  { key: 'u', desc: 'Jump to next unread' },
  { key: '[ / ]', desc: 'Prev / Next conversation' },
  { key: 'o', desc: 'Open attachment' },
  { key: 'y', desc: 'Copy message' },
  { section: 'General' },
  { key: '?', desc: 'Toggle help' },
  { key: 'q', desc: 'Quit' },
  { key: 'Ctrl+C', desc: 'Force quit' },
];

export interface HelpOverlayProps {
  layout: LayoutDimensions;
}

export function renderHelpOverlay(props: HelpOverlayProps): void {
  const { layout } = props;
  const { width, height } = layout;

  // Calculate overlay dimensions
  const overlayWidth = Math.min(50, width - 4);
  const overlayHeight = Math.min(HELP_CONTENT.length + 4, height - 4);
  const startX = Math.floor((width - overlayWidth) / 2);
  const startY = Math.floor((height - overlayHeight) / 2);

  // Draw background/border
  drawOverlayBox(startX, startY, overlayWidth, overlayHeight, 'Keyboard Shortcuts');

  // Draw content
  let y = startY + 2;
  for (const item of HELP_CONTENT) {
    if (y >= startY + overlayHeight - 1) break;

    if ('section' in item) {
      // Section header
      const header = colors.accent()(item.section);
      terminal.writeAt(startX + 2, y, header);
    } else {
      // Key-description pair
      const key = colors.fg()(padRight(item.key, 12));
      const desc = colors.fgMuted()(item.desc);
      terminal.writeAt(startX + 2, y, key + desc);
    }
    y++;
  }

  // Footer hint
  const hint = colors.fgMuted()('Press ? or Esc to close');
  terminal.writeAt(startX + 2, startY + overlayHeight - 2, hint);
}

function drawOverlayBox(
  x: number,
  y: number,
  width: number,
  height: number,
  title: string
): void {
  const border = colors.border();
  const bg = '  '; // Just spaces for background

  // Top border with title
  const titlePadded = ` ${title} `;
  const leftBorder = Math.floor((width - titlePadded.length - 2) / 2);
  const rightBorder = width - titlePadded.length - leftBorder - 2;
  terminal.writeAt(
    x,
    y,
    border(
      box.topLeft +
        box.horizontal.repeat(leftBorder) +
        colors.accent()(titlePadded) +
        border(box.horizontal.repeat(rightBorder) + box.topRight)
    )
  );

  // Side borders and background
  for (let row = y + 1; row < y + height - 1; row++) {
    terminal.writeAt(x, row, border(box.vertical) + ' '.repeat(width - 2) + border(box.vertical));
  }

  // Bottom border
  terminal.writeAt(
    x,
    y + height - 1,
    border(box.bottomLeft + box.horizontal.repeat(width - 2) + box.bottomRight)
  );
}

// Help bar at the bottom of the screen (always visible)
export interface HelpBarProps {
  mode: 'normal' | 'compose' | 'help' | 'search' | 'imageView';
  layout: LayoutDimensions;
}

export function renderHelpBar(props: HelpBarProps): void {
  const { mode, layout } = props;
  const { helpBarRow, helpBarWidth: width } = layout;

  let items: Array<{ key: string; desc: string }>;

  switch (mode) {
    case 'compose':
      items = [
        { key: 'Enter', desc: 'send' },
        { key: 'Esc', desc: 'cancel' },
      ];
      break;
    case 'help':
      items = [
        { key: '?', desc: 'close' },
        { key: 'Esc', desc: 'close' },
      ];
      break;
    case 'search':
      items = [
        { key: 'Enter', desc: 'search' },
        { key: 'Esc', desc: 'cancel' },
      ];
      break;
    case 'imageView':
      items = [
        { key: 'Esc', desc: 'close' },
        { key: 'q', desc: 'close' },
      ];
      break;
    default:
      items = [
        { key: 'j/k', desc: 'nav' },
        { key: 'Tab', desc: 'pane' },
        { key: 'i', desc: 'compose' },
        { key: 'o', desc: 'image' },
        { key: '?', desc: 'help' },
        { key: 'q', desc: 'quit' },
      ];
  }

  const parts = items.map(({ key, desc }) => colors.accent()(key) + colors.fgMuted()(' ' + desc));
  const joined = parts.join(colors.border()(' │ '));

  terminal.writeAt(0, helpBarRow, ' ' + padRight(joined, width - 1));
}
