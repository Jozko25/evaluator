import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import OpenAI from 'openai';
import { ElevenLabsClient, ConversationMetadata, TranscriptMessage } from './elevenlabs-client';

dotenv.config();

// Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '60000');

if (!ELEVENLABS_API_KEY) {
  console.error('❌ ELEVENLABS_API_KEY not found in .env');
  process.exit(1);
}

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not found in .env');
  console.log('\n📖 Setup Instructions:');
  console.log('1. Create bot via @BotFather on Telegram');
  console.log('2. Get your chat ID from @userinfobot');
  console.log('3. Add to .env:\n   TELEGRAM_BOT_TOKEN=your_token\n   TELEGRAM_CHAT_ID=your_chat_id');
  process.exit(1);
}

// Initialize services
const elevenLabs = new ElevenLabsClient(ELEVENLABS_API_KEY);
const telegram = new TelegramBot(TELEGRAM_BOT_TOKEN);
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Track processed conversations in memory
const processedConversations = new Set<string>();
// Start from NOW - only process new conversations from deployment time forward
let lastCheckTimestamp = Math.floor(Date.now() / 1000);

interface EvaluationResult {
  summary: string;
  transcriptionIssues: string[];
  conversation: string;
}

async function evaluateWithLLM(transcript: TranscriptMessage[], metadata: any): Promise<EvaluationResult> {
  const transcriptText = transcript
    .map(m => `${m.role.toUpperCase()}: ${m.message}`)
    .join('\n');

  if (!openai) {
    // Fallback without OpenAI - just return the conversation
    return {
      summary: `Conversation lasted ${Math.floor(metadata.duration / 60)}m ${metadata.duration % 60}s with ${transcript.length} messages.`,
      transcriptionIssues: ['OpenAI not configured - cannot analyze Slovak transcription accuracy'],
      conversation: transcriptText,
    };
  }

  const prompt = `Analyze this phone conversation that was transcribed from Slovak language.

IMPORTANT: Focus ONLY on Slovak language transcription accuracy. The 11Labs speech-to-text may have misinterpreted Slovak words.

Transcript:
${transcriptText}

Your task:
1. Read the conversation and identify if there are any Slovak words that seem incorrectly transcribed or don't make sense in context
2. Provide a brief summary of what was discussed
3. List any suspected transcription errors with Slovak language

Respond in JSON format:
{
  "summary": "Brief 1-2 sentence summary of the conversation",
  "transcriptionIssues": ["List of suspected Slovak transcription errors, or empty array if none found"],
  "conversation": "${transcriptText.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    return JSON.parse(response.choices[0].message.content!);
  } catch (error) {
    console.error('LLM evaluation failed:', error);
    throw error;
  }
}

function formatTelegramMessage(conv: ConversationMetadata, evaluation: EvaluationResult): string {
  const date = new Date(conv.start_time_unix_secs * 1000);
  const duration = `${Math.floor(conv.call_duration_secs / 60)}m ${conv.call_duration_secs % 60}s`;

  let message = `📞 *New Conversation*\n\n`;
  message += `*Agent:* ${conv.agent_name}\n`;
  message += `*Time:* ${date.toLocaleString()}\n`;
  message += `*Duration:* ${duration}\n\n`;

  message += `📝 *Summary*\n${evaluation.summary}\n\n`;

  if (evaluation.transcriptionIssues.length > 0) {
    message += `⚠️ *Slovak Transcription Issues*\n`;
    evaluation.transcriptionIssues.forEach(issue => message += `• ${issue}\n`);
    message += `\n`;
  }

  // Format conversation with better readability - each message on separate line with emoji
  message += `💬 *Conversation*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;

  const lines = evaluation.conversation.split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      if (line.startsWith('USER:')) {
        message += `\n👤 *User:*\n${line.replace('USER:', '').trim()}\n`;
      } else if (line.startsWith('AGENT:')) {
        message += `\n🤖 *Agent:*\n${line.replace('AGENT:', '').trim()}\n`;
      }
    }
  });

  return message;
}

