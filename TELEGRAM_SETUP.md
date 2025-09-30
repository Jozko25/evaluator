# Telegram Bot Setup (Simple - No Database)

This is a **simpler alternative** that sends conversation evaluations directly to Telegram without needing a database or web interface.

## How It Works

```
11Labs API → Fetch Conversations → LLM Evaluation → Telegram Message
```

Every 60 seconds, it:
1. Checks for new completed conversations
2. Fetches transcript
3. Evaluates with LLM (or simple scoring) 
4. Sends formatted message to your Telegram

## Setup Steps

### 1. Create Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow instructions to name your bot
4. Copy the **token** (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Get Your Chat ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. Copy your **Chat ID** (looks like: `123456789`)

### 3. Configure .env

Edit `.env` and add:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Optional: Add for AI evaluation (otherwise uses simple scoring)
OPENAI_API_KEY=sk-your-key-here
```

### 4. Run

```bash
npm run telegram
```

You'll see:
```
🤖 11Labs → Telegram Evaluator

Configuration:
  • 11Labs API: Connected
  • Telegram Bot: 1234567890...
  • Chat ID: 123456789
  • LLM: OpenAI GPT-4
  • Poll Interval: 60s

✨ Bot running! Press Ctrl+C to stop.
```

## Message Format

You'll receive messages like:

```
🟢 New Conversation Evaluated

Score: 85/100 😊
Agent: Support Agent
Time: 1/15/2025, 3:30 PM
Duration: 5m 23s
Messages: 12
Result: success

📝 Summary
Customer inquiry about product features was handled
professionally with clear explanations provided.

✅ Strengths
• Quick response time
• Clear and concise answers
• Professional tone maintained
• Problem resolved successfully

🔧 Improvements
• Could have offered additional resources
• Follow-up confirmation would be helpful

📊 Performance
• Responsiveness: 9/10
• Accuracy: 8/10
• Helpfulness: 9/10

🏷️ Topics: product inquiry, features, support
```

## Comparison: Database vs Telegram-Only

### With Database + Web Interface (`npm start`)
✅ History of all conversations
✅ Web dashboard for browsing
✅ Statistics and trends
❌ More complex setup
❌ Need to open browser

### Telegram-Only (`npm run telegram`)
✅ Super simple - no database
✅ Instant notifications on phone
✅ Lightweight and fast
❌ No historical search (unless you scroll Telegram)
❌ No web dashboard

## Which Should You Use?

**Use Telegram-Only if:**
- You just want instant notifications
- Don't need to browse history
- Want simplest possible setup

**Use Database + Web if:**
- Need to analyze trends
- Want to browse past conversations
- Multiple people need access
- Want detailed reporting

## Adding OpenAI Evaluation

Without OpenAI, it uses simple scoring. To get **AI-powered insights**:

1. Get API key from [platform.openai.com](https://platform.openai.com)
2. Add to `.env`:
   ```env
   OPENAI_API_KEY=sk-proj-...
   ```
3. Restart: `npm run telegram`

The AI will analyze:
- Tone and professionalism
- Problem resolution quality
- Customer satisfaction signals
- Specific strengths/improvements
- Key topics discussed

## Cost Estimate

**OpenAI GPT-4 Turbo:**
- ~$0.01-0.03 per conversation evaluation
- 100 conversations/day = ~$1-3/day

**To reduce costs:**
- Use GPT-3.5-turbo instead (change in `telegram-simple.ts:103`)
- Increase `POLL_INTERVAL_MS` (check less frequently)
- Only evaluate low-scoring conversations

## Troubleshooting

**Bot doesn't respond:**
- Make sure you got the token from @BotFather
- Verify chat ID from @userinfobot
- Check bot hasn't been blocked

**No messages received:**
- Wait 60 seconds for first check
- Ensure you have conversations in 11Labs
- Check console for errors

**OpenAI errors:**
- Verify API key is correct
- Check you have credits
- Make sure key has GPT-4 access

## Run on Server (24/7)

Deploy to keep it running:

**Railway.app (Free tier):**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

Add environment variables in Railway dashboard.

**Or use any VPS:**
```bash
# Install PM2
npm i -g pm2

# Start
pm2 start "npm run telegram" --name elevenlabs-bot

# Auto-restart on reboot
pm2 startup
pm2 save
```

## Next Steps

- Set up server deployment for 24/7 operation
- Add filters (only notify on low scores, specific agents)
- Forward to multiple chats/channels
- Add commands to query specific conversations
