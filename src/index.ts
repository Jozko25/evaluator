import dotenv from 'dotenv';
import { ConversationDatabase } from './database';
import { ConversationFetcher } from './conversation-fetcher';
import { EvaluationService, PlaceholderEvaluator } from './evaluator';
import { createAPIServer } from './api';

dotenv.config();

const API_KEY = process.env.ELEVENLABS_API_KEY;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '30000');
const PORT = parseInt(process.env.PORT || '3000');

if (!API_KEY) {
  console.error('ERROR: ELEVENLABS_API_KEY not found in .env file');
  process.exit(1);
}

console.log('🚀 Starting 11Labs Conversation Evaluator...\n');

// Initialize database
const db = new ConversationDatabase('./conversations.db');
console.log('✓ Database initialized');

// Initialize conversation fetcher
const fetcher = new ConversationFetcher(API_KEY, db, POLL_INTERVAL);
console.log(`✓ Conversation fetcher ready (polling every ${POLL_INTERVAL}ms)`);

// Initialize evaluator (using placeholder for now)
// TODO: Replace PlaceholderEvaluator with actual LLM integration
const evaluator = new PlaceholderEvaluator();
const evaluationService = new EvaluationService(db, evaluator, 10000);
console.log('✓ Evaluation service ready');

// Start API server
const server = createAPIServer(db, PORT);
console.log(`✓ API server running on http://localhost:${PORT}`);

// Start background services
fetcher.start();
evaluationService.start();

console.log('\n✨ All systems operational!');
console.log(`\n📱 Open http://localhost:${PORT} on your iPhone\n`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  fetcher.stop();
  evaluationService.stop();
  server.close(() => {
    db.close();
    console.log('✓ Cleanup complete');
    process.exit(0);
  });
});
