const SERVER_URL_KEY = 'passage-server-url';

export function getStoredServerUrl(): string | null {
  return localStorage.getItem(SERVER_URL_KEY);
}

export function setStoredServerUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url);
}

export function clearStoredServerUrl(): void {
  localStorage.removeItem(SERVER_URL_KEY);
}

/**
 * Normalize server URL input to ip:port format
 * Handles inputs like:
 * - "192.168.1.10:3000" -> "192.168.1.10:3000"
 * - "http://192.168.1.10:3000" -> "192.168.1.10:3000"
 * - "192.168.1.10" -> "192.168.1.10:3000" (default port)
 * - "localhost:3000" -> "localhost:3000"
 */
export function normalizeServerUrl(input: string): string {
  let url = input.trim();

  // Strip protocol if present
  url = url.replace(/^https?:\/\//, '');

  // Strip trailing slash
  url = url.replace(/\/$/, '');

  // Strip path if present
  url = url.split('/')[0];

  // Add default port if not present
  if (!url.includes(':')) {
    url = `${url}:3000`;
  }

  return url;
}

/**
 * Build full HTTP URL from ip:port format
 */
export function buildApiUrl(serverUrl: string): string {
  return `http://${serverUrl}`;
}

/**
 * Build full WebSocket URL from ip:port format
 */
export function buildWsUrl(serverUrl: string): string {
  return `ws://${serverUrl}/ws`;
}
