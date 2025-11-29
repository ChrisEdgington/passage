import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Message, Conversation, Contact, Attachment, Reaction, ReactionType } from '@passage/shared-types';
import bplistParser from 'bplist-parser';
import type { ContactsResolver } from './contacts.js';

const MESSAGES_DB_PATH = process.env.MESSAGES_DB_PATH || join(homedir(), 'Library/Messages/chat.db');

// iMessage reaction type codes
// 2000-2005 = add reaction, 3000-3005 = remove reaction
const REACTION_TYPE_MAP: Record<number, ReactionType> = {
  2000: 'love',
  2001: 'like',
  2002: 'dislike',
  2003: 'laugh',
  2004: 'emphasis',
  2005: 'question',
};

// Check if a message is a reaction (tapback)
function isReactionMessage(associatedMessageType: number | null): boolean {
  if (!associatedMessageType) return false;
  // Types 2000-2005 are add reactions, 3000-3005 are remove reactions
  return (associatedMessageType >= 2000 && associatedMessageType <= 2005) ||
         (associatedMessageType >= 3000 && associatedMessageType <= 3005);
}

// Get the reaction type from associated_message_type
function getReactionType(associatedMessageType: number): ReactionType | null {
  // Normalize remove reactions (3000-3005) to their add equivalents (2000-2005)
  const normalized = associatedMessageType >= 3000 ? associatedMessageType - 1000 : associatedMessageType;
  return REACTION_TYPE_MAP[normalized] || null;
}

// Check if this is a "remove reaction" message
function isRemoveReaction(associatedMessageType: number): boolean {
  return associatedMessageType >= 3000 && associatedMessageType <= 3005;
}

export class MessagesDatabase {
  private db: Database.Database;
  private contactsResolver?: ContactsResolver;

  constructor(contactsResolver?: ContactsResolver) {
    // Open database in readonly mode
    this.db = new Database(MESSAGES_DB_PATH, { readonly: true, fileMustExist: true });
    this.contactsResolver = contactsResolver;
  }

  // Extract plain text from attributedBody (handles both bplist and typedstream formats)
  private extractTextFromAttributedBody(attributedBody: Buffer | null): string | null {
    if (!attributedBody || attributedBody.length < 8) return null;

    // Check if it starts with 'bplist' (0x62 0x70 0x6c 0x69 0x73 0x74)
    const isBplist = attributedBody.length >= 6 &&
      attributedBody[0] === 0x62 && // 'b'
      attributedBody[1] === 0x70 && // 'p'
      attributedBody[2] === 0x6c && // 'l'
      attributedBody[3] === 0x69 && // 'i'
      attributedBody[4] === 0x73 && // 's'
      attributedBody[5] === 0x74;   // 't'

    if (isBplist) {
      try {
        const parsed = bplistParser.parseBuffer(attributedBody);
        if (parsed && parsed.length > 0) {
          const obj = parsed[0];
          if (obj.NSString) return obj.NSString;
          if (obj['NS.string']) return obj['NS.string'];
          if (obj.NSAttributedString) {
            const attrString = obj.NSAttributedString;
            if (attrString.NSString) return attrString.NSString;
            if (attrString['NS.string']) return attrString['NS.string'];
          }
        }
      } catch (error) {
        // Silently fall through to string extraction
      }
    }

    // For typedstream format, find NSString marker and extract the length-prefixed string
    // Format: NSString + \x01\x94\x84\x01 + \x2b ('+' type marker) + length byte(s) + actual text
    const nsStringMarker = Buffer.from('NSString');
    const markerIndex = attributedBody.indexOf(nsStringMarker);

    if (markerIndex !== -1) {
      // After NSString, there's a fixed header: \x01\x94\x84\x01\x2b then length byte(s) then text
      // The \x2b ('+') is a type indicator in typedstream format
      let offset = markerIndex + nsStringMarker.length;

      // Skip the fixed header bytes (typically 01 94 84 01)
      offset += 4;

      // Skip the '+' type marker (0x2b) if present
      if (offset < attributedBody.length && attributedBody[offset] === 0x2b) {
        offset++;
      }

      if (offset < attributedBody.length) {
        let textLength: number;

        // Check for multi-byte length encoding
        // If high bit is set (>= 0x80), it indicates extended length format
        if (attributedBody[offset] >= 0x80) {
          // Multi-byte length: 0x81 means 1 additional byte, 0x82 means 2, etc.
          const extraBytes = attributedBody[offset] - 0x80;
          offset++;

          if (extraBytes === 1 && offset < attributedBody.length) {
            textLength = attributedBody[offset];
            offset++;
            // Skip the null separator byte if present
            if (offset < attributedBody.length && attributedBody[offset] === 0x00) {
              offset++;
            }
          } else if (extraBytes === 2 && offset + 1 < attributedBody.length) {
            textLength = (attributedBody[offset] << 8) | attributedBody[offset + 1];
            offset += 2;
            if (offset < attributedBody.length && attributedBody[offset] === 0x00) {
              offset++;
            }
          } else {
            textLength = 0; // Unknown format
          }
        } else {
          // Simple single-byte length
          textLength = attributedBody[offset];
          offset++;
        }

        if (textLength > 0 && offset + textLength <= attributedBody.length) {
          // Extract the text
          const textBuffer = attributedBody.subarray(offset, offset + textLength);
          const extractedText = textBuffer.toString('utf8');

          // Clean up any trailing binary garbage
          const cleaned = extractedText.replace(/[\x00-\x1f\x80-\x9f]+$/, '').trim();

          // Validate it's not just control characters
          if (cleaned.length > 0 && !/^[\x00-\x1f]*$/.test(cleaned)) {
            return cleaned;
          }
        }
      }
    }

    return null;
  }

