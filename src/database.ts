import Database from 'better-sqlite3';
import path from 'path';

export interface ConversationRecord {
  id: number;
  conversation_id: string;
  agent_id: string;
  agent_name: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  status: string;
  call_successful: string;
  direction: string;
  transcript_summary?: string;
  call_summary_title?: string;
  transcript_json?: string;
  processed_at: number;
  created_at: number;
}

export interface EvaluationRecord {
  id: number;
  conversation_id: string;
  evaluation_json: string;
  score?: number;
  summary?: string;
  created_at: number;
}

export class ConversationDatabase {
  private db: Database.Database;

  constructor(dbPath: string = './conversations.db') {
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT UNIQUE NOT NULL,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        start_time_unix_secs INTEGER NOT NULL,
        call_duration_secs INTEGER NOT NULL,
        message_count INTEGER NOT NULL,
        status TEXT NOT NULL,
        call_successful TEXT NOT NULL,
        direction TEXT,
        transcript_summary TEXT,
        call_summary_title TEXT,
        transcript_json TEXT,
        processed_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_conversation_id ON conversations(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_start_time ON conversations(start_time_unix_secs DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_id ON conversations(agent_id);

      CREATE TABLE IF NOT EXISTS evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        evaluation_json TEXT NOT NULL,
        score REAL,
        summary TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
      );

      CREATE INDEX IF NOT EXISTS idx_eval_conversation_id ON evaluations(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_eval_score ON evaluations(score DESC);

      CREATE TABLE IF NOT EXISTS sync_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_sync_timestamp INTEGER NOT NULL
      );
    `);
  }

  insertConversation(conversation: Omit<ConversationRecord, 'id' | 'created_at'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (
        conversation_id, agent_id, agent_name, start_time_unix_secs,
        call_duration_secs, message_count, status, call_successful,
        direction, transcript_summary, call_summary_title, transcript_json, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        status = excluded.status,
        transcript_summary = excluded.transcript_summary,
        call_summary_title = excluded.call_summary_title,
        transcript_json = excluded.transcript_json,
        processed_at = excluded.processed_at
    `);

    stmt.run(
      conversation.conversation_id,
      conversation.agent_id,
      conversation.agent_name,
      conversation.start_time_unix_secs,
      conversation.call_duration_secs,
      conversation.message_count,
      conversation.status,
      conversation.call_successful,
      conversation.direction,
      conversation.transcript_summary,
      conversation.call_summary_title,
      conversation.transcript_json,
      conversation.processed_at
    );
  }

  insertEvaluation(evaluation: Omit<EvaluationRecord, 'id' | 'created_at'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO evaluations (conversation_id, evaluation_json, score, summary)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      evaluation.conversation_id,
      evaluation.evaluation_json,
      evaluation.score,
      evaluation.summary
    );
  }

  getConversation(conversationId: string): ConversationRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE conversation_id = ?');
    return stmt.get(conversationId) as ConversationRecord | undefined;
  }

  getEvaluation(conversationId: string): EvaluationRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM evaluations WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1');
    return stmt.get(conversationId) as EvaluationRecord | undefined;
  }

  getAllConversationsWithEvaluations(limit: number = 50): any[] {
    const stmt = this.db.prepare(`
      SELECT
        c.*,
        e.evaluation_json,
        e.score,
        e.summary as eval_summary
      FROM conversations c
      LEFT JOIN evaluations e ON c.conversation_id = e.conversation_id
      ORDER BY c.start_time_unix_secs DESC
      LIMIT ?
    `);

    return stmt.all(limit);
  }

  getUnevaluatedConversations(): ConversationRecord[] {
    const stmt = this.db.prepare(`
      SELECT c.* FROM conversations c
      LEFT JOIN evaluations e ON c.conversation_id = e.conversation_id
      WHERE e.id IS NULL AND c.status = 'done'
      ORDER BY c.start_time_unix_secs ASC
    `);

    return stmt.all() as ConversationRecord[];
  }

  getLastSyncTimestamp(): number | null {
    const stmt = this.db.prepare('SELECT last_sync_timestamp FROM sync_state WHERE id = 1');
    const result = stmt.get() as { last_sync_timestamp: number } | undefined;
    return result?.last_sync_timestamp ?? null;
  }

  updateLastSyncTimestamp(timestamp: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO sync_state (id, last_sync_timestamp) VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET last_sync_timestamp = excluded.last_sync_timestamp
    `);
    stmt.run(timestamp);
  }

  close() {
    this.db.close();
  }
}
