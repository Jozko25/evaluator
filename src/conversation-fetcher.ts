import { ElevenLabsClient, ConversationMetadata } from './elevenlabs-client';
import { ConversationDatabase } from './database';

export class ConversationFetcher {
  private client: ElevenLabsClient;
  private db: ConversationDatabase;
  private pollInterval: number;
  private isRunning: boolean = false;
  private timeoutId?: NodeJS.Timeout;

  constructor(apiKey: string, db: ConversationDatabase, pollIntervalMs: number = 30000) {
    this.client = new ElevenLabsClient(apiKey);
    this.db = db;
    this.pollInterval = pollIntervalMs;
  }

  async fetchAndStoreNewConversations(): Promise<number> {
    try {
      const lastSync = this.db.getLastSyncTimestamp();
      const currentTime = Math.floor(Date.now() / 1000);

      console.log(`[Fetcher] Fetching conversations since ${lastSync ? new Date(lastSync * 1000).toISOString() : 'beginning'}`);

      const conversations = await this.client.getAllNewConversations(lastSync ?? undefined);

      console.log(`[Fetcher] Found ${conversations.length} conversations`);

      let newCount = 0;
      for (const conv of conversations) {
        const existing = this.db.getConversation(conv.conversation_id);

        if (!existing || existing.status !== conv.status) {
          // Fetch full details if status is 'done' and we don't have transcript yet
          let transcriptJson: string | undefined = existing?.transcript_json;

          if (conv.status === 'done' && !transcriptJson) {
            try {
              const details = await this.client.getConversationDetails(conv.conversation_id);
              transcriptJson = JSON.stringify(details.transcript);
              console.log(`[Fetcher] Fetched transcript for conversation ${conv.conversation_id}`);
            } catch (error) {
              console.error(`[Fetcher] Failed to fetch transcript for ${conv.conversation_id}:`, error);
            }
          }

          this.db.insertConversation({
            conversation_id: conv.conversation_id,
            agent_id: conv.agent_id,
            agent_name: conv.agent_name,
            start_time_unix_secs: conv.start_time_unix_secs,
            call_duration_secs: conv.call_duration_secs,
            message_count: conv.message_count,
            status: conv.status,
            call_successful: conv.call_successful,
            direction: conv.direction,
            transcript_summary: conv.transcript_summary,
            call_summary_title: conv.call_summary_title,
            transcript_json: transcriptJson,
            processed_at: currentTime,
          });

          if (!existing) newCount++;
        }
      }

      this.db.updateLastSyncTimestamp(currentTime);

      console.log(`[Fetcher] Stored ${newCount} new conversations`);
      return newCount;
    } catch (error) {
      console.error('[Fetcher] Error fetching conversations:', error);
      throw error;
    }
  }

  start() {
    if (this.isRunning) {
      console.log('[Fetcher] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[Fetcher] Starting with ${this.pollInterval}ms interval`);

    const poll = async () => {
      if (!this.isRunning) return;

      try {
        await this.fetchAndStoreNewConversations();
      } catch (error) {
        console.error('[Fetcher] Poll error:', error);
      }

      if (this.isRunning) {
        this.timeoutId = setTimeout(poll, this.pollInterval);
      }
    };

    // Start immediately
    poll();
  }

  stop() {
    console.log('[Fetcher] Stopping...');
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
}