  // Get all conversations with their last message
  getConversations(): Conversation[] {
    const query = `
      SELECT
        c.ROWID as chat_id,
        c.chat_identifier,
        c.display_name,
        c.group_id,
        (SELECT COUNT(*) FROM chat_message_join cmj
         JOIN message m ON cmj.message_id = m.ROWID
         WHERE cmj.chat_id = c.ROWID AND m.is_read = 0 AND m.is_from_me = 0) as unread_count,
        (SELECT MAX(m.date) FROM chat_message_join cmj
         JOIN message m ON cmj.message_id = m.ROWID
         WHERE cmj.chat_id = c.ROWID) as last_message_date
      FROM chat c
      WHERE last_message_date IS NOT NULL
      ORDER BY last_message_date DESC
    `;

    const rows = this.db.prepare(query).all() as any[];

    return rows.map((row) => {
      const participants = this.getChatParticipants(row.chat_id);
      const lastMessage = this.getLastMessageForChat(row.chat_id);

      return {
        id: String(row.chat_id),
        displayName: row.display_name || this.generateDisplayName(participants),
        participants,
        lastMessage,
        unreadCount: row.unread_count || 0,
        isGroup: participants.length > 2,
        groupPhotoPath: undefined,
      };
    });
  }

  // Get a single conversation by ID
  getConversation(conversationId: string): Conversation | null {
    const query = `
      SELECT
        c.ROWID as chat_id,
        c.chat_identifier,
        c.display_name,
        c.group_id,
        (SELECT COUNT(*) FROM chat_message_join cmj
         JOIN message m ON cmj.message_id = m.ROWID
         WHERE cmj.chat_id = c.ROWID AND m.is_read = 0 AND m.is_from_me = 0) as unread_count
      FROM chat c
      WHERE c.ROWID = ?
    `;

    const row = this.db.prepare(query).get(conversationId) as any;
    if (!row) return null;

    const participants = this.getChatParticipants(row.chat_id);
    const lastMessage = this.getLastMessageForChat(row.chat_id);

    return {
      id: String(row.chat_id),
      displayName: row.display_name || this.generateDisplayName(participants),
      participants,
      lastMessage,
      unreadCount: row.unread_count || 0,
      isGroup: participants.length > 2,
      groupPhotoPath: undefined,
    };
  }

