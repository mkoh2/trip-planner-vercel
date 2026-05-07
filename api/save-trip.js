/**
 * save-trip.js — Vercel serverless function: POST /api/save-trip
 *
 * Persists a trip itinerary to Redis so it can be retrieved later via a
 * short shareable ID. Called in two scenarios:
 *
 *   1. First save — no `tripId` in the request body. A new random ID is
 *      generated and returned to the client, which stores it in the URL.
 *
 *   2. Update — the client sends back the existing `tripId`. The same key
 *      is overwritten in Redis and the TTL is reset to another 90 days.
 *
 * Redis key format:  trip:<tripId>   (e.g. "trip:k7x2mq")
 * TTL:               90 days (7,776,000 seconds)
 *
 * Request body (JSON):
 *   tripData  {object}  — the full itinerary object from the frontend
 *   tripId    {string}  — (optional) existing ID to overwrite
 *
 * Response (JSON):
 *   200  { tripId: string }   — ID to embed in the shareable URL
 *   400  { error: string }    — tripData was missing from the request
 *   405  { error: string }    — wrong HTTP method (must be POST)
 *   500  { error: string }    — Redis write failed
 */

import { getRedis } from './_redis.js';

export default async function handler(req, res) {
    // This endpoint only accepts POST. Return 405 for any other method so
    // browsers and crawlers don't accidentally trigger a save via GET.
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Destructure the two expected fields from the JSON body.
    // `existingId` is undefined when the user is saving for the first time.
    const { tripData, tripId: existingId } = req.body;

    // tripData is the entire itinerary object. Without it there's nothing to save.
    if (!tripData) {
        return res.status(400).json({ error: 'Missing trip data' });
    }

    // Reuse the existing ID on updates, or generate a new 6-character base-36
    // string (e.g. "k7x2mq") for first-time saves. 6 chars gives ~2 billion
    // possible IDs, which is more than enough for this scale.
    const tripId = existingId || Math.random().toString(36).substring(2, 8);

    try {
        const client = await getRedis();

        // Store the trip as a JSON string under the key "trip:<tripId>".
        // EX sets the expiry in seconds — 7,776,000 s = 90 days. Each update
        // resets the TTL so active trips don't expire while in use.
        await client.set(`trip:${tripId}`, JSON.stringify(tripData), {
            EX: 7776000 // 90 days
        });

        // Return the ID so the frontend can build the shareable URL, e.g.:
        // https://yourapp.vercel.app/?trip=k7x2mq
        res.status(200).json({ tripId });
    } catch (error) {
        console.error('Save failed:', error);
        res.status(500).json({ error: 'Save failed' });
    }
}
