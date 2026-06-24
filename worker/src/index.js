const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYNC_ID_PATTERN = /^\/sync\/([a-f0-9]{64})$/;
const BGM_UA = 'DramaTrack/1.0 (https://github.com/xuswang/drama-track)';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/search' && request.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (q.length < 2) return json({ results: [] });
      const results = await searchMedia(q);
      return json({ results });
    }

    const match = url.pathname.match(SYNC_ID_PATTERN);
    if (!match) return json({ error: 'Not Found' }, 404);

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

async function searchMedia(keyword) {
  const [bgm, anilist] = await Promise.all([
    searchBangumi(keyword),
    searchAnilist(keyword),
  ]);
  return dedupeResults([...bgm, ...anilist]).slice(0, 10);
}

async function searchBangumi(keyword) {
  try {
    const searchUrl = `https://api.bgm.tv/search/subject/${encodeURIComponent(keyword)}?type=2&max_results=8`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': BGM_UA },
      signal: AbortSignal.timeout(12000),
    });
    if (!searchRes.ok) return [];

    const searchData = await searchRes.json();
    const list = (searchData.list || []).slice(0, 6);

    const details = await Promise.all(
      list.map(async (item) => {
        try {
          const res = await fetch(`https://api.bgm.tv/v0/subjects/${item.id}`, {
            headers: { 'User-Agent': BGM_UA },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return null;
          const sub = await res.json();
          const title = sub.name_cn || sub.name || item.name_cn || item.name;
          const eps = sub.eps ?? sub.total_episodes ?? null;
          return {
            id: `bgm:${sub.id}`,
            source: 'bangumi',
            title,
            totalEpisodes: eps > 0 ? eps : null,
            airing: !eps || eps === 0,
            sourceLabel: 'Bangumi',
          };
        } catch {
          return null;
        }
      }),
    );

    return details.filter(Boolean);
  } catch {
    return [];
  }
}

async function searchAnilist(keyword) {
  try {
    const query = `
      query ($search: String) {
        Page(page: 1, perPage: 8) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            title { native romaji english }
            episodes
            status
          }
        }
      }
    `;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { search: keyword } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const media = data?.data?.Page?.media || [];

    return media.map((m) => {
      const title = m.title.native || m.title.romaji || m.title.english || '';
      return {
        id: `anilist:${m.id}`,
        source: 'anilist',
        title,
        totalEpisodes: m.episodes || null,
        airing: m.status === 'RELEASING' || m.status === 'NOT_YET_RELEASED',
        suggestedStatus: m.status === 'FINISHED' ? 'completed' : 'watching',
        sourceLabel: 'AniList',
      };
    }).filter((r) => r.title);
  } catch {
    return [];
  }
}

function dedupeResults(results) {
  const seen = new Set();
  const out = [];
  for (const r of results) {
    const key = normalizeTitle(r.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/\s+/g, '').replace(/[·・]/g, '');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