  // Get participants for a chat
  private getChatParticipants(chatId: number): Contact[] {
    const query = `
      SELECT
        h.ROWID as handle_id,
        h.id as handle_identifier,
        h.service
      FROM handle h
      JOIN chat_handle_join chj ON chj.handle_id = h.ROWID
      WHERE chj.chat_id = ?
    `;

    const rows = this.db.prepare(query).all(chatId) as any[];

    return rows.map((row) => ({
      id: String(row.handle_id),
      displayName: this.formatHandleIdentifier(row.handle_identifier),
      handleIdentifier: row.handle_identifier,
      phoneNumber: row.service === 'SMS' ? row.handle_identifier : undefined,
      email: row.service === 'iMessage' && row.handle_identifier.includes('@') ? row.handle_identifier : undefined,
      isMe: false,
    }));
  }

  // Get messages for a conversation
  getMessages(conversationId: string, limit = 100, before?: number): { messages: Message[]; hasMore: boolean } {
    // First, get all messages including reactions (we need more than limit to account for reactions)
    let query = `
      SELECT
        m.ROWID as message_id,
        m.guid,
        m.text,
        m.attributedBody,
        m.handle_id,
        m.service,
        m.date,
        m.date_read,
        m.date_delivered,
        m.is_from_me,
        m.is_read,
        m.is_sent,
        m.is_delivered,
        m.cache_has_attachments,
        m.associated_message_guid,
        m.associated_message_type,
        m.expressive_send_style_id,
        h.id as sender_identifier
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE cmj.chat_id = ?
    `;

    const params: any[] = [conversationId];

    if (before) {
      query += ' AND m.date < ?';
      params.push(before);
    }

    // Fetch more messages to account for reactions that will be filtered out
    query += ' ORDER BY m.date DESC LIMIT ?';
    params.push((limit + 1) * 3); // Fetch extra to handle reactions

    const rows = this.db.prepare(query).all(...params) as any[];

    // Separate reactions from regular messages
    const reactionRows: any[] = [];
    const messageRows: any[] = [];

    for (const row of rows) {
      if (isReactionMessage(row.associated_message_type)) {
        reactionRows.push(row);
      } else {
        messageRows.push(row);
      }
    }

    // Build a map of reactions by parent message GUID
    // The associated_message_guid format is like "p:0/GUID" or "bp:GUID"
    const reactionsMap = new Map<string, Reaction[]>();

    for (const row of reactionRows) {
      if (!row.associated_message_guid || isRemoveReaction(row.associated_message_type)) continue;

      // Extract the parent message GUID from associated_message_guid
      // Format can be: "p:0/GUID", "p:1/GUID", "bp:GUID", or just "GUID"
      let parentGuid = row.associated_message_guid;
      const match = parentGuid.match(/(?:p:\d+\/|bp:)?(.+)/);
      if (match) {
        parentGuid = match[1];
      }

      const reactionType = getReactionType(row.associated_message_type);
      if (!reactionType) continue;

      const reaction: Reaction = {
        type: reactionType,
        senderId: row.is_from_me ? 'me' : String(row.handle_id || 'unknown'),
        senderName: row.is_from_me ? 'Me' : this.formatHandleIdentifier(row.sender_identifier || 'Unknown'),
        isFromMe: Boolean(row.is_from_me),
      };

      const existing = reactionsMap.get(parentGuid) || [];
      existing.push(reaction);
      reactionsMap.set(parentGuid, existing);
    }

    // Check if there are more messages
    const hasMore = messageRows.length > limit;

    // Map message rows and attach reactions
    const messages = messageRows.slice(0, limit).map((row) => {
      const message = this.mapRowToMessage(row, conversationId);
      // Attach reactions to this message
      const reactions = reactionsMap.get(row.guid) || [];
      message.reactions = reactions;
      return message;
    });

    return { messages: messages.reverse(), hasMore };
  }

