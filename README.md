# Passage

**Safe passage for your messages beyond Mac.**

Passage is a web-based Messages app proxy that runs on your Mac and provides access to iMessage and SMS through a browser. Access your messages from your Linux desktop, TV, or any device with a web browser.

## Features

- 📱 **Full Messages Access** - View all your iMessage and SMS conversations
- 💬 **Real-time Updates** - WebSocket-based live message updates
- 🎨 **Messages-like UI** - Familiar interface with blue bubbles for sent messages
- 📺 **TV-Optimized** - Large touch targets and keyboard navigation for TV browsers
- 🔒 **Local Network** - Runs on your Mac, accessible via LAN
- ⚡ **Fast** - Built with modern tech: React, TypeScript, Vite, Express

## Architecture

Passage is a monorepo with three main packages:

- **`apps/passage-backend`** - Express server that reads from Messages.app SQLite database and sends messages via AppleScript
- **`apps/passage-frontend`** - React web app with Messages-like UI
- **`packages/shared-types`** - Shared TypeScript types between frontend and backend

## Prerequisites

- macOS (for Messages.app access)
- Node.js 20+ or Bun
- pnpm
- Messages.app must be signed into iCloud

## Installation

1. **Clone and install dependencies:**

```bash
cd /path/to/passage
pnpm install
```

2. **Grant Full Disk Access to Terminal:**
   - Go to System Settings > Privacy & Security > Full Disk Access
   - Add your terminal app (Terminal.app, iTerm2, etc.)
   - This allows the backend to read the Messages database

3. **Configure backend (optional):**

Edit `apps/passage-backend/.env` if needed:

```env
PORT=3000
MESSAGES_DB_PATH=~/Library/Messages/chat.db
ATTACHMENTS_PATH=~/Library/Messages/Attachments
```

4. **Configure frontend (optional):**

Edit `apps/passage-frontend/.env` to point to your Mac's IP:

```env
VITE_API_URL=http://192.168.1.10:3000
VITE_WS_URL=ws://192.168.1.10:3000/ws
```

## Usage

### Development

Run both frontend and backend in development mode:

```bash
pnpm dev
```

This starts:
- Backend on `http://localhost:3000`
- Frontend on `http://localhost:5173`

### Production Build

```bash
pnpm build
```

### Access from Other Devices

1. Find your Mac's local IP address:
```bash
ipconfig getifaddr en0
```

2. Access Passage from any browser on your local network:
```
http://YOUR_MAC_IP:5173
```

For example: `http://192.168.1.10:5173`

## How It Works

1. **Database Reading** - The backend reads from `~/Library/Messages/chat.db` using SQLite
2. **File Watching** - Monitors database changes to detect new messages in real-time
3. **AppleScript Sending** - Uses AppleScript to send messages through Messages.app
4. **WebSocket Updates** - Pushes new messages to connected clients instantly
5. **REST API** - Provides endpoints for fetching conversations and messages

## Project Structure

```
passage/
├── apps/
│   ├── passage-backend/          # Express + WebSocket server
│   │   ├── src/
│   │   │   ├── server.ts          # Main server entry point
│   │   │   ├── database.ts        # SQLite database reader
│   │   │   ├── applescript.ts     # AppleScript integration
│   │   │   └── watcher.ts         # File system watcher
│   │   └── package.json
│   │
│   └── passage-frontend/          # React web app
│       ├── src/
│       │   ├── App.tsx            # Main app component
│       │   ├── controller.ts      # MobX state management
│       │   ├── components/
│       │   │   ├── ConversationList.tsx
│       │   │   ├── MessageThread.tsx
│       │   │   └── MessageComposer.tsx
│       │   └── components/ui/     # shadcn/ui components
│       └── package.json
│
└── packages/
    └── shared-types/              # Shared TypeScript types
        ├── types.ts
        └── index.ts
```

## API Endpoints

### REST API

- `GET /api/v1/conversations` - List all conversations
- `GET /api/v1/conversations/:id` - Get a specific conversation
- `GET /api/v1/conversations/:id/messages` - Get messages for a conversation
- `POST /api/v1/messages/send` - Send a new message
- `GET /api/v1/attachments/*` - Serve attachment files

### WebSocket

Connect to `ws://localhost:3000/ws` for real-time updates:

```typescript
{
  type: 'new_message',
  payload: Message
}

{
  type: 'conversation_updated',
  payload: Conversation
}
```

## Tech Stack

**Backend:**
- Express - HTTP server
- ws - WebSocket server
- better-sqlite3 - SQLite database access
- chokidar - File system watching
- AppleScript - Message sending

**Frontend:**
- React 19 - UI framework
- Vite - Build tool
- MobX - State management
- Tailwind CSS v4 - Styling
- shadcn/ui - Component library
- Lucide React - Icons

## Security Notes

- ⚠️ **No authentication** - Anyone on your local network can access messages
- 🔒 **Local network only** - Not designed for internet exposure
- 🛡️ **Read-only database** - Opens Messages DB in readonly mode to prevent corruption
- 📱 **Messages.app required** - Must be running to send messages

## Troubleshooting

### "Failed to open database"
- Ensure Full Disk Access is granted to your terminal app
- Check that Messages.app is signed into iCloud
- Verify the database path in `.env`

### "Failed to send message"
- Ensure Messages.app is running
- Check that AppleScript has permissions
- Verify the recipient's phone number or email is correct

### WebSocket disconnects
- Check firewall settings
- Ensure backend server is running
- Verify WebSocket URL in frontend `.env`

## Built with AI

This project was built entirely through LLM-first development - 100% of the code was generated by prompting Claude (Opus 4.5) using [Claude Code](https://claude.ai/code). No code was written by hand.

This represents a new way of building software where the developer acts as architect and reviewer, guiding the AI through iterative prompts while the AI handles implementation details.

## License

MIT - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please open an issue first to discuss what you would like to change.
