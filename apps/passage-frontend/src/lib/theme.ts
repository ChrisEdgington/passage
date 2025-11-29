export type Theme =
  | 'default'
  | 'tokyo-night'
  | 'catppuccin'
  | 'catppuccin-latte'
  | 'ethereal'
  | 'everforest'
  | 'gruvbox'
  | 'hackerman'
  | 'osaka-jade'
  | 'kanagawa'
  | 'nord'
  | 'matte-black'
  | 'ristretto'
  | 'flexoki-light'
  | 'rose-pine';

export type Mode = 'light' | 'dark' | 'system';

const THEME_KEY = 'passage-theme';
const MODE_KEY = 'passage-mode';

export const themes: { id: Theme; name: string }[] = [
  { id: 'default', name: 'Default' },
  { id: 'tokyo-night', name: 'Tokyo Night' },
  { id: 'catppuccin', name: 'Catppuccin' },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte' },
  { id: 'ethereal', name: 'Ethereal' },
  { id: 'everforest', name: 'Everforest' },
  { id: 'gruvbox', name: 'Gruvbox' },
  { id: 'hackerman', name: 'Hackerman' },
  { id: 'osaka-jade', name: 'Osaka Jade' },
  { id: 'kanagawa', name: 'Kanagawa' },
  { id: 'nord', name: 'Nord' },
  { id: 'matte-black', name: 'Matte Black' },
  { id: 'ristretto', name: 'Ristretto' },
  { id: 'flexoki-light', name: 'Flexoki Light' },
  { id: 'rose-pine', name: 'Rose Pine' },
];

export const modes: { id: Mode; name: string }[] = [
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
  { id: 'system', name: 'System' },
];

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored && themes.some((t) => t.id === stored)) {
    return stored as Theme;
  }
  return 'default';
}

export function getStoredMode(): Mode {
  const stored = localStorage.getItem(MODE_KEY);
  if (stored && modes.some((m) => m.id === stored)) {
    return stored as Mode;
  }
  return 'system';
}

export function setStoredTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function setStoredMode(mode: Mode): void {
  localStorage.setItem(MODE_KEY, mode);
}

function getSystemDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(theme: Theme, mode: Mode): void {
  const root = document.documentElement;

  // Remove all theme classes
  const themeClasses = themes.map(t => `theme-${t.id}`).filter(c => c !== 'theme-default');
  root.classList.remove('dark', ...themeClasses);

  // Apply theme class (unless default)
  if (theme !== 'default') {
    root.classList.add(`theme-${theme}`);
  } else {
    // For default theme, apply dark class based on mode
    const isDark = mode === 'dark' || (mode === 'system' && getSystemDarkMode());
    if (isDark) {
      root.classList.add('dark');
    }
  }
}

let systemModeListener: (() => void) | null = null;

export function initializeTheme(): { theme: Theme; mode: Mode } {
  const theme = getStoredTheme();
  const mode = getStoredMode();

  applyTheme(theme, mode);

  // Listen for system theme changes when mode is 'system'
  if (mode === 'system') {
    setupSystemModeListener(theme, mode);
  }

  return { theme, mode };
}

export function setupSystemModeListener(theme: Theme, mode: Mode): void {
  // Clean up existing listener
  if (systemModeListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemModeListener);
  }

  if (mode === 'system' && theme === 'default') {
    systemModeListener = () => applyTheme(theme, mode);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', systemModeListener);
  }
}

export function updateTheme(theme: Theme, mode: Mode): void {
  setStoredTheme(theme);
  setStoredMode(mode);
  applyTheme(theme, mode);
  setupSystemModeListener(theme, mode);
}
