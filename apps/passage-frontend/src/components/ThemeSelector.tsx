import { useState, useEffect } from 'react';
import { themes, modes, initializeTheme, updateTheme, type Theme, type Mode } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>('default');
  const [mode, setMode] = useState<Mode>('system');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const { theme: storedTheme, mode: storedMode } = initializeTheme();
    setTheme(storedTheme);
    setMode(storedMode);
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    updateTheme(newTheme, mode);
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    updateTheme(theme, newMode);
  };

  const modeIcon = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  };

  const CurrentModeIcon = modeIcon[mode];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-accent transition-colors"
        aria-label="Theme settings"
      >
        <Palette className="h-4 w-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-card border border-border rounded-md shadow-lg p-2">
            {/* Theme selection */}
            <div className="mb-2">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1">Theme</div>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleThemeChange(t.id)}
                  className={cn(
                    'w-full text-left px-2 py-1.5 text-sm rounded transition-colors',
                    theme === t.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-border my-2" />

            {/* Mode selection (only for default theme) */}
            {theme === 'default' && (
              <div>
                <div className="text-xs font-medium text-muted-foreground px-2 py-1">Mode</div>
                <div className="flex gap-1">
                  {modes.map((m) => {
                    const Icon = modeIcon[m.id];
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleModeChange(m.id)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors',
                          mode === m.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent'
                        )}
                        title={m.name}
                      >
                        <Icon className="h-3 w-3" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {theme !== 'default' && (
              <div className="text-xs text-muted-foreground px-2 py-1">
                Mode is fixed for this theme
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
