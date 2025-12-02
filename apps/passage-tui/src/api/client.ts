import type {
  Conversation,
  Message,
  GetConversationsResponse,
  GetMessagesResponse,
  SendMessageRequest,
  SendMessageResponse,
} from '@passage/shared-types';

export class ApiClient {
  private baseUrl: string;

  constructor(host: string) {
    // Ensure proper URL format
    this.baseUrl = host.startsWith('http') ? host : `http://${host}`;
    // Remove trailing slash if present
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async getConversations(): Promise<Conversation[]> {
    const response = await this.fetch<GetConversationsResponse>('/api/v1/conversations');
    return response.conversations;
  }

  async getMessages(
    conversationId: string,
    limit = 50,
    before?: number
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    let path = `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}`;
    if (before) {
      path += `&before=${before}`;
    }
    const response = await this.fetch<GetMessagesResponse>(path);
    return response;
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.fetch<SendMessageResponse>('/api/v1/messages/send', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  getAttachmentUrl(path: string): string {
    // Return full URL for attachment
    return `${this.baseUrl}/api/v1/attachments/${encodeURIComponent(path)}`;
  }

  async fetchAttachmentBuffer(path: string): Promise<Buffer> {
    const url = this.getAttachmentUrl(path);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/api/v1/conversations`, { method: 'HEAD' });
      return true;
    } catch {
      return false;
    }
  }
}
