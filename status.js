const StatusLookup = {
  async searchMal(query) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=12`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.data || []).map((a) => this.mapMal(a)).filter((r) => r.aliases.length);
    } catch {
      return [];
    }
  },

  mapMal(a) {
    const aliases = new Set();
    for (const t of [a.title_japanese, a.title, a.title_english, ...(a.titles || []).map((x) => x.title)]) {
      if (t) aliases.add(t);
    }
    return {
      id: `mal:${a.mal_id}`,
      aliases: [...aliases],
      title: a.title_japanese || a.title || a.title_english || '',
      finished: a.status === 'Finished Airing',
      source: 'mal',
    };
  },

  async searchAnilist(query) {
    const queryGql = `
      query ($search: String) {
        Page(page: 1, perPage: 12) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            title { native romaji english }
            synonyms
            status
          }
        }
      }
    `;
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryGql, variables: { search: query } }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.data?.Page?.media || []).map((m) => {
        const aliases = new Set();
        for (const t of [m.title?.native, m.title?.romaji, m.title?.english, ...(m.synonyms || [])]) {
          if (t) aliases.add(t);
        }
        return {
          id: `anilist:${m.id}`,
          aliases: [...aliases],
          title: m.title?.native || m.title?.romaji || m.title?.english || '',
          finished: m.status === 'FINISHED',
          source: 'anilist',
        };
      }).filter((r) => r.aliases.length);
    } catch {
      return [];
    }
  },

  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[·・：:，,！!？?\-—]/g, '')
      .replace(/[（(][^）)]*[）)]/g, '');
  },

  parseSeasonNumber(token) {
    if (/^\d+$/.test(token)) return parseInt(token, 10);
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (token === '十') return 10;
    if (token.length === 2 && token[0] === '十') return 10 + (map[token[1]] || 0);
    if (token.length === 2 && token[1] === '十') return (map[token[0]] || 0) * 10;
    return map[token] ?? null;
  },

  romanToInt(str) {
    const map = { I: 1, V: 5, X: 10, L: 50, C: 100 };
    const upper = str.toUpperCase();
    let total = 0;
    for (let i = 0; i < upper.length; i++) {
      const val = map[upper[i]] || 0;
      const next = map[upper[i + 1]] || 0;
      total += val < next ? -val : val;
    }
    return total || null;
  },

  parseSeason(title) {
    if (!title) return null;

    let m = title.match(/第([一二三四五六七八九十百千\d]+)[季部]/);
    if (m) return this.parseSeasonNumber(m[1]);

    m = title.match(/(?:season\s*|s)(\d+)/i);
    if (m) return parseInt(m[1], 10);

    m = title.match(/\s([IVXLC]{1,4})$/i);
    if (m) return this.romanToInt(m[1]);

    m = title.match(/([IVXLC]{1,4})$/i);
    if (m && title.length > m[1].length + 1) return this.romanToInt(m[1]);

    m = title.match(/(\D)(\d{1,2})$/u);
    if (m) {
      const n = parseInt(m[2], 10);
      if (n >= 1 && n <= 30) return n;
    }

    return null;
  },

  parseSeasonFromResult(result) {
    for (const alias of [result.title, ...result.aliases]) {
      const season = this.parseSeason(alias);
      if (season != null) return season;
    }
    return null;
  },

  stripSeasonSuffix(title) {
    return title
      .replace(/\s*第[一二三四五六七八九十百千\d]+季.*$/i, '')
      .replace(/\s*第[一二三四五六七八九十百千\d]+部.*$/i, '')
      .replace(/\s*(season\s*\d+|s\d+).*$/i, '')
      .replace(/([^\s])[IVXLC]{1,4}$/i, '$1')
      .replace(/(\D)\d{1,2}$/u, '$1')
      .trim();
  },

  hasExplicitSeason(title) {
    return this.parseSeason(title) != null;
  },

  isSeasonCompatible(dramaTitle, result) {
    const dramaSeason = this.parseSeason(dramaTitle);
    if (dramaSeason == null) return true;

    const resultSeason = this.parseSeasonFromResult(result);
    if (resultSeason != null) return resultSeason === dramaSeason;

    const dramaBase = this.normalizeTitle(this.stripSeasonSuffix(dramaTitle));
    for (const alias of result.aliases) {
      const aliasSeason = this.parseSeason(alias);
      if (aliasSeason != null) continue;
      const norm = this.normalizeTitle(alias);
      if (norm === dramaBase) return false;
    }
    return true;
  },

  searchQueries(title) {
    const queries = [title];
    const noParen = title.replace(/[（(][^）)]*[）)]/g, '').trim();
    if (noParen && noParen !== title) queries.push(noParen);

    if (!this.hasExplicitSeason(title)) {
      const base = this.stripSeasonSuffix(title);
      if (base && base.length >= 2 && base !== title) queries.push(base);
    }

    return [...new Set(queries)];
  },

  levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[n];
  },

  titleSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    if (!maxLen) return 1;
    return 1 - this.levenshtein(a, b) / maxLen;
  },

  scoreMatch(dramaTitle, result) {
    if (!this.isSeasonCompatible(dramaTitle, result)) return 0;

    const dramaSeason = this.parseSeason(dramaTitle);
    const norms = new Set([this.normalizeTitle(dramaTitle)]);
    const noParen = dramaTitle.replace(/[（(][^）)]*[）)]/g, '').trim();
    if (noParen) norms.add(this.normalizeTitle(noParen));

    if (dramaSeason == null) {
      const base = this.stripSeasonSuffix(dramaTitle);
      if (base) norms.add(this.normalizeTitle(base));
    }

    let best = 0;
    for (const alias of result.aliases) {
      const rt = this.normalizeTitle(alias);
      const rb = this.normalizeTitle(this.stripSeasonSuffix(alias));
      for (const norm of norms) {
        if (!norm || !rt) continue;
        if (rt === norm || rb === norm) best = Math.max(best, 100);
        else if (rt.includes(norm) || norm.includes(rt) || rb.includes(norm) || norm.includes(rb)) {
          best = Math.max(best, 72);
        } else {
          const sim = this.titleSimilarity(rt, norm);
          if (sim >= 0.82) best = Math.max(best, 88);
          else if (sim >= 0.7) best = Math.max(best, 68);
          else if (sim >= 0.55 && Math.abs(rt.length - norm.length) <= 3) best = Math.max(best, 55);
        }
      }
    }

    if (dramaSeason != null && this.parseSeasonFromResult(result) === dramaSeason) {
      best = Math.min(100, best + 12);
    }

    return best;
  },

  pickBestMatch(results, dramaTitle) {
    if (!results.length) return null;
    const scored = results
      .map((r) => ({ result: r, score: this.scoreMatch(dramaTitle, r) }))
      .filter((x) => x.score >= 55)
      .sort((a, b) => b.score - a.score);
    return scored[0]?.result || null;
  },

  dedupeResults(results) {
    const seen = new Set();
    const out = [];
    for (const r of results) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    return out;
  },

  async fetchMalById(id) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/anime/${parseInt(id, 10)}`);
      if (!res.ok) return null;
      const a = (await res.json())?.data;
      if (!a) return null;
      return this.mapMal(a);
    } catch {
      return null;
    }
  },

  async fetchAnilistById(id) {
    const queryGql = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title { native romaji english }
          synonyms
          status
        }
      }
    `;
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryGql, variables: { id: parseInt(id, 10) } }),
      });
      if (!res.ok) return null;
      const m = (await res.json())?.data?.Media;
      if (!m) return null;
      const aliases = new Set();
      for (const t of [m.title?.native, m.title?.romaji, m.title?.english, ...(m.synonyms || [])]) {
        if (t) aliases.add(t);
      }
      return {
        id: `anilist:${m.id}`,
        aliases: [...aliases],
        title: m.title?.native || m.title?.romaji || m.title?.english || '',
        finished: m.status === 'FINISHED',
        source: 'anilist',
      };
    } catch {
      return null;
    }
  },

  async fetchByMeta(metaId) {
    if (!metaId) return null;
    if (metaId.startsWith('mal:')) return this.fetchMalById(metaId.slice(4));
    if (metaId.startsWith('anilist:')) return this.fetchAnilistById(metaId.slice(8));
    return null;
  },

  async findStatus(title) {
    if (title.length < 2) return null;

    let combined = [];
    for (const query of this.searchQueries(title)) {
      const mal = await this.searchMal(query);
      combined = this.dedupeResults([...combined, ...mal]);
      const match = this.pickBestMatch(combined, title);
      if (match) return match;
      await this.delay(350);
    }

    for (const query of this.searchQueries(title)) {
      const anilist = await this.searchAnilist(query);
      combined = this.dedupeResults([...combined, ...anilist]);
      const match = this.pickBestMatch(combined, title);
      if (match) return match;
      await this.delay(350);
    }

    return this.pickBestMatch(combined, title);
  },

  async checkDrama(drama) {
    if (drama?.status === 'completed' || drama?.networkFinished === true) {
      return { finished: true, metaId: drama.statusMetaId || null, cached: true };
    }

    let meta = drama.statusMetaId ? await this.fetchByMeta(drama.statusMetaId) : null;
    if (meta && !this.isSeasonCompatible(drama.title, meta)) meta = null;
    if (meta && this.scoreMatch(drama.title, meta) < 55) meta = null;

    if (!meta) meta = await this.findStatus(drama.title);
    if (!meta || this.scoreMatch(drama.title, meta) < 55) {
      return { finished: false, metaId: null };
    }

    return { finished: !!meta.finished, metaId: meta.id };
  },

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};
