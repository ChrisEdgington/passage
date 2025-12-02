import ansiEscapes from 'ansi-escapes';

export interface TerminalSize {
  cols: number;
  rows: number;
}

export const terminal = {
  // Enter full-screen mode (alternative buffer)
  enterFullscreen: () => process.stdout.write(ansiEscapes.enterAlternativeScreen),
  exitFullscreen: () => process.stdout.write(ansiEscapes.exitAlternativeScreen),

  // Cursor control
  moveTo: (x: number, y: number) => process.stdout.write(ansiEscapes.cursorTo(x, y)),
  hideCursor: () => process.stdout.write(ansiEscapes.cursorHide),
  showCursor: () => process.stdout.write(ansiEscapes.cursorShow),

  // Screen
  clear: () => process.stdout.write(ansiEscapes.clearScreen),
  clearLine: () => process.stdout.write(ansiEscapes.eraseLine),
  getSize: (): TerminalSize => ({
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  }),

  // Raw mode for key capture
  enableRawMode: () => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
    }
  },
  disableRawMode: () => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  },

  // Write to stdout
  write: (text: string) => process.stdout.write(text),

  // Write at specific position
  writeAt: (x: number, y: number, text: string) => {
    process.stdout.write(ansiEscapes.cursorTo(x, y) + text);
  },

  // Erase from cursor to end of line
  eraseToEndOfLine: () => process.stdout.write(ansiEscapes.eraseEndLine),

  // Scroll region
  setScrollRegion: (top: number, bottom: number) => {
    process.stdout.write(`\x1b[${top};${bottom}r`);
  },
  resetScrollRegion: () => {
    process.stdout.write('\x1b[r');
  },

  // Beep
  beep: () => process.stdout.write('\x07'),
};

// Setup cleanup on exit
export function setupCleanup(cleanup: () => void): void {
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
  process.on('uncaughtException', (err) => {
    cleanup();
    console.error('Uncaught exception:', err);
    process.exit(1);
  });
}
