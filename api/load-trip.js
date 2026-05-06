import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL
});

client.on('error', err => console.log('Redis Client Error', err));

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing trip ID' });
  }

  try {
    await client.connect();
    const tripDataString = await client.get(`trip:${id}`);
    await client.disconnect();
    
    if (!tripDataString) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const tripData = JSON.parse(tripDataString);
    res.status(200).json({ tripData });
  } catch (error) {
    console.error('Load failed:', error);
    await client.disconnect();
    res.status(500).json({ error: 'Load failed' });
  }
}