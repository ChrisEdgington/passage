import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const execAsync = promisify(exec);

// Cache file location - stored alongside the app data
const CACHE_FILE_PATH = join(homedir(), '.passage', 'contacts-cache.json');

interface CacheData {
  phones: [string, string][];
  emails: [string, string][];
  timestamp: number;
}

export interface ContactInfo {
  name: string;
  phone?: string;
  email?: string;
}

export class ContactsResolver {
  private phoneCache: Map<string, string> = new Map();
  private emailCache: Map<string, string> = new Map();
  private cacheBuilt = false;

  constructor() {}

  // Load contacts from cached JSON file (fast startup)
  async loadFromCache(): Promise<boolean> {
    try {
      const data = await readFile(CACHE_FILE_PATH, 'utf8');
      const cache: CacheData = JSON.parse(data);

      this.phoneCache = new Map(cache.phones);
      this.emailCache = new Map(cache.emails);
      this.cacheBuilt = true;

      const ageMinutes = Math.round((Date.now() - cache.timestamp) / 60000);
      console.log(`[Contacts] Loaded from cache: ${this.phoneCache.size} phones, ${this.emailCache.size} emails (${ageMinutes} min old)`);
      return true;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('[Contacts] Error loading cache file:', error.message);
      }
      return false;
    }
  }

  // Save current cache to JSON file
  private async saveToCache(): Promise<void> {
    try {
      const cacheData: CacheData = {
        phones: Array.from(this.phoneCache.entries()),
        emails: Array.from(this.emailCache.entries()),
        timestamp: Date.now(),
      };

      // Ensure directory exists
      const cacheDir = join(homedir(), '.passage');
      await writeFile(join(cacheDir, '.gitkeep'), '').catch(() => {});
      const { mkdir } = await import('node:fs/promises');
      await mkdir(cacheDir, { recursive: true });

      await writeFile(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf8');
      console.log(`[Contacts] Saved cache to ${CACHE_FILE_PATH}`);
    } catch (error: any) {
      console.error('[Contacts] Error saving cache file:', error.message);
    }
  }

  // Build cache of all contacts with phone numbers and emails
  async buildCache(): Promise<void> {
    console.log('[Contacts] Starting to build contacts cache...');
    try {
      // Use osascript with a temp file to avoid quote escaping issues
      // Launch Contacts app first (without bringing to foreground) to avoid -600 error
      const script = `tell application "Contacts"
  launch
  delay 1
  set output to ""
  repeat with aPerson in people
    try
      set personName to name of aPerson

      repeat with aPhone in phones of aPerson
        try
          set phoneValue to value of aPhone
          set output to output & personName & "|phone|" & phoneValue & linefeed
        end try
      end repeat

      repeat with anEmail in emails of aPerson
        try
          set emailValue to value of anEmail
          set output to output & personName & "|email|" & emailValue & linefeed
        end try
      end repeat
    end try
  end repeat
  return output
end tell`;

      // Write script to temp file and execute it
      const tmpFile = join(tmpdir(), `contacts-${Date.now()}.scpt`);
      await writeFile(tmpFile, script, 'utf8');
      console.log('[Contacts] Executing AppleScript to fetch contacts...');

      let stdout: string;
      try {
        // Increase maxBuffer to handle large contact lists (50MB)
        const result = await execAsync(`osascript "${tmpFile}"`, { maxBuffer: 50 * 1024 * 1024 });
        stdout = result.stdout;
        console.log(`[Contacts] AppleScript completed, got ${stdout.length} bytes of output`);
        await unlink(tmpFile);
      } catch (error) {
        console.error('[Contacts] AppleScript execution failed:', error);
        await unlink(tmpFile).catch(() => {});
        throw error;
      }

      // Parse the output and build caches
      const lines = stdout.trim().split('\n').filter(line => line.trim());
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length !== 3) continue;

        const [name, type, value] = parts;
        if (!name || !value) continue;

        if (type === 'phone') {
          // Normalize phone number by removing all non-digits
          const cleaned = value.replace(/\D/g, '');
          // Store last 10 digits as key (handles +1 prefix)
          const key = cleaned.slice(-10);
          if (key.length >= 7) {
            this.phoneCache.set(key, name);
          }
        } else if (type === 'email') {
          this.emailCache.set(value.toLowerCase(), name);
        }
      }

      this.cacheBuilt = true;
      console.log(`[Contacts] Cache built: ${this.phoneCache.size} phone numbers, ${this.emailCache.size} emails`);

      // Save to file for fast startup next time
      await this.saveToCache();
    } catch (error) {
      console.error('[Contacts] Error building contacts cache:', error);
    }
  }

  // Look up contact name by phone number
  resolvePhone(phoneNumber: string): string | null {
    if (!this.cacheBuilt) return null;

    // Normalize the input phone number
    const cleaned = phoneNumber.replace(/\D/g, '');
    const key = cleaned.slice(-10);

    return this.phoneCache.get(key) || null;
  }

  // Look up contact name by email
  resolveEmail(email: string): string | null {
    if (!this.cacheBuilt) return null;
    return this.emailCache.get(email.toLowerCase()) || null;
  }

  // Resolve any identifier (phone or email)
  resolve(identifier: string): string | null {
    if (!identifier) return null;

    // Check if it's an email
    if (identifier.includes('@')) {
      return this.resolveEmail(identifier);
    }

    // Otherwise treat as phone number
    return this.resolvePhone(identifier);
  }
}
