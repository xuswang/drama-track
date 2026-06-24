const Lookup = {
  debounceTimer: null,
  selectedMeta: null,

  apiBase() {
    if (!window.SYNC_CONFIG?.apiUrl) return '';
    return window.SYNC_CONFIG.apiUrl.replace(/\/$/, '');
  },

  isAvailable() {
    return true;
  },

  async searchAnilist(query) {
    const queryGql = `
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
      body: JSON.stringify({ query: queryGql, variables: { search: query } }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data?.Page?.media || []).map((m) => ({
      id: `anilist:${m.id}`,
      source: 'anilist',
      title: m.title.native || m.title.romaji || m.title.english || '',
      totalEpisodes: m.episodes || null,
      airing: m.status === 'RELEASING' || m.status === 'NOT_YET_RELEASED',
      suggestedStatus: m.status === 'FINISHED' ? 'completed' : 'watching',
      sourceLabel: 'AniList',
    })).filter((r) => r.title);
  },

  async searchBangumi(query) {
    const base = this.apiBase();
    if (!base || base.includes('YOUR_SUBDOMAIN')) return [];
    try {
      const res = await fetch(`${base}/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.results || [];
    } catch {
      return [];
    }
  },

  async searchMal(query) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=12`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.data || []).map((a) => ({
        id: `mal:${a.mal_id}`,
        source: 'mal',
        title: a.title_japanese || a.title || a.title_english || '',
        totalEpisodes: a.episodes > 0 ? a.episodes : null,
        airing: !!a.airing || a.status === 'Currently Airing',
        suggestedStatus: a.status === 'Finished Airing' ? 'completed' : 'watching',
        sourceLabel: 'MyAnimeList',
      })).filter((r) => r.title);
    } catch {
      return [];
    }
  },

  async search(query) {
    if (query.length < 2) return [];
    const [anilist, bangumi, mal] = await Promise.all([
      this.searchAnilist(query),
      this.searchBangumi(query),
      this.searchMal(query),
    ]);
    return this.dedupeResults([...anilist, ...mal, ...bangumi]).slice(0, 12);
  },

  // Fast path: AniList first; MAL when count looks too low; Bangumi as last resort
  async searchFast(query, currentEpisode = 0) {
    if (query.length < 2) return [];
    const anilist = await this.searchAnilist(query);
    let combined = anilist;
    let best = this.pickBestMetaForDrama(anilist, query, currentEpisode);
    if (best?.totalEpisodes && this.isEpisodeCountSufficient(best.totalEpisodes, currentEpisode)) {
      return combined;
    }

    await this.delay(400);
    const mal = await this.searchMal(query);
    combined = this.dedupeResults([...anilist, ...mal]);
    best = this.pickBestMetaForDrama(combined, query, currentEpisode);
    if (best?.totalEpisodes && this.isEpisodeCountSufficient(best.totalEpisodes, currentEpisode)) {
      return combined;
    }

    const bangumi = await this.searchBangumi(query);
    return this.dedupeResults([...combined, ...bangumi]).slice(0, 12);
  },

  isEpisodeCountSufficient(totalEpisodes, currentEpisode) {
    if (!totalEpisodes) return false;
    if (!currentEpisode || currentEpisode <= 1) return true;
    return totalEpisodes >= currentEpisode;
  },

  isTheatricalEntry(title) {
    return /剧场版|movie|film|特别篇/i.test(title);
  },

  titleMatchesResult(dramaTitle, resultTitle) {
    const norm = this.normalizeTitle(dramaTitle);
    const base = this.normalizeTitle(this.stripSeasonSuffix(dramaTitle));
    const rt = this.normalizeTitle(resultTitle);
    const rBase = this.normalizeTitle(this.stripSeasonSuffix(resultTitle));
    return rt === norm || rt === base || rBase === base || rBase === norm
      || (base.length >= 2 && rt.startsWith(base))
      || (base.length >= 2 && base.startsWith(rt));
  },

  pickBestMetaForDrama(results, dramaTitle, currentEpisode = 0) {
    if (!results.length) return null;

    const matched = results.filter((r) => this.titleMatchesResult(dramaTitle, r.title));
    const pool = matched.length ? matched : results;
    const withEps = pool.filter((r) => r.totalEpisodes > 0);
    if (!withEps.length) return this.pickBestMatch(results, dramaTitle);

    const norm = this.normalizeTitle(dramaTitle);
    const base = this.normalizeTitle(this.stripSeasonSuffix(dramaTitle));
    const exact = withEps.filter((r) => {
      const rt = this.normalizeTitle(r.title);
      return rt === norm || rt === base;
    });

    if (exact.length) {
      const best = [...exact].sort((a, b) => b.totalEpisodes - a.totalEpisodes)[0];
      if (this.isEpisodeCountSufficient(best.totalEpisodes, currentEpisode)) return best;
    }

    const seasonal = withEps.filter((r) => {
      if (this.isTheatricalEntry(r.title) && r.totalEpisodes <= 1) return false;
      const rt = this.normalizeTitle(this.stripSeasonSuffix(r.title));
      return rt === base || rt === norm;
    });

    if (seasonal.length > 1) {
      const sum = seasonal.reduce((total, r) => total + r.totalEpisodes, 0);
      const anchor = [...seasonal].sort((a, b) => b.totalEpisodes - a.totalEpisodes)[0];
      const total = Math.max(sum, anchor.totalEpisodes);
      if (this.isEpisodeCountSufficient(total, currentEpisode)) {
        return { ...anchor, totalEpisodes: total };
      }
    }

    return this.pickBestMatch(withEps, dramaTitle);
  },

  normalizeTitle(title) {
    return title.toLowerCase().replace(/\s+/g, '').replace(/[·・]/g, '');
  },

  stripSeasonSuffix(title) {
    return title
      .replace(/\s*第[一二三四五六七八九十百千\d]+季.*$/i, '')
      .replace(/\s*第[一二三四五六七八九十百千\d]+部.*$/i, '')
      .replace(/\s*(season\s*\d+|s\d+).*$/i, '')
      .replace(/([^\s])[IVXLC]{1,4}$/i, '$1')
      .replace(/(\D)\d+$/u, '$1')
      .trim();
  },

  searchQueries(title) {
    const queries = [title];
    const base = this.stripSeasonSuffix(title);
    if (base && base !== title) queries.push(base);
    return [...new Set(queries)];
  },

  scoreMatch(result, dramaTitle) {
    const norm = this.normalizeTitle(dramaTitle);
    const base = this.normalizeTitle(this.stripSeasonSuffix(dramaTitle));
    const rt = this.normalizeTitle(result.title);
    let score = 0;
    if (rt === norm) score += 100;
    else if (rt === base) score += 85;
    else if (rt.includes(norm) || norm.includes(rt)) score += 55;
    else if (rt.includes(base) || base.includes(rt)) score += 45;
    if (result.totalEpisodes) score += 20 + Math.min(result.totalEpisodes, 500) / 50;
    return score;
  },

  pickBestMatch(results, dramaTitle) {
    if (!results.length) return null;
    return [...results].sort((a, b) => this.scoreMatch(b, dramaTitle) - this.scoreMatch(a, dramaTitle))[0];
  },

  async findBestMeta(title, currentEpisode = 0) {
    let fallback = null;
    for (const query of this.searchQueries(title)) {
      const results = await this.searchFast(query, currentEpisode);
      const meta = this.pickBestMetaForDrama(results, title, currentEpisode);
      if (meta?.totalEpisodes && this.isEpisodeCountSufficient(meta.totalEpisodes, currentEpisode)) {
        return meta;
      }
      if (meta && !fallback) fallback = meta;
    }
    if (fallback) return fallback;
    const results = await this.search(title);
    return this.pickBestMetaForDrama(results, title, currentEpisode);
  },

  async fetchAnilistById(id) {
    const queryGql = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title { native romaji english }
          episodes
          status
        }
      }
    `;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryGql, variables: { id: parseInt(id, 10) } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const m = data?.data?.Media;
    if (!m) return null;
    return {
      id: `anilist:${m.id}`,
      source: 'anilist',
      title: m.title.native || m.title.romaji || m.title.english || '',
      totalEpisodes: m.episodes || null,
      airing: m.status === 'RELEASING' || m.status === 'NOT_YET_RELEASED',
      suggestedStatus: m.status === 'FINISHED' ? 'completed' : 'watching',
      sourceLabel: 'AniList',
    };
  },

  async fetchBangumiById(id) {
    const base = this.apiBase();
    if (!base || base.includes('YOUR_SUBDOMAIN')) return null;
    try {
      const res = await fetch(`${base}/subject/bgm/${id}`);
      if (!res.ok) return null;
      const sub = await res.json();
      return {
        id: `bgm:${id}`,
        source: 'bangumi',
        title: sub.title,
        totalEpisodes: sub.totalEpisodes,
        airing: sub.airing,
        sourceLabel: 'Bangumi',
      };
    } catch {
      return null;
    }
  },

  async fetchMalById(id) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/anime/${parseInt(id, 10)}`);
      if (!res.ok) return null;
      const a = (await res.json())?.data;
      if (!a) return null;
      return {
        id: `mal:${a.mal_id}`,
        source: 'mal',
        title: a.title_japanese || a.title || a.title_english || '',
        totalEpisodes: a.episodes > 0 ? a.episodes : null,
        airing: !!a.airing || a.status === 'Currently Airing',
        suggestedStatus: a.status === 'Finished Airing' ? 'completed' : 'watching',
        sourceLabel: 'MyAnimeList',
      };
    } catch {
      return null;
    }
  },

  async fetchByMeta(metaId) {
    if (!metaId) return null;
    if (metaId.startsWith('anilist:')) return this.fetchAnilistById(metaId.slice(8));
    if (metaId.startsWith('bgm:')) return this.fetchBangumiById(metaId.slice(4));
    if (metaId.startsWith('mal:')) return this.fetchMalById(metaId.slice(4));
    return null;
  },

  needsBetterEpisodeMeta(meta, currentEpisode) {
    if (!meta?.totalEpisodes) return true;
    if (!currentEpisode || currentEpisode <= 1) return false;
    return meta.totalEpisodes < currentEpisode;
  },

  async refreshDrama(drama) {
    const hadMeta = !!drama.metaId;
    const prevTotal = drama.totalEpisodes;
    const currentEpisode = drama.currentEpisode || 0;
    let meta;

    if (drama.metaId) {
      meta = await this.fetchByMeta(drama.metaId);
    }

    if (!meta || this.needsBetterEpisodeMeta(meta, currentEpisode)) {
      const better = await this.findBestMeta(drama.title, currentEpisode);
      if (better && (!meta || !meta.totalEpisodes || (better.totalEpisodes || 0) >= (meta.totalEpisodes || 0))) {
        meta = better;
      }
    }

    if (meta) {
      if (meta.id !== drama.metaId) {
        drama.metaId = meta.id;
        drama.metaSource = meta.source;
      }
    }

    let changed = !hadMeta && !!drama.metaId;

    if (meta?.totalEpisodes && meta.totalEpisodes !== prevTotal) {
      drama.totalEpisodes = meta.totalEpisodes;
      drama.updatedAt = Date.now();
      changed = true;
    }

    return changed;
  },

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  dedupeResults(results) {
    const seen = new Set();
    const out = [];
    for (const r of results) {
      const key = r.title.toLowerCase().replace(/\s+/g, '').replace(/[·・]/g, '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  },

  formatEpisodes(result) {
    if (result.totalEpisodes) return `${result.totalEpisodes} ${t('lookup.eps')}`;
    if (result.airing) return t('lookup.airing');
    return t('lookup.unknownEps');
  },

  renderResults(container, results, onSelect) {
    if (!results.length) {
      container.innerHTML = `<p class="lookup-empty">${t('lookup.noResults')}</p>`;
      container.classList.remove('hidden');
      return;
    }

    container.innerHTML = results.map((r, i) => `
      <button type="button" class="lookup-item" data-idx="${i}">
        <span class="lookup-item-title">${escapeHtml(r.title)}</span>
        <span class="lookup-item-meta">${escapeHtml(r.sourceLabel)} · ${escapeHtml(this.formatEpisodes(r))}</span>
      </button>
    `).join('');
    container.classList.remove('hidden');

    container.querySelectorAll('.lookup-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = results[parseInt(btn.dataset.idx, 10)];
        onSelect(item);
      });
    });
  },

  clear(container) {
    if (container) {
      container.innerHTML = '';
      container.classList.add('hidden');
    }
    this.selectedMeta = null;
  },
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
