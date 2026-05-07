/**
 * _redis.js — Shared Redis client singleton
 *
 * All API routes import `getRedis()` from here instead of creating their own
 * clients. This is important in a Vercel serverless environment: each deployed
 * function is its own isolated Node.js process, but within a single warm
 * instance multiple invocations reuse the same module scope. By keeping one
 * client per instance we avoid opening a new TCP connection on every request,
 * which would quickly exhaust the connection limit on free/hobby Redis tiers.
 *
 * If you ever hit connection-limit errors under heavy traffic, the fix is to
 * switch REDIS_URL to an Upstash Redis instance. Upstash uses HTTP rather than
 * persistent TCP, so there is no connection cap. No code changes are needed —
 * just swap the environment variable.
 *
 * Environment variables required:
 *   REDIS_URL — full connection string, e.g. redis://:<password>@<host>:<port>
 */

import { createClient } from 'redis';

// Module-level singleton. Undefined on first load; assigned once on first call
// to getRedis(). Subsequent calls within the same warm instance reuse it.
let client;

/**
 * Returns a connected Redis client, creating and connecting it on first call.
 *
 * The function is intentionally lazy: it does nothing until the first API
 * request actually needs Redis. This keeps cold-start time low for routes
 * that might not reach the Redis code path (e.g. early validation failures).
 *
 * @returns {Promise<import('redis').RedisClientType>} An open Redis client
 */
export async function getRedis() {
    // Create the client only once. On subsequent calls within the same warm
    // function instance, `client` is already defined and we skip straight to
    // the connection check below.
    if (!client) {
        client = createClient({ url: process.env.REDIS_URL });

        // Log connection errors to Vercel's function logs without crashing the
        // process. The 'error' event fires for things like network blips; the
        // actual command call will throw separately and be caught in each handler.
        client.on('error', err => console.error('Redis error:', err));
    }

    // If the instance was reused but the connection dropped (e.g. Redis
    // restarted, idle timeout), reconnect before returning.
    if (!client.isOpen) await client.connect();

    return client;
}
