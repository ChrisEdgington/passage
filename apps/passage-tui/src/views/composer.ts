import { terminal } from '../core/terminal.js';
import { colors } from '../core/themes.js';
import { truncate, padRight, stripAnsi } from '../core/render.js';
import type { LayoutDimensions } from './layout.js';

export interface ComposerViewProps {
  text: string;
  cursorPosition: number;
  isActive: boolean;
  layout: LayoutDimensions;
}

export function renderComposer(props: ComposerViewProps): void {
  const { text, cursorPosition, isActive, layout } = props;
  const { composerRow, composerWidth } = layout;

  const prompt = isActive ? colors.accent()('▸ ') : colors.fgMuted()('▸ ');
  const hint = colors.fgMuted()('Enter ⏎');

  const promptLen = 2;
  const hintLen = 8;
  const contentWidth = composerWidth - promptLen - hintLen - 4;

  // Display text or placeholder
  let displayText: string;
  let textStyle: (s: string) => string;

  if (text.length === 0) {
    displayText = 'Message...';
    textStyle = colors.fgMuted();
  } else {
    // Handle text longer than display area
    displayText = text;
    if (displayText.length > contentWidth) {
      // Show end of text (most relevant for typing)
      const start = Math.max(0, displayText.length - contentWidth + 1);
      displayText = '…' + displayText.slice(start + 1);
    }
    textStyle = colors.fg();
  }

  displayText = truncate(displayText, contentWidth);
  const padding = Math.max(0, contentWidth - displayText.length);

  const line = ' ' + prompt + textStyle(displayText) + ' '.repeat(padding) + '  ' + hint + ' ';

  terminal.writeAt(0, composerRow, padRight(line, composerWidth));

  // Show cursor position if active
  if (isActive && text.length > 0) {
    // Position cursor after prompt and text
    const cursorX = 3 + Math.min(cursorPosition, contentWidth - 1);
    terminal.moveTo(cursorX, composerRow);
    terminal.showCursor();
  } else if (isActive) {
    // Position cursor at start when empty
    terminal.moveTo(3, composerRow);
    terminal.showCursor();
  }
}

// Handle text input in compose mode
export interface ComposerState {
  text: string;
  cursorPosition: number;
}

export function handleComposerInput(
  state: ComposerState,
  char: string
): ComposerState {
  const { text, cursorPosition } = state;

  // Insert character at cursor position
  const newText = text.slice(0, cursorPosition) + char + text.slice(cursorPosition);

  return {
    text: newText,
    cursorPosition: cursorPosition + char.length,
  };
}

export function handleComposerBackspace(state: ComposerState): ComposerState {
  const { text, cursorPosition } = state;

  if (cursorPosition === 0) return state;

  const newText = text.slice(0, cursorPosition - 1) + text.slice(cursorPosition);

  return {
    text: newText,
    cursorPosition: cursorPosition - 1,
  };
}

export function handleComposerDelete(state: ComposerState): ComposerState {
  const { text, cursorPosition } = state;

  if (cursorPosition >= text.length) return state;

  const newText = text.slice(0, cursorPosition) + text.slice(cursorPosition + 1);

  return {
    text: newText,
    cursorPosition,
  };
}

export function handleComposerLeft(state: ComposerState): ComposerState {
  return {
    ...state,
    cursorPosition: Math.max(0, state.cursorPosition - 1),
  };
}

export function handleComposerRight(state: ComposerState): ComposerState {
  return {
    ...state,
    cursorPosition: Math.min(state.text.length, state.cursorPosition + 1),
  };
}

export function handleComposerHome(state: ComposerState): ComposerState {
  return {
    ...state,
    cursorPosition: 0,
  };
}

export function handleComposerEnd(state: ComposerState): ComposerState {
  return {
    ...state,
    cursorPosition: state.text.length,
  };
}
