# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Passage is a Messages.app proxy that enables accessing iMessage and SMS through a web browser. It runs on macOS and reads directly from the Messages.app SQLite database, providing a web interface accessible from Linux desktops, TVs, or any browser on the local network.

**Key constraint:** This project MUST run on macOS because it requires:
- Direct access to `~/Library/Messages/chat.db` (Messages.app database)
- AppleScript integration to send messages via Messages.app
- Messages.app must be signed into iCloud and running

## Development Commands

```bash
# Install dependencies (first time setup)
pnpm install

# Run both frontend and backend in dev mode (parallel)
pnpm dev
# Backend: http://localhost:3000
# Frontend: http://localhost:5173

# Build all packages
pnpm build

# Lint and format (uses Biome)
pnpm lint
pnpm format

# Run individual packages
cd apps/passage-backend && pnpm dev    # Backend only
cd apps/passage-frontend && pnpm dev   # Frontend only

# Build individual packages
cd apps/passage-backend && pnpm build  # TypeScript compilation to dist/
cd apps/passage-frontend && pnpm build # Vite build to dist/
```

## Architecture

### Monorepo Structure
- **pnpm workspace** with three packages
- **`apps/passage-backend`** - Express server (TypeScript, Node.js)
- **`apps/passage-frontend`** - React SPA (TypeScript, Vite)
- **`packages/shared-types`** - TypeScript types shared between frontend/backend

### Backend Architecture

The backend (`apps/passage-backend/src/`) consists of four main services initialized in `server.ts`:

1. **MessagesDatabase** (`database.ts`)
   - Opens `~/Library/Messages/chat.db` in **readonly mode** (critical to prevent corruption)
   - Uses `better-sqlite3` for synchronous SQLite access
   - Parses Messages.app's complex schema (chat, message, handle, chat_message_join, message_attachment_join tables)
   - **Apple timestamp conversion**: Messages.app stores timestamps as nanoseconds since 2001-01-01, must convert to Unix milliseconds

2. **MessagesDatabaseWatcher** (`watcher.ts`)
   - Uses `chokidar` to watch `chat.db` for file changes
   - Debounces rapid changes (Messages.app writes multiple times per message)
   - Emits 'change' events when new messages arrive

3. **AppleScriptMessenger** (`applescript.ts`)
   - Executes `osascript` commands to send messages through Messages.app
   - **Requires Messages.app to be running**
   - Tries iMessage first, falls back to SMS if recipient not on iMessage
   - Escapes special characters in AppleScript strings

4. **WebSocket Server** (in `server.ts`)
   - Listens on `/ws` endpoint
   - Broadcasts updates when database watcher detects changes
   - Maintains Set of active WebSocket clients
   - Auto-reconnects on disconnect (3-second delay)

### Frontend Architecture

The frontend uses a **singleton MobX controller pattern** (following the heimerdinger-device pattern):

- **MessagesController** (`controller.ts`)
  - Singleton instance via `MessagesController.instance`
  - Auto-observable MobX state (conversations, messages, selectedConversationId)
  - WebSocket client that auto-reconnects on disconnect
  - Message cache in Map<conversationId, Message[]>
  - Handles WebSocket message types: `new_message`, `message_updated`, `conversation_updated`, `error`

- **Component hierarchy:**
  - `App.tsx` - Two-column layout (sidebar + main)
  - `ConversationList.tsx` - Sidebar with all conversations, unread counts
  - `MessageThread.tsx` - Main message view with auto-scroll to bottom
  - `MessageComposer.tsx` - Input field + send button
  - All wrapped with MobX `observer()` HOC for reactive updates

### UI Framework
- **shadcn/ui** with "new-york" style and neutral base color
- **Tailwind CSS v4** with CSS variables for theming
- Custom CSS variables for iMessage blue (`--color-imessage-blue`) and SMS gray
- **TV-optimized**: Large touch targets (min 48px), visible focus states, keyboard navigation

## Critical Implementation Details

