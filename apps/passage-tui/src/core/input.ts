export interface KeyEvent {
  key: string;
  char?: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

// Parse raw key buffer into structured KeyEvent
export function parseKey(data: Buffer): KeyEvent {
  const str = data.toString();
  const bytes = [...data];

  // Ctrl+C - exit
  if (str === '\x03') return { key: 'ctrl+c', ctrl: true };

  // Ctrl+D - exit
  if (str === '\x04') return { key: 'ctrl+d', ctrl: true };

  // Escape sequences (arrow keys, etc.)
  if (str.startsWith('\x1b')) {
    // Arrow keys
    if (str === '\x1b[A') return { key: 'up' };
    if (str === '\x1b[B') return { key: 'down' };
    if (str === '\x1b[C') return { key: 'right' };
    if (str === '\x1b[D') return { key: 'left' };

    // Home/End
    if (str === '\x1b[H' || str === '\x1b[1~') return { key: 'home' };
    if (str === '\x1b[F' || str === '\x1b[4~') return { key: 'end' };

    // Page Up/Down
    if (str === '\x1b[5~') return { key: 'pageup' };
    if (str === '\x1b[6~') return { key: 'pagedown' };

    // Delete
    if (str === '\x1b[3~') return { key: 'delete' };

    // Alt+key combinations
    if (str.length === 2 && str[0] === '\x1b') {
      return { key: str[1], alt: true };
    }

    // Just escape
    if (str === '\x1b') return { key: 'escape' };

    // Unknown escape sequence
    return { key: 'escape', char: str };
  }

  // Enter/Return
  if (str === '\r' || str === '\n') return { key: 'enter' };

  // Tab
  if (str === '\t') return { key: 'tab' };

  // Backspace (varies by terminal)
  if (str === '\x7f' || str === '\x08') return { key: 'backspace' };

  // Space
  if (str === ' ') return { key: 'space', char: ' ' };

  // Ctrl+letter combinations
  if (bytes.length === 1 && bytes[0] < 27) {
    const letter = String.fromCharCode(bytes[0] + 96);
    return { key: `ctrl+${letter}`, ctrl: true };
  }

  // Regular characters
  return { key: str, char: str };
}

export type KeyHandler = (key: KeyEvent) => void;

let keyHandler: KeyHandler | null = null;
let gSequenceTimer: NodeJS.Timeout | null = null;
let waitingForG = false;

// Handle 'gg' sequence for vim-style jump to top
export function handleKeyWithSequences(key: KeyEvent, handler: KeyHandler): void {
  if (key.key === 'g' && !key.ctrl && !key.alt) {
    if (waitingForG) {
      // Second 'g' - this is 'gg'
      if (gSequenceTimer) clearTimeout(gSequenceTimer);
      waitingForG = false;
      handler({ key: 'gg' });
    } else {
      // First 'g' - wait for second
      waitingForG = true;
      gSequenceTimer = setTimeout(() => {
        // Timeout - just a single 'g'
        waitingForG = false;
        handler({ key: 'g', char: 'g' });
      }, 300);
    }
  } else {
    // Not 'g' - cancel any pending sequence
    if (waitingForG) {
      if (gSequenceTimer) clearTimeout(gSequenceTimer);
      waitingForG = false;
      // First emit the 'g'
      handler({ key: 'g', char: 'g' });
    }
    handler(key);
  }
}

// Start listening for keyboard input
export function startKeyListener(handler: KeyHandler): void {
  keyHandler = handler;
  process.stdin.on('data', (data: Buffer) => {
    const key = parseKey(data);
    if (keyHandler) {
      handleKeyWithSequences(key, keyHandler);
    }
  });
}

// Stop listening for keyboard input
export function stopKeyListener(): void {
  keyHandler = null;
  process.stdin.removeAllListeners('data');
  if (gSequenceTimer) clearTimeout(gSequenceTimer);
}
