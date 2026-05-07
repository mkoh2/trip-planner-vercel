/**
 * load-trip.js — Vercel serverless function: GET /api/load-trip?id=<tripId>
 *
 * Retrieves a previously saved trip itinerary from Redis by its short ID.
 * The frontend calls this on page load when a `?trip=<id>` query parameter is
 * present in the URL, allowing users to share and reopen saved itineraries.
 *
 * Redis key format:  trip:<id>   (e.g. "trip:k7x2mq")
 *
 * Query parameters:
 *   id  {string}  — the short trip ID returned by /api/save-trip
 *
 * Response (JSON):
 *   200  { tripData: object }  — the full itinerary object
 *   400  { error: string }     — `id` query param was missing
 *   404  { error: string }     — no trip found for this ID (never saved, or expired)
 *   405  { error: string }     — wrong HTTP method (must be GET)
 *   500  { error: string }     — Redis read failed
 */

import { getRedis } from './_redis.js';

export default async function handler(req, res) {
    // This endpoint only accepts GET requests. POST/PUT/DELETE return 405.
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // The trip ID comes from the URL query string: /api/load-trip?id=k7x2mq
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Missing trip ID' });
    }

    try {
        const client = await getRedis();

        // Look up the serialized trip JSON stored under "trip:<id>".
        // Returns null if the key doesn't exist or has expired (90-day TTL).
        const tripDataString = await client.get(`trip:${id}`);

        // A null result means the ID was never saved or the trip has expired.
        if (!tripDataString) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        // Parse the JSON string back into an object before sending to the client.
        const tripData = JSON.parse(tripDataString);
        res.status(200).json({ tripData });
    } catch (error) {
        console.error('Load failed:', error);
        res.status(500).json({ error: 'Load failed' });
    }
}