async function sendToTelegram(message: string) {
  try {
    await telegram.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
    console.log('✅ Message sent to Telegram');
  } catch (error) {
    console.error('❌ Failed to send Telegram message:', error);
  }
}

async function checkNewConversations() {
  try {
    const checkTime = new Date(lastCheckTimestamp * 1000).toLocaleString();
    console.log(`\n[${new Date().toLocaleTimeString()}] Checking for new conversations since ${checkTime}...`);

    // Get conversations since last check
    const conversations = await elevenLabs.getAllNewConversations(lastCheckTimestamp);

    // Debug: show status of all conversations
    conversations.forEach(c => {
      const startDate = new Date(c.start_time_unix_secs * 1000).toLocaleTimeString();
      console.log(`  - ${c.conversation_id}: status=${c.status}, direction=${c.direction}, duration=${c.call_duration_secs}s, started=${startDate}, processed=${processedConversations.has(c.conversation_id)}`);
    });

    // Filter to only "done" conversations we haven't processed
    // Skip direction filter since API returns null
    // Duration check will happen after getting full details (metadata more reliable)
    const newCompleted = conversations.filter(
      c => c.status === 'done' &&
           !processedConversations.has(c.conversation_id)
    );

    console.log(`Found ${conversations.length} total, ${newCompleted.length} new completed`);

    for (const conv of newCompleted) {
      try {
        console.log(`\nProcessing: ${conv.conversation_id}`);

        // Get full transcript
        const details = await elevenLabs.getConversationDetails(conv.conversation_id);

        // Check duration from metadata (more reliable than list endpoint)
        const actualDuration = details.metadata?.call_duration_secs || conv.call_duration_secs;
        if (actualDuration < 8) {
          console.log(`  ⏭️  Too short (${actualDuration}s), skipping`);
          processedConversations.add(conv.conversation_id);
          continue;
        }

        if (!details.transcript || details.transcript.length === 0) {
          console.log('  ⚠️  No transcript available, skipping');
          processedConversations.add(conv.conversation_id);
          continue;
        }

        console.log(`  📝 Transcript: ${details.transcript.length} messages, Duration: ${actualDuration}s`);

        // Evaluate
        console.log('  🤖 Evaluating with LLM...');
        const evaluation = await evaluateWithLLM(details.transcript, {
          agent_name: conv.agent_name,
          duration: conv.call_duration_secs,
          call_successful: conv.call_successful,
        });

        console.log(`  ✅ Evaluation complete`);

        // Send to Telegram
        const message = formatTelegramMessage(conv, evaluation);
        await sendToTelegram(message);
        console.log('  📤 Sent to Telegram');

        // Mark as processed
        processedConversations.add(conv.conversation_id);

        // Small delay between processing
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`  ❌ Failed to process ${conv.conversation_id}:`, error);
        // Still mark as processed to avoid retrying failed conversations
        processedConversations.add(conv.conversation_id);
      }
    }

    // Update last check timestamp
    lastCheckTimestamp = Math.floor(Date.now() / 1000);

  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Start the bot
async function start() {
  console.log('🤖 11Labs → Telegram Evaluator\n');
  console.log('Configuration:');
  console.log(`  • 11Labs API: Connected`);
  console.log(`  • Telegram Bot: ${TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
  console.log(`  • Chat ID: ${TELEGRAM_CHAT_ID}`);
  console.log(`  • LLM: ${openai ? 'OpenAI GPT-4' : 'Simple (add OPENAI_API_KEY for AI evaluation)'}`);
  console.log(`  • Poll Interval: ${POLL_INTERVAL_MS / 1000}s\n`);

  // Send startup message
  await sendToTelegram('🚀 *11Labs Evaluator Started*\n\nMonitoring conversations...');

  // Initial check
  await checkNewConversations();

  // Set up polling
  setInterval(checkNewConversations, POLL_INTERVAL_MS);

  console.log('\n✨ Bot running! Press Ctrl+C to stop.\n');
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down...');
  await sendToTelegram('⏸️ *11Labs Evaluator Stopped*');
  process.exit(0);
});

start();