### Messages.app Database Schema
The backend must handle Messages.app's normalized schema:
- `chat` table - conversations (individual or group)
- `message` table - all messages
- `handle` table - contacts (phone numbers or emails)
- `chat_message_join` - many-to-many relationship
- `message_attachment_join` - links messages to attachments
- **No foreign key constraints** - must join manually

### TypeScript Configuration
- Backend uses `"moduleResolution": "bundler"` with ESNext target
- Frontend uses project references (tsconfig.json → tsconfig.app.json + tsconfig.node.json)
- Workspace dependencies use `"workspace:*"` in package.json
- Path aliases: `@/` for src, `@shared/` for shared-types

### Environment Variables
Backend (`.env` in `apps/passage-backend/`):
```env
PORT=3000
MESSAGES_DB_PATH=~/Library/Messages/chat.db
ATTACHMENTS_PATH=~/Library/Messages/Attachments
```

Frontend (`.env` in `apps/passage-frontend/`):
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
```

For remote access, change to Mac's LAN IP (e.g., `http://192.168.1.10:3000`).

## API Contract

### REST Endpoints (Express Router under `/api/v1`)
- `GET /api/v1/conversations` → `GetConversationsResponse`
- `GET /api/v1/conversations/:id` → `GetConversationResponse`
- `GET /api/v1/conversations/:id/messages?limit=100&before=<timestamp>` → `GetMessagesResponse`
- `POST /api/v1/messages/send` with `SendMessageRequest` → `SendMessageResponse`
- `GET /api/v1/attachments/*` - Serves files from `ATTACHMENTS_PATH`

### WebSocket Messages (type discriminated union)
```typescript
type WebSocketMessage =
  | { type: 'new_message'; payload: Message }
  | { type: 'message_updated'; payload: Message }
  | { type: 'conversation_updated'; payload: Conversation }
  | { type: 'error'; payload: { message: string } }
```

All types defined in `packages/shared-types/types.ts`.

## Security & Permissions

**macOS Full Disk Access Required:**
- Terminal app (Terminal.app, iTerm2, etc.) needs Full Disk Access permission
- Go to: System Settings > Privacy & Security > Full Disk Access
- Without this, backend cannot read Messages database

**No Authentication:**
- ⚠️ This is a local network tool with NO authentication
- Anyone on LAN can access all messages
- Not designed for internet exposure

**Database Safety:**
- Opens chat.db in readonly mode to prevent corruption
- Messages.app may lock database - reopening required

## Common Development Patterns

### Adding a New API Endpoint
1. Add request/response types to `packages/shared-types/types.ts`
2. Create handler function in backend that uses `MessagesDatabase` or `AppleScriptMessenger`
3. Register route in `server.ts` under `apiV1` router
4. Add corresponding method in `MessagesController` (frontend)
5. Call from React components wrapped in `observer()`

### Adding a New WebSocket Message Type
1. Add to `WebSocketMessage` discriminated union in `shared-types/types.ts`
2. Update `handleWebSocketMessage()` in frontend `controller.ts`
3. Emit from backend in watcher 'change' event handler or other appropriate location

### Debugging Database Issues
- Check `~/Library/Messages/chat.db` exists and is readable
- Use `sqlite3 ~/Library/Messages/chat.db` to inspect schema
- Backend logs SQL queries - look for parsing errors
- Messages.app schema can change between macOS versions

### Testing Locally
1. Ensure Messages.app is signed into iCloud
2. Run `pnpm dev` from root
3. Open `http://localhost:5173` in browser
4. Backend logs appear in terminal where `pnpm dev` was run
5. Send test message from Messages.app to see real-time sync
6. Check browser console for WebSocket connection status

## Extending to Other Services

The original vision for this project is to expand beyond just Messages to other macOS services. The name "Passage" was chosen to represent providing "passage" to various Mac services.

If adding new services:
- Consider creating new backend services (e.g., `NotesDatabase`, `ContactsReader`)
- Add new API routers under versioned paths (e.g., `/api/v1/notes`, `/api/v1/contacts`)
- Extend frontend with new views/routes
- Keep shared types in `packages/shared-types` or create service-specific type packages
