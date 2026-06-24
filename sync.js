const SYNC_CODE_KEY = 'drama-track-sync-code';
const SYNC_META_KEY = 'drama-track-sync-meta';

const SyncManager = {
  status: 'idle', // idle | syncing | synced | error | offline
  statusMessage: '',
  listeners: [],

  isConfigured() {
    const url = window.SYNC_CONFIG?.apiUrl || '';
    return !!(url && !url.includes('YOUR_SUBDOMAIN'));
  },

  apiBase() {
    return window.SYNC_CONFIG.apiUrl.replace(/\/$/, '');
  },

  hasSyncCode() {
    return !!localStorage.getItem(SYNC_CODE_KEY);
  },

  getSyncCode() {
    return localStorage.getItem(SYNC_CODE_KEY) || '';
  },

  setSyncCode(code) {
    localStorage.setItem(SYNC_CODE_KEY, code.trim());
  },

  clearSyncCode() {
    localStorage.removeItem(SYNC_CODE_KEY);
    localStorage.removeItem(SYNC_META_KEY);
    this.setStatus('idle', '');
  },

  onStatusChange(fn) {
    this.listeners.push(fn);
  },

  setStatus(status, messageKey = '', params = {}) {
    this.status = status;
    this.messageKey = messageKey;
    this.messageParams = params;
    this.listeners.forEach((fn) => fn(status, messageKey, params));
  },

  getMeta() {
    try {
      return JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}');
    } catch {
      return {};
    }
  },

  setMeta(meta) {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  },

  async hashSyncId(code) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  async deriveKey(code, syncId) {
    const enc = new TextEncoder();
    const salt = enc.encode(syncId.slice(0, 32));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(code), 'PBKDF2', false, ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  },

  async encrypt(dramas, code, syncId) {
    const key = await this.deriveKey(code, syncId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(dramas));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return this.uint8ToBase64(combined);
  },

  async decrypt(encryptedB64, code, syncId) {
    const combined = this.base64ToUint8(encryptedB64);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const key = await this.deriveKey(code, syncId);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext));
  },

  uint8ToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  },

  base64ToUint8(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  },

  async pull(code) {
    const syncId = await this.hashSyncId(code);
    const url = `${this.apiBase()}/sync/${syncId}`;

    const res = await fetch(url);
    if (res.status === 404) return { dramas: null, updatedAt: 0 };
    if (!res.ok) throw new Error(JSON.stringify({ key: 'sync.pullFailed', status: res.status }));

    const row = await res.json();
    const dramas = await this.decrypt(row.encrypted_data, code, syncId);
    return { dramas, updatedAt: row.updated_at };
  },

  async push(code, dramas, retryOnConflict = true) {
    const syncId = await this.hashSyncId(code);
    const updatedAt = Date.now();
    const encryptedData = await this.encrypt(dramas, code, syncId);

    const url = `${this.apiBase()}/sync/${syncId}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encrypted_data: encryptedData,
        updated_at: updatedAt,
      }),
    });

    if (res.status === 409 && retryOnConflict) {
      const remote = await res.json();
      const remoteDramas = await this.decrypt(remote.encrypted_data, code, syncId);
      const merged = this.mergeDramas(dramas, remoteDramas);
      return this.push(code, merged, false);
    }

    if (!res.ok) throw new Error(JSON.stringify({ key: 'sync.pushFailed', status: res.status }));
    this.setMeta({ lastPushedAt: updatedAt });
    return updatedAt;
  },

  mergeDramas(local, remote) {
    const map = new Map();
    for (const d of [...(local || []), ...(remote || [])]) {
      const existing = map.get(d.id);
      if (!existing || (d.updatedAt || 0) > (existing.updatedAt || 0)) {
        map.set(d.id, d);
      }
    }
    return Array.from(map.values());
  },

  async sync(localDramas) {
    if (!this.isConfigured()) {
      this.setStatus('offline', 'sync.offline');
      return localDramas;
    }

    const code = this.getSyncCode();
    if (!code) {
      this.setStatus('idle', 'sync.noCode');
      return localDramas;
    }

    this.setStatus('syncing', 'sync.syncing');

    try {
      const remote = await this.pull(code);
      let merged = this.mergeDramas(localDramas, remote.dramas);

      const localMax = merged.reduce((max, d) => Math.max(max, d.updatedAt || 0), 0);
      const shouldPush = !remote.dramas || localMax > remote.updatedAt
        || JSON.stringify(merged) !== JSON.stringify(remote.dramas);

      if (shouldPush) {
        await this.push(code, merged);
      } else {
        this.setMeta({ lastPushedAt: remote.updatedAt });
      }

      this.setStatus('synced', 'sync.synced');
      return merged;
    } catch (err) {
      let messageKey = 'sync.failed';
      let params = {};
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.key) {
          messageKey = parsed.key;
          params = { status: parsed.status };
        }
      } catch {
        params = { status: err.message };
      }
      this.setStatus('error', messageKey, params);
      return localDramas;
    }
  },
};
