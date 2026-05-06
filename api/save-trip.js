import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL
});

client.on('error', err => console.log('Redis Client Error', err));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tripData, tripId: existingId } = req.body;

  if (!tripData) {
    return res.status(400).json({ error: 'Missing trip data' });
  }

  const tripId = existingId || Math.random().toString(36).substring(2, 8);

  try {
    if (!client.isOpen) await client.connect();
    await client.set(`trip:${tripId}`, JSON.stringify(tripData), {
      EX: 7776000 // 90 days
    });

    res.status(200).json({ tripId });
  } catch (error) {
    console.error('Save failed:', error);
    res.status(500).json({ error: 'Save failed' });
  }
}