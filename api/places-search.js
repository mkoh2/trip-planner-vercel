export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { lat, lng, radius, type, maxPrice, minRating } = req.body;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    try {
        let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;

        if (maxPrice !== undefined) url += `&maxprice=${maxPrice}`;

        const response = await fetch(url);
        const data = await response.json();

        const filtered = (data.results || [])
            .filter(p => !minRating || (p.rating && p.rating >= minRating))
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 5)
            .map(p => ({
                name: p.name,
                address: p.vicinity,
                lat: p.geometry.location.lat,
                lng: p.geometry.location.lng,
                placeId: p.place_id,
                rating: p.rating || null,
                priceLevel: p.price_level || null,
                types: p.types || []
            }));

        res.status(200).json({ places: filtered });
    } catch (error) {
        res.status(500).json({ error: 'Places search failed' });
    }
}