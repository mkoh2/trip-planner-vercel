export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { origins, destinations, mode } = req.body;

  if (!origins || !destinations || !mode) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  const params = new URLSearchParams({
    origins,
    destinations,
    mode,
    units: 'imperial',
    key: apiKey
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Distance calculation failed' });
  }
}