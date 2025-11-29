import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'node:events';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MESSAGES_DB_PATH = process.env.MESSAGES_DB_PATH || join(homedir(), 'Library/Messages/chat.db');

export interface MessagesDatabaseWatcher extends EventEmitter {
  on(event: 'change', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  emit(event: 'change'): boolean;
  emit(event: 'error', error: Error): boolean;
}

export class MessagesDatabaseWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly debounceMs = 500; // Wait 500ms after last change

  start(): void {
    if (this.watcher) {
      console.warn('Watcher already started');
      return;
    }

    console.log(`Starting watcher for: ${MESSAGES_DB_PATH}`);

    // Use polling for SQLite databases - native fs events are unreliable for DB files on macOS
    this.watcher = watch(MESSAGES_DB_PATH, {
      persistent: true,
      usePolling: true,
      interval: 1000, // Poll every second
      binaryInterval: 1000,
    });

    this.watcher.on('change', (path) => {
      console.log(`[Watcher] File change detected: ${path}`);
      // Debounce rapid changes (Messages.app may write multiple times)
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        console.log('[Watcher] Debouncing...');
      }

      this.debounceTimer = setTimeout(() => {
        console.log('[Watcher] Debounce complete - emitting change event');
        this.emit('change');
      }, this.debounceMs);
    });

    this.watcher.on('add', (path) => {
      console.log(`[Watcher] File added: ${path}`);
    });

    this.watcher.on('unlink', (path) => {
      console.log(`[Watcher] File removed: ${path}`);
    });

    this.watcher.on('raw', (event, path, details) => {
      console.log(`[Watcher] Raw event: ${event} on ${path}`, details);
    });

    this.watcher.on('error', (error) => {
      console.error('Watcher error:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    });

    this.watcher.on('ready', () => {
      console.log('Watcher ready');
    });
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('Watcher stopped');
    }
  }
}
