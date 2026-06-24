const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYNC_ID_PATTERN = /^\/sync\/([a-f0-9]{64})$/;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(SYNC_ID_PATTERN);

    if (!match) {
      return json({ error: 'Not Found' }, 404);
    }

    const syncId = match[1];

    if (request.method === 'GET') {
      const data = await env.DRAMA_SYNC.get(syncId, 'json');
      if (!data) return json(null, 404);
      return json(data);
    }

    if (request.method === 'PUT') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      if (!body.encrypted_data || typeof body.updated_at !== 'number') {
        return json({ error: 'Missing fields' }, 400);
      }

      const existing = await env.DRAMA_SYNC.get(syncId, 'json');
      if (existing && body.updated_at < existing.updated_at) {
        return json(existing, 409);
      }

      const record = {
        encrypted_data: body.encrypted_data,
        updated_at: body.updated_at,
      };
      await env.DRAMA_SYNC.put(syncId, JSON.stringify(record));
      return json({ ok: true });
    }

    return json({ error: 'Method Not Allowed' }, 405);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
