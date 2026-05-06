import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tripData } = req.body;

  if (!tripData) {
    return res.status(400).json({ error: 'Missing trip data' });
  }

  // Generate unique ID (6 characters)
  const tripId = Math.random().toString(36).substring(2, 8);

  try {
    // Store trip in KV with 90-day expiration (7776000 seconds)
    await kv.set(`trip:${tripId}`, JSON.stringify(tripData), { ex: 7776000 });
    res.status(200).json({ tripId });
  } catch (error) {
    console.error('Save failed:', error);
    res.status(500).json({ error: 'Save failed' });
  }
}