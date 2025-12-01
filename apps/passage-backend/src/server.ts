import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import multer from 'multer';
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { homedir, tmpdir, networkInterfaces } from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directory for uploads
const UPLOADS_DIR = join(tmpdir(), 'passage-uploads');
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      cb(null, `upload-${uniqueSuffix}.jpg`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});
import type {
  GetConversationsResponse,
  GetConversationResponse,
  GetMessagesRequest,
  GetMessagesResponse,
  SendMessageRequest,
  SendMessageResponse,
  WebSocketMessage,
  ApiError,
} from '@passage/shared-types';
import { MessagesDatabase } from './database.js';
import { AppleScriptMessenger } from './applescript.js';
import { MessagesDatabaseWatcher } from './watcher.js';
import { ContactsResolver } from './contacts.js';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const ATTACHMENTS_PATH = process.env.ATTACHMENTS_PATH || join(homedir(), 'Library/Messages/Attachments');

// Get the machine's local IP address
function getLocalIP(): string {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Simple logger with timestamps
const log = {
  info: (msg: string, ...args: unknown[]) => console.log(`[Server] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[Server] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[Server] ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) => console.debug(`[Server] ${msg}`, ...args),
};

// Initialize services
const contactsResolver = new ContactsResolver();
const db = new MessagesDatabase(contactsResolver);
const messenger = new AppleScriptMessenger();
const watcher = new MessagesDatabaseWatcher();


// Create Express app
const app = express();
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// API Routes - v1
const apiV1 = express.Router();
app.use('/api/v1', apiV1);

// GET /api/v1/conversations - Get all conversations
apiV1.get('/conversations', (req, res) => {
  try {
    const conversations = db.getConversations();
    const response: GetConversationsResponse = { conversations };
    res.json(response);
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    const errorResponse: ApiError = { error: 'Failed to fetch conversations', details: error.message };
    res.status(500).json(errorResponse);
  }
});

// GET /api/v1/conversations/:id - Get a specific conversation
apiV1.get('/conversations/:id', (req, res) => {
  try {
    const { id } = req.params;
    const conversation = db.getConversation(id);

    if (!conversation) {
      const errorResponse: ApiError = { error: 'Conversation not found' };
      return res.status(404).json(errorResponse);
    }

    const response: GetConversationResponse = { conversation };
    res.json(response);
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    const errorResponse: ApiError = { error: 'Failed to fetch conversation', details: error.message };
    res.status(500).json(errorResponse);
  }
});

// GET /api/v1/conversations/:id/messages - Get messages for a conversation
apiV1.get('/conversations/:id/messages', (req, res) => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 100;
    const before = req.query.before ? Number.parseInt(req.query.before as string, 10) : undefined;

    const result = db.getMessages(id, limit, before);
    const response: GetMessagesResponse = result;
    res.json(response);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    const errorResponse: ApiError = { error: 'Failed to fetch messages', details: error.message };
    res.status(500).json(errorResponse);
  }
});

// POST /api/v1/upload - Upload an image for sending (resized client-side)
apiV1.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      const errorResponse: ApiError = { error: 'No image file provided' };
      return res.status(400).json(errorResponse);
    }

    log.info(`Upload received: ${req.file.originalname}, size: ${(req.file.size / 1024).toFixed(1)}KB`);
    res.json({ filePath: req.file.path });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    const errorResponse: ApiError = { error: 'Failed to upload file', details: error.message };
    res.status(500).json(errorResponse);
  }
});

// POST /api/v1/messages/send - Send a new message
apiV1.post('/messages/send', async (req, res) => {
  try {
    const { recipientId, text, attachmentPath } = req.body;

    if (!recipientId || (!text && !attachmentPath)) {
      const errorResponse: ApiError = { error: 'Missing required fields: recipientId and either text or attachmentPath' };
      return res.status(400).json(errorResponse);
    }

    // Check if Messages.app is running
    const isRunning = await messenger.isMessagesRunning();
    if (!isRunning) {
      console.log('Messages.app not running, launching...');
      await messenger.launchMessages();
      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Send the message (with optional attachment)
    const result = await messenger.sendMessage({
      recipient: recipientId,
      text: text || '',
      attachmentPath,
    });

    // Clean up uploaded file after sending
    if (attachmentPath && existsSync(attachmentPath)) {
      unlink(attachmentPath).catch(() => {});
    }

    if (!result.success) {
      const errorResponse: ApiError = { error: result.error || 'Failed to send message' };
      return res.status(500).json(errorResponse);
    }

    const response: SendMessageResponse = { success: true };
    res.json(response);
  } catch (error: any) {
    console.error('Error sending message:', error);
    const errorResponse: ApiError = { error: 'Failed to send message', details: error.message };
    res.status(500).json(errorResponse);
  }
});

// POST /api/v1/messages/react - Send a reaction (tapback) to a message
apiV1.post('/messages/react', async (req, res) => {
  try {
    const { chatName, messageText, reactionType } = req.body;

    if (!chatName || !messageText || !reactionType) {
      const errorResponse: ApiError = { error: 'Missing required fields: chatName, messageText, reactionType' };
      return res.status(400).json(errorResponse);
    }

    // Map reaction type to index
    // 1 = ❤️ Love, 2 = 👍 Like, 3 = 👎 Dislike, 4 = 😂 Laugh, 5 = ‼️ Emphasize, 6 = ❓ Question
    const reactionMap: Record<string, number> = {
      love: 1,
      heart: 1,
      h: 1,
      like: 2,
      thumbsup: 2,
      t: 2,
      dislike: 3,
      thumbsdown: 3,
      d: 3,
      laugh: 4,
      haha: 4,
      l: 4,
      emphasize: 5,
      exclamation: 5,
      e: 5,
      question: 6,
      q: 6,
    };

    const reactionIndex = reactionMap[reactionType.toLowerCase()];
    if (!reactionIndex) {
      const errorResponse: ApiError = { error: `Unknown reaction type: ${reactionType}. Valid types: love/heart/h, like/thumbsup/t, dislike/thumbsdown/d, laugh/haha/l, emphasize/exclamation/e, question/q` };
      return res.status(400).json(errorResponse);
    }

    // Check if Messages.app is running
    const isRunning = await messenger.isMessagesRunning();
    if (!isRunning) {
      console.log('Messages.app not running, launching...');
      await messenger.launchMessages();
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Send the reaction
    const result = await messenger.sendReaction(chatName, messageText, reactionIndex);

    if (!result.success) {
      const errorResponse: ApiError = { error: result.error || 'Failed to send reaction' };
      return res.status(500).json(errorResponse);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error sending reaction:', error);
    const errorResponse: ApiError = { error: 'Failed to send reaction', details: error.message };
    res.status(500).json(errorResponse);
  }
});

// GET /api/v1/attachments/:filename - Serve attachment files
apiV1.get('/attachments/*', async (req, res) => {
  try {
    // Get the full path after /attachments/
    const filename = (req.params as any)[0] as string;
    const filePath = join(ATTACHMENTS_PATH, filename);

    // Security check: ensure the file is within the attachments directory
    if (!filePath.startsWith(ATTACHMENTS_PATH)) {
      const errorResponse: ApiError = { error: 'Invalid file path' };
      return res.status(403).json(errorResponse);
    }

    if (!existsSync(filePath)) {
      const errorResponse: ApiError = { error: 'Attachment not found' };
      return res.status(404).json(errorResponse);
    }

    // Convert HEIC/HEIF images to JPEG for browser compatibility using macOS sips
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.endsWith('.heic') || lowerPath.endsWith('.heif')) {
      const tmpOutput = join(tmpdir(), `heic-convert-${Date.now()}.jpg`);
      try {
        await execAsync(`sips -s format jpeg -s formatOptions 90 "${filePath}" --out "${tmpOutput}"`);
        const jpegBuffer = await readFile(tmpOutput);
        await unlink(tmpOutput).catch(() => {});
        res.set('Content-Type', 'image/jpeg');
        res.send(jpegBuffer);
        return;
      } catch (conversionError: any) {
        console.error('HEIC conversion failed, serving original:', conversionError.message);
        await unlink(tmpOutput).catch(() => {});
        // Fall through to serve original file
      }
    }

    res.sendFile(filePath);
  } catch (error: any) {
    console.error('Error serving attachment:', error);
    const errorResponse: ApiError = { error: 'Failed to serve attachment', details: error.message };
    res.status(500).json(errorResponse);
  }
});

// Serve frontend static files if they exist
// In production build, frontend is at ../frontend (relative to dist/)
// In development, it's at ../../passage-frontend/dist
const frontendDistPaths = [
  join(__dirname, '..', 'frontend'),           // Production: dist/frontend
  join(__dirname, '..', '..', 'passage-frontend', 'dist'),  // Dev: from src/ to passage-frontend/dist
];

const frontendPath = frontendDistPaths.find((p) => existsSync(join(p, 'index.html')));
if (frontendPath) {
  log.info(`Serving frontend from: ${frontendPath}`);
  app.use(express.static(frontendPath));

  // SPA fallback - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes and WebSocket path
    if (req.path.startsWith('/api') || req.path === '/ws' || req.path === '/health') {
      return next();
    }
    res.sendFile(join(frontendPath, 'index.html'));
  });
} else {
  log.info('No frontend build found, running API-only mode');
}

// WebSocket connection handling
const clients = new Set<WebSocket>();

// Track the last message ID we've seen per conversation to avoid re-broadcasting
const lastSeenMessageIds = new Map<string, string>();

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  clients.add(ws);

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });

  // Send initial connection confirmation
  const message: WebSocketMessage = {
    type: 'conversation_updated',
    payload: { id: 'system', displayName: 'Connected', participants: [], lastMessage: null, unreadCount: 0, isGroup: false },
  };
  ws.send(JSON.stringify(message));
});

// Broadcast message to all connected clients
function broadcast(message: WebSocketMessage): void {
  const payload = JSON.stringify(message);
  let sentCount = 0;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sentCount++;
    }
  });
  log.debug(`Broadcast ${message.type} to ${sentCount}/${clients.size} clients`);
}

// Load contacts: try cached file first (instant), then refresh from AppleScript in background
(async () => {
  console.log('[Server] Loading contacts...');

  // Try to load from cached file first (fast startup)
  const loadedFromCache = await contactsResolver.loadFromCache();

  if (loadedFromCache) {
    console.log('[Server] Contacts loaded from cache, ready to serve immediately');
    // Broadcast contacts_ready since we have data
    const msg: WebSocketMessage = {
      type: 'contacts_ready',
      payload: {},
    };
    broadcast(msg);
    console.log(`[Server] Broadcasted contacts_ready to ${clients.size} clients`);
  }

  // Refresh from AppleScript in background (updates cache file when done)
  console.log('[Server] Starting background refresh of contacts from AppleScript...');
  contactsResolver.buildCache().then(() => {
    console.log('[Server] Contacts cache refreshed from AppleScript');
    // Broadcast again in case contact names changed
    const msg: WebSocketMessage = {
      type: 'contacts_ready',
      payload: {},
    };
    broadcast(msg);
    console.log(`[Server] Broadcasted contacts_ready (refresh) to ${clients.size} clients`);
  }).catch(err => {
    console.error('[Server] Failed to refresh contacts cache:', err);
  });
})();

// Initialize lastSeenMessageIds with current state to avoid re-broadcasting on startup
try {
  const initialConversations = db.getConversations();
  for (const conversation of initialConversations) {
    if (conversation.lastMessage) {
      lastSeenMessageIds.set(conversation.id, conversation.lastMessage.id);
    }
  }
  log.info(`Initialized lastSeenMessageIds for ${lastSeenMessageIds.size} conversations`);
} catch (error) {
  log.error('Failed to initialize lastSeenMessageIds:', error);
}

// Watch for database changes and notify clients
watcher.on('change', () => {
  log.info('Database change detected, fetching conversations...');

  try {
    // Fetch all conversations and check which ones have new messages
    const conversations = db.getConversations();

    let newMessageCount = 0;
    let updatedCount = 0;

    for (const conversation of conversations) {
      // Only broadcast new_message if it's actually a NEW message we haven't seen before
      if (conversation.lastMessage) {
        const lastSeenId = lastSeenMessageIds.get(conversation.id);
        const currentMessageId = conversation.lastMessage.id;

        if (lastSeenId !== currentMessageId) {
          // This conversation has a new message - broadcast both updates
          updatedCount++;

          const convMessage: WebSocketMessage = {
            type: 'conversation_updated',
            payload: conversation,
          };
          broadcast(convMessage);

          log.info(`NEW message in conversation ${conversation.id}: "${conversation.lastMessage.text?.slice(0, 30) || '[no text]'}..." from ${conversation.lastMessage.isFromMe ? 'me' : conversation.lastMessage.senderName}`);
          lastSeenMessageIds.set(conversation.id, currentMessageId);
          newMessageCount++;

          const messageUpdate: WebSocketMessage = {
            type: 'new_message',
            payload: conversation.lastMessage,
          };
          broadcast(messageUpdate);
        }
      }
    }

    if (newMessageCount > 0) {
      log.info(`Broadcasted ${newMessageCount} new message(s) in ${updatedCount} conversation(s)`);
    } else {
      log.debug('No new messages found');
    }
  } catch (error: any) {
    log.error('Error processing database change:', error);
    const errorMessage: WebSocketMessage = {
      type: 'error',
      payload: { message: 'Failed to fetch updated messages' },
    };
    broadcast(errorMessage);
  }
});

watcher.on('error', (error) => {
  console.error('Watcher error:', error);
  const errorMessage: WebSocketMessage = {
    type: 'error',
    payload: { message: 'Database watcher error' },
  };
  broadcast(errorMessage);
});

// Start the watcher
watcher.start();

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  const url = `http://${ip}:${PORT}`;

  // Calculate box width based on longest line
  const title = 'Passage Server Running';
  const urlLine = url;
  const maxLen = Math.max(title.length, urlLine.length);
  const boxWidth = maxLen + 4; // 2 spaces padding on each side

  const hBar = '═'.repeat(boxWidth);
  const padTitle = title.padStart(Math.floor((boxWidth + title.length) / 2)).padEnd(boxWidth);
  const padUrl = urlLine.padStart(Math.floor((boxWidth + urlLine.length) / 2)).padEnd(boxWidth);

  console.log(`
╔${hBar}╗
║${padTitle}║
╠${hBar}╣
║${padUrl}║
╚${hBar}╝
  `);
});

// Graceful shutdown
function shutdown() {
  console.log('\nShutting down gracefully...');
  watcher.stop();
  db.close();

  // Close all WebSocket connections
  clients.forEach((client) => {
    client.close();
  });
  clients.clear();

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force exit after 2 seconds if server.close() hangs
  setTimeout(() => {
    console.log('Forcing exit...');
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
