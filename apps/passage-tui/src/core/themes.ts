import chalk, { type ChalkInstance } from 'chalk';

export interface Theme {
  name: string;

  // Backgrounds
  bg: string;           // Main background
  bgAlt: string;        // Alternative/highlight background
  bgSent: string;       // Sent message background
  bgReceived: string;   // Received message background

  // Foregrounds
  fg: string;           // Main text
  fgMuted: string;      // Muted/secondary text
  fgOnSent: string;     // Text on sent messages
  fgOnReceived: string; // Text on received messages

  // Accents
  accent: string;       // Primary accent (selection, focus)
  success: string;      // Online/success indicator
  error: string;        // Error/unread indicator
  warning: string;      // Warning

  // UI
  border: string;       // Pane borders
  selection: string;    // Selected item background
}

// Tokyo Night - Default theme
export const tokyoNight: Theme = {
  name: 'tokyo-night',
  bg: '#1a1b26',
  bgAlt: '#24283b',
  bgSent: '#7aa2f7',
  bgReceived: '#3b4261',
  fg: '#c0caf5',
  fgMuted: '#565f89',
  fgOnSent: '#1a1b26',
  fgOnReceived: '#c0caf5',
  accent: '#7aa2f7',
  success: '#9ece6a',
  error: '#f7768e',
  warning: '#e0af68',
  border: '#3b4261',
  selection: '#283457',
};

// Catppuccin Mocha
export const catppuccinMocha: Theme = {
  name: 'catppuccin-mocha',
  bg: '#1e1e2e',
  bgAlt: '#313244',
  bgSent: '#89b4fa',
  bgReceived: '#45475a',
  fg: '#cdd6f4',
  fgMuted: '#6c7086',
  fgOnSent: '#1e1e2e',
  fgOnReceived: '#cdd6f4',
  accent: '#cba6f7',
  success: '#a6e3a1',
  error: '#f38ba8',
  warning: '#f9e2af',
  border: '#45475a',
  selection: '#585b70',
};

// Rose Pine
export const rosePine: Theme = {
  name: 'rose-pine',
  bg: '#191724',
  bgAlt: '#1f1d2e',
  bgSent: '#c4a7e7',
  bgReceived: '#26233a',
  fg: '#e0def4',
  fgMuted: '#6e6a86',
  fgOnSent: '#191724',
  fgOnReceived: '#e0def4',
  accent: '#ebbcba',
  success: '#31748f',
  error: '#eb6f92',
  warning: '#f6c177',
  border: '#26233a',
  selection: '#403d52',
};

// Gruvbox Dark
export const gruvbox: Theme = {
  name: 'gruvbox',
  bg: '#282828',
  bgAlt: '#3c3836',
  bgSent: '#458588',
  bgReceived: '#504945',
  fg: '#ebdbb2',
  fgMuted: '#928374',
  fgOnSent: '#282828',
  fgOnReceived: '#ebdbb2',
  accent: '#d79921',
  success: '#98971a',
  error: '#cc241d',
  warning: '#d79921',
  border: '#504945',
  selection: '#665c54',
};

// Nord
export const nord: Theme = {
  name: 'nord',
  bg: '#2e3440',
  bgAlt: '#3b4252',
  bgSent: '#88c0d0',
  bgReceived: '#4c566a',
  fg: '#eceff4',
  fgMuted: '#4c566a',
  fgOnSent: '#2e3440',
  fgOnReceived: '#eceff4',
  accent: '#88c0d0',
  success: '#a3be8c',
  error: '#bf616a',
  warning: '#ebcb8b',
  border: '#4c566a',
  selection: '#434c5e',
};

// Dracula
export const dracula: Theme = {
  name: 'dracula',
  bg: '#282a36',
  bgAlt: '#44475a',
  bgSent: '#bd93f9',
  bgReceived: '#44475a',
  fg: '#f8f8f2',
  fgMuted: '#6272a4',
  fgOnSent: '#282a36',
  fgOnReceived: '#f8f8f2',
  accent: '#ff79c6',
  success: '#50fa7b',
  error: '#ff5555',
  warning: '#f1fa8c',
  border: '#44475a',
  selection: '#44475a',
};

// All built-in themes
export const themes: Record<string, Theme> = {
  'tokyo-night': tokyoNight,
  'catppuccin-mocha': catppuccinMocha,
  'rose-pine': rosePine,
  gruvbox,
  nord,
  dracula,
};

// Current active theme
let currentTheme: Theme = tokyoNight;

export function setTheme(themeName: string): boolean {
  const theme = themes[themeName];
  if (theme) {
    currentTheme = theme;
    return true;
  }
  return false;
}

export function setCustomTheme(theme: Theme): void {
  currentTheme = theme;
}

export function getTheme(): Theme {
  return currentTheme;
}

export function listThemes(): string[] {
  return Object.keys(themes);
}

// Chalk color helpers using current theme
export const colors = {
  // Text styles
  fg: () => chalk.hex(currentTheme.fg),
  fgMuted: () => chalk.hex(currentTheme.fgMuted),
  accent: () => chalk.hex(currentTheme.accent),
  success: () => chalk.hex(currentTheme.success),
  error: () => chalk.hex(currentTheme.error),
  warning: () => chalk.hex(currentTheme.warning),

  // Sent message (with background)
  sent: () => chalk.bgHex(currentTheme.bgSent).hex(currentTheme.fgOnSent),

  // Received message (with background)
  received: () => chalk.bgHex(currentTheme.bgReceived).hex(currentTheme.fgOnReceived),

  // Selected/highlighted item
  selected: () => chalk.bgHex(currentTheme.selection).hex(currentTheme.fg),

  // Border color
  border: () => chalk.hex(currentTheme.border),

  // Status colors
  online: () => chalk.hex(currentTheme.success),
  offline: () => chalk.hex(currentTheme.error),
  unread: () => chalk.hex(currentTheme.error),

  // Raw chalk access for custom colors
  hex: (color: string): ChalkInstance => chalk.hex(color),
  bgHex: (color: string): ChalkInstance => chalk.bgHex(color),
};

// Box drawing characters
export const box = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  teeDown: '┬',
  teeUp: '┴',
  teeRight: '├',
  teeLeft: '┤',
  cross: '┼',
};
