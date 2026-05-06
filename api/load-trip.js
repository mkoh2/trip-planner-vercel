import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing trip ID' });
  }

  try {
    const tripDataString = await kv.get(`trip:${id}`);
    
    if (!tripDataString) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const tripData = JSON.parse(tripDataString);
    res.status(200).json({ tripData });
  } catch (error) {
    console.error('Load failed:', error);
    res.status(500).json({ error: 'Load failed' });
  }
}