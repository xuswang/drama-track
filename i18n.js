const LANG_KEY = 'drama-track-lang';

const MESSAGES = {
  en: {
    'app.title': 'Drama Track',
    'app.subtitle': 'Track which episode you are on',
    'sync.btn': 'Sync',
    'sync.title': 'Cross-device sync',
    'sync.hint': 'Enter the <strong>same sync passphrase</strong> on every device. Data is encrypted before upload — keep your passphrase safe.',
    'sync.code': 'Sync passphrase',
    'sync.codePlaceholder': 'Choose a passphrase you will remember',
    'sync.showCode': 'Show passphrase',
    'sync.close': 'Close',
    'sync.now': 'Sync now',
    'sync.save': 'Save & sync',
    'sync.configured': 'Cloud connected. Use the same passphrase on other devices to sync.',
    'sync.configuredNoCode': 'Cloud connected. Set a passphrase to enable sync.',
    'sync.notConfigured': 'Cloud not configured. Deploy the Cloudflare Worker and set apiUrl in config.js — see README.',
    'sync.offline': 'Cloud not configured — local only',
    'sync.noCode': 'Tap Sync to set your passphrase',
    'sync.setupHint': 'Tap Sync in the top right to set your passphrase',
    'sync.syncing': 'Syncing…',
    'sync.synced': 'Synced · {time}',
    'sync.failed': 'Sync failed',
    'sync.pullFailed': 'Pull failed ({status})',
    'sync.pushFailed': 'Upload failed ({status})',
    'sync.codeTooShort': 'Passphrase must be at least 4 characters',
    'search.placeholder': 'Search shows…',
    'filter.all': 'All',
    'filter.watching': 'Watching',
    'filter.completed': 'Completed',
    'filter.onHold': 'On hold',
    'sort.label': 'Sort',
    'sort.updated': 'Recently updated',
    'sort.alpha': 'A–Z',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.add': '+ Add show',
    'empty.title': 'No shows yet',
    'empty.desc': 'Tap Add show to start tracking your progress',
    'empty.add': 'Add your first show',
    'modal.add': 'Add show',
    'modal.edit': 'Edit show',
    'form.title': 'Title',
    'form.titlePlaceholder': 'e.g. Solo Leveling Season 2',
    'form.current': 'Current episode',
    'form.total': 'Total episodes',
    'form.totalPlaceholder': 'Leave blank if unknown',
    'form.status': 'Status',
    'form.notes': 'Notes',
    'form.notesPlaceholder': 'Platform, air schedule, etc. (optional)',
    'lookup.search': 'Look up episodes',
    'lookup.hint': 'Search Bangumi & AniList for total episodes (great for Chinese donghua)',
    'lookup.searching': 'Searching…',
    'lookup.noResults': 'No matches found',
    'lookup.eps': 'eps',
    'lookup.airing': 'Ongoing',
    'lookup.unknownEps': 'Unknown',
    'lookup.unavailable': 'Lookup unavailable (sync API not configured)',
    'form.cancel': 'Cancel',
    'form.save': 'Save',
    'status.watching': 'Watching',
    'status.completed': 'Completed',
    'status.on_hold': 'On hold',
    'stats.total': 'All shows',
    'stats.watching': 'Watching',
    'stats.completed': 'Completed',
    'stats.episodes': 'Episodes watched',
    'card.ep': 'Ep',
    'card.episodes': 'episodes',
    'card.adjust': 'Adjust',
    'card.prev': 'Previous episode',
    'card.next': 'Next episode',
    'card.edit': 'Edit',
    'card.delete': 'Delete',
    'list.noMatch': 'No matching shows',
    'confirm.delete': 'Delete "{title}"?',
    'import.confirm': 'Import {count} record(s). OK to replace existing data?\nCancel to merge instead.',
    'import.success': 'Import successful!',
    'import.failed': 'Import failed. Check the file format.',
    'export.filename': 'drama-track_{date}.json',
    'lang.switch': '中文',
    'lang.switchTitle': 'Switch to Chinese',
  },
  zh: {
    'app.title': '追番记录',
    'app.subtitle': '记录你看到第几集了',
    'sync.btn': '同步',
    'sync.title': '跨设备同步',
    'sync.hint': '在所有设备上输入<strong>相同的同步码</strong>，进度会自动同步到云端。数据经加密后存储，请牢记同步码。',
    'sync.code': '同步码',
    'sync.codePlaceholder': '设置一个你记得住的密码',
    'sync.showCode': '显示同步码',
    'sync.close': '关闭',
    'sync.now': '立即同步',
    'sync.save': '保存并同步',
    'sync.configured': '云端已连接，同步码已设置。在其他设备输入相同同步码即可同步。',
    'sync.configuredNoCode': '云端已连接，请设置同步码以启用同步。',
    'sync.notConfigured': '尚未配置云端服务。请按 README 部署 Cloudflare Worker，并设置 config.js。',
    'sync.offline': '未配置云端，仅本地存储',
    'sync.noCode': '点击右上角「同步」设置同步码',
    'sync.setupHint': '点击右上角「同步」设置同步码',
    'sync.syncing': '同步中…',
    'sync.synced': '已同步 · {time}',
    'sync.failed': '同步失败',
    'sync.pullFailed': '拉取失败 ({status})',
    'sync.pushFailed': '上传失败 ({status})',
    'sync.codeTooShort': '同步码至少需要 4 个字符',
    'search.placeholder': '搜索剧名…',
    'filter.all': '全部',
    'filter.watching': '在看',
    'filter.completed': '已完结',
    'filter.onHold': '搁置',
    'sort.label': '排序',
    'sort.updated': '最近更新',
    'sort.alpha': '字母顺序',
    'action.export': '导出',
    'action.import': '导入',
    'action.add': '+ 添加剧集',
    'empty.title': '还没有记录',
    'empty.desc': '点击「添加剧集」开始记录你的追剧进度',
    'empty.add': '添加第一部剧',
    'modal.add': '添加剧集',
    'modal.edit': '编辑剧集',
    'form.title': '剧名',
    'form.titlePlaceholder': '例如：庆余年 第二季',
    'form.current': '当前集数',
    'form.total': '总集数',
    'form.totalPlaceholder': '未知可留空',
    'form.status': '状态',
    'form.notes': '备注',
    'form.notesPlaceholder': '播出平台、更新时间等（可选）',
    'lookup.search': '搜索集数',
    'lookup.hint': '从 Bangumi / AniList 查询总集数（适合国产动漫）',
    'lookup.searching': '搜索中…',
    'lookup.noResults': '未找到匹配结果',
    'lookup.eps': '集',
    'lookup.airing': '连载中',
    'lookup.unknownEps': '集数未知',
    'lookup.unavailable': '查询不可用（同步 API 未配置）',
    'form.cancel': '取消',
    'form.save': '保存',
    'status.watching': '在看',
    'status.completed': '已完结',
    'status.on_hold': '搁置',
    'stats.total': '全部剧集',
    'stats.watching': '在看',
    'stats.completed': '已完结',
    'stats.episodes': '累计观看集数',
    'card.ep': '第',
    'card.episodes': '集',
    'card.adjust': '调集数',
    'card.prev': '上一集',
    'card.next': '下一集',
    'card.edit': '编辑',
    'card.delete': '删除',
    'list.noMatch': '没有匹配的剧集',
    'confirm.delete': '确定删除「{title}」吗？',
    'import.confirm': '将导入 {count} 条记录，是否覆盖现有数据？\n选择「取消」则合并导入。',
    'import.success': '导入成功！',
    'import.failed': '导入失败，请检查文件格式。',
    'export.filename': '追番记录_{date}.json',
    'lang.switch': 'EN',
    'lang.switchTitle': 'Switch to English',
  },
};