  // Get last message for a chat (excluding reactions)
  private getLastMessageForChat(chatId: number): Message | null {
    const query = `
      SELECT
        m.ROWID as message_id,
        m.guid,
        m.text,
        m.attributedBody,
        m.handle_id,
        m.service,
        m.date,
        m.date_read,
        m.date_delivered,
        m.is_from_me,
        m.is_read,
        m.is_sent,
        m.is_delivered,
        m.cache_has_attachments,
        m.associated_message_guid,
        m.associated_message_type,
        m.expressive_send_style_id,
        h.id as sender_identifier
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE cmj.chat_id = ?
        AND (m.associated_message_type IS NULL OR m.associated_message_type < 2000 OR m.associated_message_type > 3005)
      ORDER BY m.date DESC
      LIMIT 1
    `;

    const row = this.db.prepare(query).get(chatId) as any;
    if (!row) return null;

    return this.mapRowToMessage(row, String(chatId));
  }

  // Get attachments for a message
  private getMessageAttachments(messageId: number): Attachment[] {
    const query = `
      SELECT
        a.ROWID as attachment_id,
        a.filename,
        a.mime_type,
        a.total_bytes,
        a.transfer_name,
        a.is_sticker,
        a.hide_attachment
      FROM attachment a
      JOIN message_attachment_join maj ON maj.attachment_id = a.ROWID
      WHERE maj.message_id = ?
    `;

    const rows = this.db.prepare(query).all(messageId) as any[];

    return rows.map((row) => ({
      id: String(row.attachment_id),
      messageId: String(messageId),
      filename: row.filename || '',
      mimeType: row.mime_type || '',
      totalBytes: row.total_bytes || 0,
      transferName: row.transfer_name || '',
      filePath: row.filename || '',
      isSticker: Boolean(row.is_sticker),
      hideAttachment: Boolean(row.hide_attachment),
    }));
  }

  // Map database row to Message object
  private mapRowToMessage(row: any, conversationId: string): Message {
    // Convert Apple's timestamp (nanoseconds since 2001-01-01) to Unix timestamp (ms)
    const appleEpoch = 978307200000; // 2001-01-01 in Unix time (ms)
    const timestamp = row.date ? appleEpoch + row.date / 1000000 : Date.now();

    const attachments = row.cache_has_attachments ? this.getMessageAttachments(row.message_id) : [];

    // Extract text from attributedBody if text field is empty
    let messageText = row.text;
    if (!messageText && row.attributedBody) {
      messageText = this.extractTextFromAttributedBody(row.attributedBody);
    }

    return {
      id: row.guid || String(row.message_id),
      conversationId,
      text: messageText || '',
      senderId: row.is_from_me ? 'me' : String(row.handle_id || 'unknown'),
      senderName: row.is_from_me ? 'Me' : this.formatHandleIdentifier(row.sender_identifier || 'Unknown'),
      timestamp: Math.floor(timestamp),
      isFromMe: Boolean(row.is_from_me),
      isRead: Boolean(row.is_read),
      isSent: Boolean(row.is_sent),
      isDelivered: Boolean(row.is_delivered),
      attachments,
      reactions: [], // Populated by getMessages when grouping reactions
      associatedMessageGuid: row.associated_message_guid || undefined,
      associatedMessageType: row.associated_message_type || undefined,
      expressiveSendStyleId: row.expressive_send_style_id || undefined,
    };
  }

  // Helper: Generate display name from participants
  private generateDisplayName(participants: Contact[]): string {
    if (participants.length === 0) return 'Unknown';
    if (participants.length === 1) return participants[0].displayName;
    if (participants.length === 2) return participants.map((p) => p.displayName).join(', ');
    return `${participants[0].displayName} and ${participants.length - 1} others`;
  }

  // Helper: Format phone number or email for display
  private formatHandleIdentifier(identifier: string): string {
    if (!identifier) return 'Unknown';

    // Try to resolve contact name first
    if (this.contactsResolver) {
      const contactName = this.contactsResolver.resolve(identifier);
      if (contactName) return contactName;
    }

    // If it's an email, return as-is
    if (identifier.includes('@')) return identifier;

    // If it's a phone number, format it nicely (basic formatting)
    const cleaned = identifier.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }

    return identifier;
  }

  // Close the database connection
  close(): void {
    this.db.close();
  }
}
