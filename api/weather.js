/**
 * weather.js — Vercel serverless function: POST /api/weather
 *
 * Proxies the OpenWeatherMap 5-day forecast API for a given coordinate pair.
 * The frontend calls this to display weather conditions for each day of the
 * trip itinerary.
 *
 * WHY THIS IS A SERVER-SIDE PROXY:
 * The OpenWeatherMap API key must not be exposed in client-side JavaScript
 * where it could be scraped. This function keeps it on the server and forwards
 * only the API response to the browser.
 *
 * The raw OpenWeatherMap response is passed through as-is — the frontend is
 * responsible for picking the relevant fields (temperature, description, icon).
 * The forecast endpoint returns data in 3-hour intervals for the next 5 days,
 * so the frontend typically groups by day and picks a representative slot.
 *
 * Environment variables required:
 *   OPENWEATHER_API_KEY — API key from openweathermap.org (free tier is fine)
 *
 * Request body (JSON):
 *   lat  {number}  — latitude of the destination
 *   lon  {number}  — longitude of the destination
 *
 * Response (JSON):
 *   200  OpenWeatherMap forecast object (passed through directly)
 *   400  { error: string }  — lat or lon missing from the request
 *   405  { error: string }  — wrong HTTP method (must be POST)
 *   500  { error: string }  — fetch to OpenWeatherMap failed
 *
 * OpenWeatherMap forecast docs:
 *   https://openweathermap.org/forecast5
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { lat, lon } = req.body;

    // Both coordinates are required — OpenWeatherMap will reject the request
    // without them, so we validate early to return a clearer error message.
    if (!lat || !lon) {
        return res.status(400).json({ error: 'Missing coordinates' });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;

    // 5-day / 3-hour forecast endpoint.
    // `units=imperial` returns temperatures in °F and wind speed in mph.
    // Change to `units=metric` for °C if you ever add a unit toggle.
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Pass the full OpenWeatherMap response to the client unchanged.
        // The frontend parses `data.list` (array of 3-hour slots) and
        // `data.city` (city name, country, timezone offset).
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Weather fetch failed' });
    }
}