const I18n = {
  lang: 'en',
  listeners: [],

  init() {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && MESSAGES[saved]) {
      this.lang = saved;
    } else {
      this.lang = navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }
    this.applyDocumentLang();
    this.applyStatic();
  },

  onChange(fn) {
    this.listeners.push(fn);
  },

  t(key, vars = {}) {
    let str = MESSAGES[this.lang][key] ?? MESSAGES.en[key] ?? key;
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
    return str;
  },

  getLang() {
    return this.lang;
  },

  setLang(lang) {
    if (!MESSAGES[lang] || this.lang === lang) return;
    this.lang = lang;
    localStorage.setItem(LANG_KEY, lang);
    this.applyDocumentLang();
    this.applyStatic();
    this.listeners.forEach((fn) => fn(lang));
  },

  toggleLang() {
    this.setLang(this.lang === 'en' ? 'zh' : 'en');
  },

  applyDocumentLang() {
    document.documentElement.lang = this.lang === 'zh' ? 'zh-CN' : 'en';
    document.title = this.t('app.title');
  },

  applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (key) el.textContent = this.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = this.t(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = this.t(el.dataset.i18nHtml);
    });
    document.querySelectorAll('#drama-status option').forEach((opt) => {
      opt.textContent = this.t(`status.${opt.value}`);
    });
  },

  formatTime(date = new Date()) {
    const locale = this.lang === 'zh' ? 'zh-CN' : 'en-US';
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  },
};

function t(key, vars) {
  return I18n.t(key, vars);
}
