import { ConversationDatabase } from './database';
import { TranscriptMessage } from './elevenlabs-client';

export interface EvaluationResult {
  score: number; // 0-100
  summary: string;
  strengths: string[];
  improvements: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  keyTopics: string[];
  agentPerformance: {
    responsiveness: number; // 0-10
    accuracy: number; // 0-10
    helpfulness: number; // 0-10
  };
}

export abstract class LLMEvaluator {
  abstract evaluate(transcript: TranscriptMessage[], metadata?: any): Promise<EvaluationResult>;
}

// Placeholder evaluator - replace with actual LLM integration
export class PlaceholderEvaluator extends LLMEvaluator {
  async evaluate(transcript: TranscriptMessage[], metadata?: any): Promise<EvaluationResult> {
    // Simple heuristic evaluation for demo purposes
    const messageCount = transcript.length;
    const userMessages = transcript.filter(m => m.role === 'user').length;
    const agentMessages = transcript.filter(m => m.role === 'agent').length;

    const score = Math.min(100, (messageCount * 10) + (Math.random() * 30));

    return {
      score: Math.round(score),
      summary: `Conversation with ${messageCount} messages. ${userMessages} from user, ${agentMessages} from agent.`,
      strengths: [
        'Agent responded to all user queries',
        'Conversation flow was natural',
      ],
      improvements: [
        'Could provide more detailed responses',
      ],
      sentiment: score > 70 ? 'positive' : score > 40 ? 'neutral' : 'negative',
      keyTopics: ['general inquiry', 'support'],
      agentPerformance: {
        responsiveness: Math.round((agentMessages / Math.max(userMessages, 1)) * 5),
        accuracy: Math.round(7 + Math.random() * 3),
        helpfulness: Math.round(6 + Math.random() * 4),
      },
    };
  }
}

export class EvaluationService {
  private db: ConversationDatabase;
  private evaluator: LLMEvaluator;
  private isRunning: boolean = false;
  private timeoutId?: NodeJS.Timeout;
  private checkInterval: number;

  constructor(db: ConversationDatabase, evaluator: LLMEvaluator, checkIntervalMs: number = 10000) {
    this.db = db;
    this.evaluator = evaluator;
    this.checkInterval = checkIntervalMs;
  }

  async evaluateConversation(conversationId: string): Promise<void> {
    const conversation = this.db.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    if (!conversation.transcript_json) {
      console.log(`[Evaluator] Conversation ${conversationId} has no transcript yet`);
      return;
    }

    const existing = this.db.getEvaluation(conversationId);
    if (existing) {
      console.log(`[Evaluator] Conversation ${conversationId} already evaluated`);
      return;
    }

    const transcript: TranscriptMessage[] = JSON.parse(conversation.transcript_json);

    console.log(`[Evaluator] Evaluating conversation ${conversationId}...`);
    const result = await this.evaluator.evaluate(transcript, {
      agent_name: conversation.agent_name,
      duration: conversation.call_duration_secs,
      call_successful: conversation.call_successful,
    });

    this.db.insertEvaluation({
      conversation_id: conversationId,
      evaluation_json: JSON.stringify(result),
      score: result.score,
      summary: result.summary,
    });

    console.log(`[Evaluator] Evaluated ${conversationId} with score ${result.score}`);
  }

  async processUnevaluated(): Promise<number> {
    const unevaluated = this.db.getUnevaluatedConversations();

    console.log(`[Evaluator] Found ${unevaluated.length} unevaluated conversations`);

    let processed = 0;
    for (const conv of unevaluated) {
      try {
        await this.evaluateConversation(conv.conversation_id);
        processed++;
      } catch (error) {
        console.error(`[Evaluator] Failed to evaluate ${conv.conversation_id}:`, error);
      }
    }

    return processed;
  }

  start() {
    if (this.isRunning) {
      console.log('[Evaluator] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[Evaluator] Starting with ${this.checkInterval}ms check interval`);

    const check = async () => {
      if (!this.isRunning) return;

      try {
        await this.processUnevaluated();
      } catch (error) {
        console.error('[Evaluator] Check error:', error);
      }

      if (this.isRunning) {
        this.timeoutId = setTimeout(check, this.checkInterval);
      }
    };

    check();
  }

  stop() {
    console.log('[Evaluator] Stopping...');
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
}
