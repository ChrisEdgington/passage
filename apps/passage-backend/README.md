# Passage Backend

The backend server for Passage - access your iMessages and SMS from any browser on your local network.

## Requirements

- **macOS** (required - this app reads from the native Messages.app database)
- **Node.js 20+** ([nodejs.org](https://nodejs.org))
- **Xcode Command Line Tools** (for native SQLite bindings)
- **Messages.app** signed into iCloud and running

## Quick Start

### 1. Install Xcode Command Line Tools

```bash
xcode-select --install
```

This is required because `better-sqlite3` compiles native code.

### 2. Install dependencies

From the repository root:

```bash
pnpm install
# or
npm install
```

### 3. Grant Full Disk Access

The backend needs to read your Messages database. Your terminal app needs Full Disk Access:

1. Open **System Settings** > **Privacy & Security** > **Full Disk Access**
2. Click the **+** button
3. Add your terminal app (Terminal, iTerm2, Warp, etc.)
4. Restart your terminal

### 4. Build and start the server

```bash
# Build all packages
pnpm build

# Start the backend
node apps/passage-backend/dist/server.js
```

The server will start on `http://localhost:3000`.

For development with auto-reload:

```bash
pnpm dev
```

## Configuration

Create a `.env` file in `apps/passage-backend/` (optional - defaults work for most setups):

```env
PORT=3000
MESSAGES_DB_PATH=~/Library/Messages/chat.db
ATTACHMENTS_PATH=~/Library/Messages/Attachments
```

## Accessing from Other Devices

To access Passage from other devices on your network (Linux desktop, TV, phone), you'll need your Mac's IP address.

### Find your Mac's IP address

**Option A: System Settings**
1. Open **System Settings** > **Network**
2. Click your active connection (Wi-Fi or Ethernet)
3. Your IP address is shown (e.g., `192.168.1.42`)

**Option B: Terminal**
```bash
ipconfig getifaddr en0   # For Wi-Fi
# or
ipconfig getifaddr en1   # For Ethernet
```

**Option C: Menu bar**
Hold **Option** and click the Wi-Fi icon - your IP address is displayed.

### Connect from the frontend

1. Open the Passage frontend in any browser
2. Enter your Mac's IP address and port (e.g., `192.168.1.42:3000`)
3. Click Connect

## Troubleshooting

### "Database is locked" or "unable to open database file"

Your terminal doesn't have Full Disk Access. See step 3 above.

### "Messages.app not running"

Passage requires Messages.app to be open to send messages. The backend will attempt to launch it automatically, but if that fails:

1. Open Messages.app manually
2. Ensure you're signed into your Apple ID (Messages > Settings > iMessage)

### "better-sqlite3" build errors

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

If you still have issues, try:

```bash
rm -rf node_modules
npm install
```

### Messages not appearing

- Ensure Messages.app is signed into iCloud
- Check that Full Disk Access is granted
- Try restarting the server

### Server won't start on port 3000

Another process is using port 3000. Either stop that process or change the port:

```bash
PORT=3001 node dist/server.js
```

## Security Note

Passage has **no authentication**. Anyone on your local network can read your messages when the server is running. Do not expose this server to the internet.

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/conversations` | GET | List all conversations |
| `/api/v1/conversations/:id` | GET | Get single conversation |
| `/api/v1/conversations/:id/messages` | GET | Get messages (supports `?limit=N&before=timestamp`) |
| `/api/v1/messages/send` | POST | Send a message |
| `/api/v1/attachments/*` | GET | Serve attachment files |
| `/ws` | WebSocket | Real-time updates |
