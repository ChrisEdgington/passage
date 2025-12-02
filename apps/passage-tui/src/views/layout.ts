import { terminal, type TerminalSize } from '../core/terminal.js';
import { colors, box } from '../core/themes.js';
import { padRight, stripAnsi } from '../core/render.js';

export interface LayoutDimensions {
  // Full terminal
  width: number;
  height: number;

  // Status bar (row 0)
  statusBarRow: number;
  statusBarWidth: number;

  // Conversation pane (left)
  convPaneLeft: number;
  convPaneTop: number;
  convPaneWidth: number;
  convPaneHeight: number;

  // Message pane (right)
  msgPaneLeft: number;
  msgPaneTop: number;
  msgPaneWidth: number;
  msgPaneHeight: number;

  // Composer (bottom)
  composerRow: number;
  composerWidth: number;

  // Help bar (last row)
  helpBarRow: number;
  helpBarWidth: number;
}

// Calculate layout dimensions based on terminal size
export function calculateLayout(size?: TerminalSize): LayoutDimensions {
  const { cols: width, rows: height } = size || terminal.getSize();

  // Fixed rows: status bar (1) + separator (1) + composer (1) + separator (1) + help bar (1) = 5
  // That leaves (height - 5) for the main content area
  const contentHeight = height - 5;

  // Conversation pane is about 1/4 of width, minimum 20, max 40
  const convWidth = Math.max(20, Math.min(40, Math.floor(width * 0.25)));

  // Message pane gets the rest (minus 1 for vertical separator)
  const msgWidth = width - convWidth - 1;

  return {
    width,
    height,

    statusBarRow: 0,
    statusBarWidth: width,

    convPaneLeft: 0,
    convPaneTop: 2, // After status bar + separator
    convPaneWidth: convWidth,
    convPaneHeight: contentHeight,

    msgPaneLeft: convWidth + 1, // After conversation pane + separator
    msgPaneTop: 2,
    msgPaneWidth: msgWidth,
    msgPaneHeight: contentHeight,

    composerRow: height - 3, // Before separator and help bar
    composerWidth: width,

    helpBarRow: height - 1,
    helpBarWidth: width,
  };
}

// Render the frame/borders only (called once on startup and resize)
export function renderFrame(layout: LayoutDimensions): void {
  const { width, convPaneWidth, convPaneTop, convPaneHeight } = layout;

  // Separator after status bar (row 1)
  terminal.writeAt(0, 1, colors.border()(box.horizontal.repeat(width)));

  // Vertical separator between panes
  for (let y = convPaneTop; y < convPaneTop + convPaneHeight; y++) {
    terminal.writeAt(convPaneWidth, y, colors.border()(box.vertical));
  }

  // Separator before composer
  terminal.writeAt(0, layout.composerRow - 1, colors.border()(box.horizontal.repeat(width)));

  // Separator before help bar
  terminal.writeAt(0, layout.helpBarRow - 1, colors.border()(box.horizontal.repeat(width)));
}

// Clear a specific pane area
export function clearPane(
  left: number,
  top: number,
  width: number,
  height: number
): void {
  const emptyLine = ' '.repeat(width);
  for (let y = top; y < top + height; y++) {
    terminal.writeAt(left, y, emptyLine);
  }
}

// Write a line within a pane, handling clipping
export function writePaneLine(
  left: number,
  row: number,
  width: number,
  content: string
): void {
  // Truncate content to fit width
  const visibleLen = stripAnsi(content).length;
  let output: string;

  if (visibleLen > width) {
    // Need to truncate - this is tricky with ANSI codes
    // For simplicity, we'll pad/truncate the visible content
    output = padRight(content, width);
  } else {
    output = padRight(content, width);
  }

  terminal.writeAt(left, row, output);
}

// Render a title row in a pane
export function renderPaneTitle(
  left: number,
  row: number,
  width: number,
  title: string,
  isActive: boolean
): void {
  const styled = isActive ? colors.accent()(title) : colors.fgMuted()(title);
  const separator = colors.border()(box.horizontal.repeat(width - stripAnsi(title).length - 1));
  writePaneLine(left, row, width, styled + separator);
}
