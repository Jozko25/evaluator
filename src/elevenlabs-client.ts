import axios, { AxiosInstance } from 'axios';

export interface ConversationMetadata {
  agent_id: string;
  conversation_id: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  status: 'initiated' | 'in-progress' | 'processing' | 'done' | 'failed';
  call_successful: 'success' | 'failure' | 'unknown';
  agent_name: string;
  transcript_summary?: string;
  call_summary_title?: string;
  direction: 'inbound' | 'outbound';
}

export interface ConversationsResponse {
  conversations: ConversationMetadata[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface TranscriptMessage {
  role: 'user' | 'agent';
  time_in_call_secs: number;
  message: string;
}

export interface ConversationDetails {
  agent_id: string;
  conversation_id: string;
  status: 'initiated' | 'in-progress' | 'processing' | 'done' | 'failed';
  transcript: TranscriptMessage[];
  metadata: {
    start_time_unix_secs: number;
    call_duration_secs: number;
    [key: string]: any;
  };
  has_audio: boolean;
  has_user_audio: boolean;
  has_response_audio: boolean;
  user_id?: string | null;
  analysis?: any;
}

export class ElevenLabsClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://api.elevenlabs.io/v1',
      headers: {
        'xi-api-key': apiKey,
      },
    });
  }

  async listConversations(options?: {
    cursor?: string;
    agent_id?: string;
    call_successful?: 'success' | 'failure' | 'unknown';
    call_start_before_unix?: number;
    call_start_after_unix?: number;
    user_id?: string;
    page_size?: number;
    summary_mode?: 'exclude' | 'include';
  }): Promise<ConversationsResponse> {
    const params: any = {};

    if (options?.cursor) params.cursor = options.cursor;
    if (options?.agent_id) params.agent_id = options.agent_id;
    if (options?.call_successful) params.call_successful = options.call_successful;
    if (options?.call_start_before_unix) params.call_start_before_unix = options.call_start_before_unix;
    if (options?.call_start_after_unix) params.call_start_after_unix = options.call_start_after_unix;
    if (options?.user_id) params.user_id = options.user_id;
    if (options?.page_size) params.page_size = options.page_size;
    if (options?.summary_mode) params.summary_mode = options.summary_mode;

    const response = await this.client.get<ConversationsResponse>('/convai/conversations', { params });
    return response.data;
  }

  async getConversationDetails(conversationId: string): Promise<ConversationDetails> {
    const response = await this.client.get<ConversationDetails>(`/convai/conversations/${conversationId}`);
    return response.data;
  }

  async getAllNewConversations(sinceUnixTimestamp?: number): Promise<ConversationMetadata[]> {
    const allConversations: ConversationMetadata[] = [];
    let cursor: string | null = null;
    let hasMore = true;

    const options: any = {
      page_size: 100,
      summary_mode: 'include' as const,
    };

    if (sinceUnixTimestamp) {
      options.call_start_after_unix = sinceUnixTimestamp;
    }

    while (hasMore) {
      if (cursor) {
        options.cursor = cursor;
      }

      const response = await this.listConversations(options);
      allConversations.push(...response.conversations);

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    return allConversations;
  }
}
