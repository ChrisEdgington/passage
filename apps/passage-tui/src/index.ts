#!/usr/bin/env node
import meow from 'meow';
import { startApp } from './app.js';
import { listThemes } from './core/themes.js';

const cli = meow(
  `
  Usage
    $ passage-tui [options]

  Options
    --host, -h      API host (default: localhost:3000)
    --theme, -t     Color theme (default: tokyo-night)
    --list-themes   List available themes
    --help          Show this help
    --version       Show version

  Examples
    $ passage-tui
    $ passage-tui --host 192.168.1.10:3000
    $ passage-tui --theme catppuccin-mocha
    $ PASSAGE_HOST=192.168.1.10:3000 passage-tui

  Available Themes
    ${listThemes().join(', ')}

  Keyboard Shortcuts
    j/k, ↑/↓    Navigate
    Tab         Switch pane
    Enter       Select / Open
    i, r        Compose message
    g g         Jump to top
    G           Jump to bottom
    [ / ]       Prev / Next conversation
    u           Jump to unread
    ?           Show help
    q           Quit
`,
  {
    importMeta: import.meta,
    flags: {
      host: {
        type: 'string',
        shortFlag: 'h',
        default: process.env.PASSAGE_HOST || 'localhost:3000',
      },
      theme: {
        type: 'string',
        shortFlag: 't',
        default: process.env.PASSAGE_THEME || 'tokyo-night',
      },
      listThemes: {
        type: 'boolean',
        default: false,
      },
    },
  }
);

// Handle --list-themes
if (cli.flags.listThemes) {
  console.log('Available themes:');
  for (const theme of listThemes()) {
    console.log(`  - ${theme}`);
  }
  process.exit(0);
}

// Start the app
startApp({
  host: cli.flags.host,
  theme: cli.flags.theme,
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
