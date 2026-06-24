// netlify/functions/history.js
//
// Shared ceremony history, stored in Netlify Blobs.
// One shared list, visible to everyone using the app (matches the
// shared-password model - there's no per-user separation).
//
// Endpoints (all via the same function, routed by HTTP method):
//   GET    /api/history        -> returns the full history array
//   POST   /api/history        -> body: { state: {...} } - adds a new entry
//   DELETE /api/history?id=xxx -> removes one entry by id

import { getStore } from "@netlify/blobs";

const STORE_NAME = "eka-history";
const BLOB_KEY = "history";
const MAX_HISTORY = 50;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const store = getStore(STORE_NAME);

  try {
    if (req.method === "GET") {
      const existing = await store.get(BLOB_KEY, { type: "json" });
      return json({ history: existing || [] });
    }

    if (req.method === "POST") {
      const body = await req.json();
      if (!body || typeof body.state !== "object") {
        return json({ error: "Missing 'state' in request body" }, 400);
      }

      const existing = (await store.get(BLOB_KEY, { type: "json" })) || [];
      const id = "h_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const entry = { id, timestamp: new Date().toISOString(), state: body.state };

      const updated = [entry, ...existing].slice(0, MAX_HISTORY);
      await store.setJSON(BLOB_KEY, updated);

      return json({ history: updated, savedId: id });
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) {
        return json({ error: "Missing 'id' query parameter" }, 400);
      }

      const existing = (await store.get(BLOB_KEY, { type: "json" })) || [];
      const updated = existing.filter((h) => h.id !== id);
      await store.setJSON(BLOB_KEY, updated);

      return json({ history: updated });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
};

export const config = {
  path: "/api/history",
};
