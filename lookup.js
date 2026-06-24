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

  async search(query) {
    if (query.length < 2) return [];
    const [anilist, bangumi] = await Promise.all([
      this.searchAnilist(query),
      this.searchBangumi(query),
    ]);
    return this.dedupeResults([...anilist, ...bangumi]).slice(0, 10);
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
