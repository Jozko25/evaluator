# 11Labs Conversation Evaluator

Automated conversation monitoring and evaluation system for 11Labs conversations with mobile-optimized interface.

## Features

- 🔄 **Auto-sync**: Polls 11Labs API every 30 seconds for new conversations
- 🤖 **AI Evaluation**: Automatically evaluates each conversation (LLM placeholder ready)
- 📱 **Mobile-first**: Progressive Web App optimized for iPhone
- 📊 **Analytics**: Real-time statistics and performance metrics
- 💾 **Local Storage**: SQLite database for conversation history

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│  11Labs API │─────▶│   Fetcher    │─────▶│   Database   │
└─────────────┘      └──────────────┘      └──────────────┘
                                                    │
                                                    ▼
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   iPhone    │◀─────│   REST API   │◀─────│  Evaluator   │
└─────────────┘      └──────────────┘      └──────────────┘
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Edit `.env` and add your API keys:
```
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
OPENAI_API_KEY=your_openai_api_key
POLL_INTERVAL_MS=60000
PORT=3000
```

### 3. Run the Application
```bash
npm start
```

The server will start at `http://localhost:3000`

### 4. Access on iPhone

**Option A: Local Network (Same WiFi)**
1. Find your computer's IP address:
   - Mac: System Settings → Network → Your IP
   - Example: `192.168.1.100`
2. Open Safari on iPhone: `http://192.168.1.100:3000`
3. Tap Share → Add to Home Screen (for app-like experience)

**Option B: Expose with ngrok (Internet Access)**
```bash
# Install ngrok: https://ngrok.com
npx ngrok http 3000
# Use the https URL provided on your iPhone
```

## Next Steps

### 🎯 Add Real LLM Evaluation

Replace the placeholder evaluator with actual LLM integration:

**OpenAI Example:**
```bash
npm install openai
```

Create `src/openai-evaluator.ts`:
```typescript
import OpenAI from 'openai';
import { LLMEvaluator, EvaluationResult } from './evaluator';
import { TranscriptMessage } from './elevenlabs-client';

export class OpenAIEvaluator extends LLMEvaluator {
  private client: OpenAI;

  constructor(apiKey: string) {
    super();
    this.client = new OpenAI({ apiKey });
  }

  async evaluate(transcript: TranscriptMessage[], metadata?: any): Promise<EvaluationResult> {
    const prompt = `Evaluate this conversation transcript and provide:
1. Overall score (0-100)
2. Summary
3. Strengths (3-5 points)
4. Improvements (3-5 points)
5. Sentiment (positive/neutral/negative)
6. Key topics discussed
7. Agent performance ratings (responsiveness, accuracy, helpfulness out of 10)

Transcript:
${transcript.map(m => `${m.role.toUpperCase()}: ${m.message}`).join('\n')}

Respond in JSON format matching the EvaluationResult interface.`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content!);
  }
}
```

Update `.env`:
```
OPENAI_API_KEY=your_key_here
```

Update `src/index.ts`:
```typescript
import { OpenAIEvaluator } from './openai-evaluator';

const evaluator = new OpenAIEvaluator(process.env.OPENAI_API_KEY!);
```

### 📲 Push Notifications

**Option 1: Web Push (Safari iOS 16.4+)**
- Implement service worker
- Request notification permissions
- Send alerts when new evaluations complete

**Option 2: Telegram Bot**
```bash
npm install node-telegram-bot-api
```
- Create bot via @BotFather
- Send evaluation summaries to your Telegram

**Option 3: Email Alerts**
```bash
npm install nodemailer
```
- Configure SMTP
- Email digest of low-scoring conversations

### 🔐 Production Deployment

**Recommended: Railway / Render / Fly.io**

1. Push to GitHub
2. Connect to Railway/Render
3. Set environment variables
4. Deploy!

## API Endpoints

- `GET /api/conversations` - List all conversations with evaluations
- `GET /api/conversations/:id` - Get single conversation details
- `GET /api/stats` - Get system statistics

## File Structure

```
evalutator/
├── src/
│   ├── index.ts              # Main entry point
│   ├── elevenlabs-client.ts  # 11Labs API wrapper
│   ├── database.ts           # SQLite database layer
│   ├── conversation-fetcher.ts # Polling service
│   ├── evaluator.ts          # Evaluation engine
│   └── api.ts                # REST API server
├── public/
│   └── index.html            # Mobile web interface
├── .env                      # Configuration
└── conversations.db          # SQLite database (auto-created)
```

## Development

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Troubleshooting

**No conversations appearing?**
- Verify API key is correct
- Check console logs for errors
- Ensure you have conversations in your 11Labs account

**Can't access from iPhone?**
- Both devices must be on same WiFi
- Check firewall settings
- Try ngrok for external access

**Database issues?**
- Delete `conversations.db` to reset
- Check file permissions

## License

MIT
