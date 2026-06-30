const STORAGE_KEY = 'drama-track-data';
const SORT_KEY = 'drama-track-sort';
const EPISODE_SORT_DELAY_MS = 3000;

let dramas = loadData();
let currentFilter = 'all';
let currentSort = loadSort();
let searchQuery = '';
let syncDebounceTimer = null;
let lastSyncTime = null;
const episodeSortDebounceTimers = new Map();

const dramaListEl = document.getElementById('drama-list');
const emptyStateEl = document.getElementById('empty-state');
const statsEl = document.getElementById('stats');
const modal = document.getElementById('drama-modal');
const form = document.getElementById('drama-form');
const searchInput = document.getElementById('search');
const syncModal = document.getElementById('sync-modal');
const syncStatusEl = document.getElementById('sync-status');
const syncDotEl = document.getElementById('sync-dot');

function loadSort() {
  const saved = localStorage.getItem(SORT_KEY);
  return saved === 'alpha' ? 'alpha' : 'updated';
}

function saveSort(sort) {
  currentSort = sort;
  localStorage.setItem(SORT_KEY, sort);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return data.map(migrateDrama);
  } catch {
    return [];
  }
}

function migrateDrama(drama) {
  const d = { ...drama };
  delete d.totalEpisodes;
  delete d.metaId;
  delete d.metaSource;
  if (d.episodeUpdatedAt == null) d.episodeUpdatedAt = d.updatedAt || 0;
  if (d.status === 'completed') d.archived = true;
  else if (d.archived === undefined) d.archived = false;
  else if (d.status !== 'completed') d.archived = false;
  return d;
}

function applyArchiveRules(drama) {
  if (drama.status === 'completed') {
    drama.archived = true;
  } else {
    drama.archived = false;
  }
  return drama;
}

function isActive(drama) {
  return !drama.archived;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dramas));
  scheduleSync();
}

function scheduleSync() {
  if (!SyncManager.isConfigured() || !SyncManager.hasSyncCode()) return;
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => performSync(), 1500);
}

async function performSync() {
  const merged = await SyncManager.sync(dramas);
  if (merged !== dramas) {
    dramas = merged.map(migrateDrama);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dramas));
    render();
  }
}

function formatSyncMessage(status, messageKey, params = {}) {
  if (status === 'synced' && lastSyncTime) {
    return t('sync.synced', { time: I18n.formatTime(lastSyncTime) });
  }
  if (messageKey) return t(messageKey, params);
  return '';
}

function updateSyncUI(status, messageKey, params) {
  syncDotEl.className = 'sync-dot';
  if (status === 'syncing') syncDotEl.classList.add('syncing');
  else if (status === 'synced') syncDotEl.classList.add('synced');
  else if (status === 'error') syncDotEl.classList.add('error');
  else if (status === 'offline') syncDotEl.classList.add('offline');

  syncStatusEl.textContent = formatSyncMessage(status, messageKey, params);
}

function openSyncModal() {
  const syncInfo = document.getElementById('sync-info');
  const codeInput = document.getElementById('sync-code');

  if (SyncManager.isConfigured()) {
    syncInfo.className = 'sync-info configured';
    syncInfo.textContent = SyncManager.hasSyncCode()
      ? t('sync.configured')
      : t('sync.configuredNoCode');
  } else {
    syncInfo.className = 'sync-info not-configured';
    syncInfo.textContent = t('sync.notConfigured');
  }

  codeInput.value = SyncManager.getSyncCode();
  syncModal.showModal();
  if (!SyncManager.hasSyncCode()) codeInput.focus();
}

function closeSyncModal() {
  syncModal.close();
}

async function saveSyncSettings(e) {
  e.preventDefault();
  const code = document.getElementById('sync-code').value.trim();
  if (code.length < 4) {
    alert(t('sync.codeTooShort'));
    return;
  }
  SyncManager.setSyncCode(code);
  closeSyncModal();
  await performSync();
}

