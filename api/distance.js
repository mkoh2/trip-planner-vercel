/**
 * distance.js — Vercel serverless function: POST /api/distance
 *
 * Proxies the Google Maps Distance Matrix API to calculate travel time and
 * distance between venue stops on the itinerary. The frontend calls this when
 * the user adds or reorders venues so it can display "20 min drive" or
 * "1.2 miles" between consecutive stops.
 *
 * WHY THIS IS A SERVER-SIDE PROXY:
 * The Google Maps API key must not be exposed in client-side JavaScript.
 * This function keeps it server-side and forwards the Distance Matrix response
 * to the browser.
 *
 * The Distance Matrix API accepts multiple origins and destinations in one
 * call, returning an N×M grid of travel data. The frontend typically calls it
 * with a single origin and destination (1×1 matrix) for each adjacent pair
 * of stops, but the API supports batching if needed.
 *
 * Environment variables required:
 *   GOOGLE_MAPS_API_KEY — Google Cloud API key with Distance Matrix API enabled
 *
 * Request body (JSON):
 *   origins       {string}  — pipe-separated addresses or "lat,lng" pairs
 *                             e.g. "48.8584,2.2945" or "Eiffel Tower, Paris"
 *   destinations  {string}  — pipe-separated addresses or "lat,lng" pairs
 *   mode          {string}  — travel mode: "driving", "walking", "bicycling",
 *                             or "transit"
 *
 * Response (JSON):
 *   200  Google Distance Matrix response object (passed through directly)
 *        Key fields: rows[0].elements[0].distance.text  (e.g. "1.2 mi")
 *                    rows[0].elements[0].duration.text  (e.g. "4 mins")
 *                    rows[0].elements[0].status         ("OK" or "ZERO_RESULTS")
 *   400  { error: string }  — one or more required parameters are missing
 *   405  { error: string }  — wrong HTTP method (must be POST)
 *   500  { error: string }  — fetch to Google Maps failed
 *
 * Distance Matrix API docs:
 *   https://developers.google.com/maps/documentation/distance-matrix/overview
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { origins, destinations, mode } = req.body;

    // All three parameters are required by the Google Distance Matrix API.
    if (!origins || !destinations || !mode) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // URLSearchParams handles encoding of special characters in addresses
    // (spaces, commas, etc.) so the URL is always valid.
    const params = new URLSearchParams({
        origins,
        destinations,
        mode,
        units: 'imperial', // returns distances in miles; change to "metric" for km
        key: apiKey
    });

    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`
        );
        const data = await response.json();

        // Pass the full Google response through. The frontend reads:
        //   data.rows[0].elements[0].duration.text  → travel time string
        //   data.rows[0].elements[0].distance.text  → distance string
        //   data.rows[0].elements[0].status         → "OK" if a route was found
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Distance calculation failed' });
    }
}
