import express, { Request, Response } from 'express';
import { ConversationDatabase } from './database';
import path from 'path';

export function createAPIServer(db: ConversationDatabase, port: number = 3000) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // Get all conversations with evaluations
  app.get('/api/conversations', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const conversations = db.getAllConversationsWithEvaluations(limit);

      const formattedConversations = conversations.map(conv => ({
        id: conv.conversation_id,
        agentName: conv.agent_name,
        startTime: conv.start_time_unix_secs,
        duration: conv.call_duration_secs,
        messageCount: conv.message_count,
        status: conv.status,
        callSuccessful: conv.call_successful,
        direction: conv.direction,
        summary: conv.transcript_summary || conv.call_summary_title,
        evaluation: conv.evaluation_json ? JSON.parse(conv.evaluation_json) : null,
        score: conv.score,
      }));

      res.json({ conversations: formattedConversations });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // Get single conversation details
  app.get('/api/conversations/:id', (req: Request, res: Response) => {
    try {
      const conversationId = req.params.id;
      const conversation = db.getConversation(conversationId);
      const evaluation = db.getEvaluation(conversationId);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const response: any = {
        id: conversation.conversation_id,
        agentId: conversation.agent_id,
        agentName: conversation.agent_name,
        startTime: conversation.start_time_unix_secs,
        duration: conversation.call_duration_secs,
        messageCount: conversation.message_count,
        status: conversation.status,
        callSuccessful: conversation.call_successful,
        direction: conversation.direction,
        summary: conversation.transcript_summary || conversation.call_summary_title,
        transcript: conversation.transcript_json ? JSON.parse(conversation.transcript_json) : null,
        evaluation: evaluation ? JSON.parse(evaluation.evaluation_json) : null,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  // Get statistics
  app.get('/api/stats', (req: Request, res: Response) => {
    try {
      const conversations = db.getAllConversationsWithEvaluations(1000);

      const totalConversations = conversations.length;
      const evaluatedCount = conversations.filter(c => c.evaluation_json).length;
      const avgScore = conversations
        .filter(c => c.score != null)
        .reduce((sum, c) => sum + c.score, 0) / (evaluatedCount || 1);

      const successfulCalls = conversations.filter(c => c.call_successful === 'success').length;

      res.json({
        totalConversations,
        evaluatedCount,
        unevaluatedCount: totalConversations - evaluatedCount,
        averageScore: Math.round(avgScore * 10) / 10,
        successRate: Math.round((successfulCalls / totalConversations) * 100),
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  const server = app.listen(port, () => {
    console.log(`[API] Server running on http://localhost:${port}`);
  });

  return server;
}