async function initApp() {
  I18n.init();

  SyncManager.onStatusChange((status, messageKey, params) => {
    if (status === 'synced') lastSyncTime = new Date();
    updateSyncUI(status, messageKey, params);
  });

  if (SyncManager.isConfigured() && SyncManager.hasSyncCode()) {
    dramas = (await SyncManager.sync(dramas)).map(migrateDrama);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dramas));
  } else if (SyncManager.isConfigured()) {
    SyncManager.setStatus('idle', 'sync.setupHint');
  } else {
    SyncManager.setStatus('offline', 'sync.offline');
  }

  render();
  // Migrate existing completed shows into archive on first load after update
  const needsArchiveMigrate = dramas.some((d) => d.status === 'completed' && !d.archived);
  if (needsArchiveMigrate) {
    dramas.forEach((d) => applyArchiveRules(d));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dramas));
    render();
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function sortDramas(list) {
  const locale = I18n.getLang() === 'zh' ? 'zh-CN' : 'en';
  return [...list].sort((a, b) => {
    if (currentSort === 'alpha') {
      return a.title.localeCompare(b.title, locale, { sensitivity: 'base' });
    }
    return (b.episodeUpdatedAt || 0) - (a.episodeUpdatedAt || 0);
  });
}

function getFilteredDramas() {
  return sortDramas(dramas.filter((d) => {
    if (currentFilter === 'archive') {
      if (!d.archived) return false;
    } else {
      if (d.archived) return false;
      if (currentFilter !== 'all' && d.status !== currentFilter) return false;
    }
    if (searchQuery && !d.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }));
}

function renderDramaCard(drama) {
  const notes = drama.notes
    ? `<div class="drama-notes">${escapeHtml(drama.notes)}</div>`
    : '';

  const episodeControls = drama.archived
    ? `<button type="button" class="btn btn-ghost btn-sm restore-btn" data-action="restore">${t('card.restore')}</button>`
    : `
        <div class="episode-controls">
          <button class="btn-icon" data-action="decrease" title="${t('card.prev')}">−</button>
          <span class="episode-label">${t('card.adjust')}</span>
          <button class="btn-icon" data-action="increase" title="${t('card.next')}">+</button>
        </div>`;

  return `
    <article class="drama-card${drama.archived ? ' archived' : ''}" data-id="${drama.id}">
      <div class="drama-card-header">
        <h3 class="drama-title">${escapeHtml(drama.title)}</h3>
        <span class="drama-status-badge status-${drama.status}">${t(`status.${drama.status}`)}</span>
      </div>
      <div class="episode-section">
        <span class="episode-count">${t('card.episodeCount', { n: drama.currentEpisode })}</span>
      </div>
      ${notes}
      <div class="drama-actions">
        ${episodeControls}
        <button class="btn-icon" data-action="edit" title="${t('card.edit')}">✎</button>
        <button class="btn-icon danger" data-action="delete" title="${t('card.delete')}">✕</button>
      </div>
    </article>
  `;
}

function renderStats() {
  const active = dramas.filter(isActive);
  const watching = active.filter((d) => d.status === 'watching').length;
  const archived = dramas.filter((d) => d.archived).length;
  const episodesWatched = dramas.reduce((sum, d) => sum + (d.currentEpisode || 0), 0);

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="value">${active.length}</div>
      <div class="label">${t('stats.total')}</div>
    </div>
    <div class="stat-card">
      <div class="value">${watching}</div>
      <div class="label">${t('stats.watching')}</div>
    </div>
    <div class="stat-card">
      <div class="value">${archived}</div>
      <div class="label">${t('stats.archived')}</div>
    </div>
    <div class="stat-card">
      <div class="value">${episodesWatched}</div>
      <div class="label">${t('stats.episodes')}</div>
    </div>
  `;
}

function render() {
  const filtered = getFilteredDramas();
  renderStats();

  if (dramas.length === 0) {
    dramaListEl.innerHTML = '';
    emptyStateEl.classList.remove('hidden');
    return;
  }

  emptyStateEl.classList.add('hidden');

  if (filtered.length === 0) {
    const msg = currentFilter === 'archive' ? t('list.archiveEmpty') : t('list.noMatch');
    dramaListEl.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
    return;
  }

  dramaListEl.innerHTML = filtered.map(renderDramaCard).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openModal(drama = null) {
  document.getElementById('modal-title').textContent = drama ? t('modal.edit') : t('modal.add');
  document.getElementById('drama-id').value = drama?.id || '';
  document.getElementById('drama-title').value = drama?.title || '';
  document.getElementById('drama-current').value = drama?.currentEpisode ?? 0;
  document.getElementById('drama-status').value = drama?.status || 'watching';
  document.getElementById('drama-notes').value = drama?.notes || '';
  I18n.applyStatic();
  modal.showModal();
  document.getElementById('drama-title').focus();
}

function closeModal() {
  modal.close();
  form.reset();
}

function saveDrama(e) {
  e.preventDefault();

  const id = document.getElementById('drama-id').value;
  const title = document.getElementById('drama-title').value.trim();
  const currentEpisode = parseInt(document.getElementById('drama-current').value, 10) || 0;
  const status = document.getElementById('drama-status').value;
  const notes = document.getElementById('drama-notes').value.trim();

  if (!title) return;

  const now = Date.now();
  const data = {
    title,
    currentEpisode,
    status,
    notes,
    updatedAt: now,
  };

  if (id) {
    clearEpisodeSortDebounce(id);
    const idx = dramas.findIndex((d) => d.id === id);
    if (idx !== -1) {
      const existing = dramas[idx];
      data.episodeUpdatedAt = existing.currentEpisode !== currentEpisode
        ? now
        : (existing.episodeUpdatedAt || existing.updatedAt || 0);
      dramas[idx] = applyArchiveRules({ ...existing, ...data });
    }
  } else {
    data.episodeUpdatedAt = currentEpisode > 0 ? now : 0;
    dramas.push(applyArchiveRules({ id: generateId(), ...data }));
  }

  saveData();
  closeModal();
  render();
}

function clearEpisodeSortDebounce(id) {
  const timer = episodeSortDebounceTimers.get(id);
  if (!timer) return;
  clearTimeout(timer);
  episodeSortDebounceTimers.delete(id);
}

function scheduleEpisodeSortUpdate(id) {
  clearEpisodeSortDebounce(id);
  episodeSortDebounceTimers.set(id, setTimeout(() => {
    episodeSortDebounceTimers.delete(id);
    const drama = dramas.find((d) => d.id === id);
    if (!drama) return;
    drama.episodeUpdatedAt = Date.now();
    saveData();
    render();
  }, EPISODE_SORT_DELAY_MS));
}

function updateCardEpisodeDisplay(id, episode) {
  const countEl = dramaListEl.querySelector(`[data-id="${id}"] .episode-count`);
  if (countEl) countEl.textContent = t('card.episodeCount', { n: episode });
  renderStats();
}

function changeEpisode(id, delta) {
  const drama = dramas.find((d) => d.id === id);
  if (!drama) return;

  const next = Math.max(0, drama.currentEpisode + delta);
  if (next === drama.currentEpisode) return;

  drama.currentEpisode = next;
  drama.updatedAt = Date.now();
  scheduleEpisodeSortUpdate(id);
  saveData();
  updateCardEpisodeDisplay(id, next);
}

function restoreDrama(id) {
  const drama = dramas.find((d) => d.id === id);
  if (!drama) return;

  drama.status = 'watching';
  drama.archived = false;
  drama.updatedAt = Date.now();
  saveData();
  render();
}

function deleteDrama(id) {
  const drama = dramas.find((d) => d.id === id);
  if (!drama) return;
  if (!confirm(t('confirm.delete', { title: drama.title }))) return;

  clearEpisodeSortDebounce(id);
  dramas = dramas.filter((d) => d.id !== id);
  saveData();
  render();
}

function formatDramaDocLine(drama) {
  if (drama.status === 'completed') {
    return `${drama.title} ${t('export.completed')}`;
  }
  return `${drama.title} ${drama.currentEpisode}`;
}

function downloadFile(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportData() {
  downloadFile(
    JSON.stringify(dramas, null, 2),
    'application/json',
    t('export.filename', { date: new Date().toISOString().slice(0, 10) }),
  );
}

function exportDocument() {
  const lines = sortDramas(dramas).map(formatDramaDocLine);
  const content = `\uFEFF${lines.join('\n')}\n`;
  downloadFile(
    content,
    'text/plain;charset=utf-8',
    t('export.docFilename', { date: new Date().toISOString().slice(0, 10) }),
  );
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('invalid');

      const valid = imported.every((d) => d.title && typeof d.currentEpisode === 'number');
      if (!valid) throw new Error('invalid');

      if (confirm(t('import.confirm', { count: imported.length }))) {
        dramas = imported.map((d) => applyArchiveRules({
          id: d.id || generateId(),
          title: d.title,
          currentEpisode: d.currentEpisode,
          status: d.status || 'watching',
          notes: d.notes || '',
          updatedAt: d.updatedAt || Date.now(),
          episodeUpdatedAt: d.episodeUpdatedAt ?? d.updatedAt ?? 0,
        }));
      } else {
        const existingIds = new Set(dramas.map((d) => d.id));
        imported.forEach((d) => {
          dramas.push(applyArchiveRules({
            id: d.id && !existingIds.has(d.id) ? d.id : generateId(),
            title: d.title,
            currentEpisode: d.currentEpisode,
            status: d.status || 'watching',
            notes: d.notes || '',
            updatedAt: d.updatedAt || Date.now(),
            episodeUpdatedAt: d.episodeUpdatedAt ?? d.updatedAt ?? 0,
          }));
        });
      }

      saveData();
      render();
      alert(t('import.success'));
      scheduleSync();
    } catch {
      alert(t('import.failed'));
    }
  };
  reader.readAsText(file);
}

function onLangChange() {
  I18n.applyStatic();
  updateSyncUI(SyncManager.status, SyncManager.messageKey, SyncManager.messageParams);
  syncSortTabsUI();
  render();
}

function syncSortTabsUI() {
  document.querySelectorAll('#sort-tabs .tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.sort === currentSort);
  });
}

document.getElementById('lang-toggle').addEventListener('click', () => I18n.toggleLang());
I18n.onChange(onLangChange);

document.getElementById('add-btn').addEventListener('click', () => openModal());
document.getElementById('empty-add-btn').addEventListener('click', () => openModal());
document.getElementById('cancel-btn').addEventListener('click', closeModal);
form.addEventListener('submit', saveDrama);

document.getElementById('export-btn').addEventListener('click', exportData);
document.getElementById('export-doc-btn').addEventListener('click', exportDocument);
document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-file').click();
});
document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importData(file);
  e.target.value = '';
});

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  render();
});

document.getElementById('filter-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('#filter-tabs .tab').forEach((el) => el.classList.remove('active'));
  tab.classList.add('active');
  currentFilter = tab.dataset.filter;
  render();
});

document.getElementById('sort-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  saveSort(tab.dataset.sort);
  syncSortTabsUI();
  render();
});

dramaListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const card = btn.closest('.drama-card');
  const id = card?.dataset.id;
  if (!id) return;

  const action = btn.dataset.action;
  if (action === 'increase') changeEpisode(id, 1);
  else if (action === 'decrease') changeEpisode(id, -1);
  else if (action === 'restore') restoreDrama(id);
  else if (action === 'edit') {
    const drama = dramas.find((d) => d.id === id);
    if (drama) openModal(drama);
  } else if (action === 'delete') deleteDrama(id);
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

document.getElementById('sync-settings-btn').addEventListener('click', openSyncModal);
document.getElementById('sync-cancel-btn').addEventListener('click', closeSyncModal);
document.getElementById('sync-now-btn').addEventListener('click', performSync);
document.getElementById('sync-form').addEventListener('submit', saveSyncSettings);

document.getElementById('sync-show-code').addEventListener('change', (e) => {
  document.getElementById('sync-code').type = e.target.checked ? 'text' : 'password';
});

syncModal.addEventListener('click', (e) => {
  if (e.target === syncModal) closeSyncModal();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') performSync();
});

initApp();
syncSortTabsUI();
