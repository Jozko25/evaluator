import dotenv from 'dotenv';
import { ElevenLabsClient } from './src/elevenlabs-client';

dotenv.config();

const client = new ElevenLabsClient(process.env.ELEVENLABS_API_KEY!);

async function test() {
  console.log('Fetching all conversations from the last 2 hours...\n');

  const twoHoursAgo = Math.floor(Date.now() / 1000) - (2 * 60 * 60);
  const convs = await client.getAllNewConversations(twoHoursAgo);

  console.log(`Found ${convs.length} conversations:\n`);

  for (const conv of convs) {
    const date = new Date(conv.start_time_unix_secs * 1000);
    console.log(`ID: ${conv.conversation_id}`);
    console.log(`  Status: ${conv.status}`);
    console.log(`  Direction: ${conv.direction}`);
    console.log(`  Duration: ${conv.call_duration_secs}s`);
    console.log(`  Messages: ${conv.message_count}`);
    console.log(`  Started: ${date.toLocaleString()}`);
    console.log('');

    // Try to get details for done conversations
    if (conv.status === 'done') {
      try {
        const details = await client.getConversationDetails(conv.conversation_id);
        console.log(`  Details - Duration: ${details.metadata.call_duration_secs}s`);
        console.log(`  Details - Transcript messages: ${details.transcript?.length || 0}`);
        console.log('');
      } catch (e) {
        console.log(`  Failed to get details: ${e}`);
      }
    }
  }
}

test();
