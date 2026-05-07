/**
 * places-search.js — Vercel serverless function: POST /api/places-search
 *
 * Proxies the Google Maps Nearby Search API and caches results in Redis.
 * The frontend calls this when the user searches for venues (restaurants,
 * hotels, attractions, etc.) near a map location.
 *
 * WHY THIS IS A SERVER-SIDE PROXY:
 * The Google Maps API key must never be exposed to the browser, as it could
 * be scraped and used to rack up charges on your account. This function keeps
 * the key server-side and forwards only the results to the client.
 *
 * CACHING STRATEGY:
 * Google's Nearby Search costs ~$0.032 per call. Under a traffic spike (e.g.
 * a Reddit post), many users will search the same popular cities. Results are
 * cached in Redis for 6 hours keyed by (lat, lng, radius, type, maxPrice,
 * minRating). Coordinates are rounded to 3 decimal places (~110m grid) so
 * that searches within the same block share a single cache entry.
 *
 * Environment variables required:
 *   GOOGLE_MAPS_API_KEY — Google Cloud API key with Places API enabled
 *   REDIS_URL           — Redis connection string (for caching)
 *
 * Request body (JSON):
 *   lat       {number}  — latitude of the search center
 *   lng       {number}  — longitude of the search center
 *   radius    {number}  — search radius in meters (max 50,000)
 *   type      {string}  — Google place type, e.g. "restaurant", "lodging"
 *   maxPrice  {number}  — (optional) 0–4 price level filter
 *   minRating {number}  — (optional) minimum star rating, e.g. 4.0
 *
 * Response (JSON):
 *   200  { places: Place[], cached?: true }  — up to 10 matching venues
 *   405  { error: string }                   — wrong HTTP method
 *   500  { error: string }                   — API or Redis error
 *
 * Place shape:
 *   { name, address, lat, lng, placeId, rating, priceLevel, types }
 */

import { getRedis } from './_redis.js';

// How long to keep a cached search result. 6 hours balances freshness (venues
// don't change often) against cost savings during traffic spikes.
const CACHE_TTL = 60 * 60 * 6; // 6 hours in seconds

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { lat, lng, radius, type, maxPrice, minRating } = req.body;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // Build a deterministic cache key from all search parameters.
    // Coordinates are rounded to 3 decimal places (~110m precision) so that
    // two users searching from slightly different GPS positions within the same
    // city block get the same cached results instead of two separate API calls.
    // Optional params use empty string when absent so the key stays stable.
    const cacheKey = `places:${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}:${radius}:${type}:${maxPrice ?? ''}:${minRating ?? ''}`;

    try {
        const client = await getRedis();

        // --- Cache check ---
        // If a previous request already fetched and stored these results,
        // return them immediately without touching the Google Maps API.
        const cached = await client.get(cacheKey);
        if (cached) {
            // `cached: true` is included so you can verify in DevTools that
            // the cache is working during testing.
            return res.status(200).json({ places: JSON.parse(cached), cached: true });
        }

        // --- Google Maps Nearby Search API call ---
        // Docs: https://developers.google.com/maps/documentation/places/web-service/search-nearby
        let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;

        // maxprice is only added when provided (0 = free, 4 = very expensive).
        // Omitting it returns all price levels.
        if (maxPrice !== undefined) url += `&maxprice=${maxPrice}`;

        const response = await fetch(url);
        const data = await response.json();

        // --- Filter, sort, and shape the results ---
        const filtered = (data.results || [])
            // Drop venues below the minimum rating if one was requested.
            // Venues with no rating (null) are also excluded when minRating is set.
            .filter(p => !minRating || (p.rating && p.rating >= minRating))

            // Sort highest-rated venues first so the best options appear at the top.
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))

            // Cap at 10 results — enough choices without overwhelming the user.
            .slice(0, 10)

            // Map to a minimal shape: only the fields the frontend actually uses.
            // This reduces the size of both the Redis cache entry and the HTTP response.
            .map(p => ({
                name: p.name,
                address: p.vicinity,
                lat: p.geometry.location.lat,
                lng: p.geometry.location.lng,
                placeId: p.place_id,          // used to build Google Maps deep links
                rating: p.rating || null,
                priceLevel: p.price_level || null,
                types: p.types || []           // e.g. ["restaurant", "food", "point_of_interest"]
            }));

        // --- Store in cache ---
        // Save the filtered results so the next identical (or nearby) search
        // is served from Redis rather than calling Google Maps again.
        await client.set(cacheKey, JSON.stringify(filtered), { EX: CACHE_TTL });

        res.status(200).json({ places: filtered });
    } catch (error) {
        res.status(500).json({ error: 'Places search failed' });
    }
}
