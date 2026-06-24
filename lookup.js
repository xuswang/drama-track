const Lookup = {
  debounceTimer: null,
  selectedMeta: null,

  apiBase() {
    if (!window.SYNC_CONFIG?.apiUrl) return '';
    return window.SYNC_CONFIG.apiUrl.replace(/\/$/, '');
  },

  isAvailable() {
    const url = this.apiBase();
    return !!(url && !url.includes('YOUR_SUBDOMAIN'));
  },

  async search(query) {
    if (!this.isAvailable() || query.length < 2) return [];
    const res = await fetch(`${this.apiBase()}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('search failed');
    const data = await res.json();
    return data.results || [];
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
