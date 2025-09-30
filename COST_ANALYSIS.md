# Cost Analysis for 24/7 Operation

## Railway Hobby Plan Cost

**Railway Hobby Plan: $5/month**
- Includes $5 credit
- Additional usage: $0.000231/GB-hour RAM + $0.000463/vCPU-hour

**Your App Usage Estimate:**
- RAM: ~100MB (Node.js + dependencies)
- CPU: Minimal (only active during polling/evaluation)
- **Estimated Railway cost: ~$0.50-1.00/month** (well within $5 credit)

✅ **Railway is cost-effective for this use case**

---

## OpenAI API Cost

**GPT-4 Turbo Pricing:**
- Input: $10 per 1M tokens
- Output: $30 per 1M tokens

**Per Conversation Estimate:**
- Average conversation: ~500 words = ~650 input tokens
- AI response: ~150 output tokens
- **Cost per conversation: ~$0.012** (1.2 cents)

**Monthly Cost Scenarios:**

| Conversations/Day | Conversations/Month | OpenAI Cost/Month |
|-------------------|---------------------|-------------------|
| 10 | 300 | **$3.60** |
| 25 | 750 | **$9.00** |
| 50 | 1,500 | **$18.00** |
| 100 | 3,000 | **$36.00** |

---

## Total Monthly Cost

| Conversations/Day | Railway | OpenAI | **Total** |
|-------------------|---------|--------|-----------|
| 10 | $0.50 | $3.60 | **$4.10** |
| 25 | $0.50 | $9.00 | **$9.50** |
| 50 | $0.50 | $18.00 | **$18.50** |
| 100 | $0.50 | $36.00 | **$36.50** |

**Railway Hobby Plan ($5/month) covers hosting completely.**

The main cost is OpenAI API based on conversation volume.

---

## Cost Optimization Options

If you want to reduce costs:

### 1. Use GPT-3.5 Turbo (85% cheaper)
- Change model to `gpt-3.5-turbo`
- Cost: ~$0.002 per conversation
- 750 conversations/month = **$1.50**

Edit `src/telegram-simple.ts:80`:
```typescript
model: 'gpt-3.5-turbo',  // instead of gpt-4-turbo-preview
```

### 2. Use GPT-4o-mini (90% cheaper)
- Change model to `gpt-4o-mini`
- Cost: ~$0.001 per conversation
- 750 conversations/month = **$0.75**

### 3. Increase Poll Interval
Current: 60 seconds
Change to: 120 seconds (2 minutes)

Edit `.env`:
```
POLL_INTERVAL_MS=120000
```

This reduces Railway CPU usage slightly.

---

## Recommendations

✅ **Keep current setup if:**
- Less than 50 conversations/day (~$18/month total)
- Need best Slovak language understanding
- Want highest accuracy

💡 **Switch to GPT-4o-mini if:**
- Budget is tight
- Volume is high (>50/day)
- Still need good Slovak support

**Estimated savings:** Up to 90% on OpenAI costs

---

## Railway Deployment Steps

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Add environment variables:
   ```
   ELEVENLABS_API_KEY=your_elevenlabs_key
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_telegram_chat_id
   OPENAI_API_KEY=your_openai_key
   POLL_INTERVAL_MS=60000
   ```
6. Deploy!

Railway will auto-detect Node.js and use `npm run telegram`.

---

## Monitoring Costs

**OpenAI Dashboard:**
- https://platform.openai.com/usage
- Check daily spending

**Railway Dashboard:**
- https://railway.app/project/your-project/metrics
- Monitor RAM/CPU usage

Set up billing alerts on both platforms.
