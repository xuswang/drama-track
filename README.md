# Drama Track

A lightweight web app to track which episode you're on for TV shows, anime, and dramas. Works offline locally, with optional encrypted cross-device sync via Cloudflare.

**Live demo:** https://drama-track.pages.dev

## Features

- Add, edit, and delete shows
- One-tap +1 / −1 episode controls
- Progress bar with percentage
- Filter by status: Watching / Completed / On hold
- Search by title
- Export / import JSON backup
- **Cross-device sync** (AES-encrypted, Cloudflare Workers + KV)
- **English & Chinese UI** with language preference saved in browser

## Quick start

### Use the hosted version

Open https://drama-track.pages.dev, tap **Sync**, and set a passphrase. Use the same passphrase on every device.

### Run locally

```bash
git clone https://github.com/xuswang/drama-track.git
cd drama-track
python3 -m http.server 8080
```

Visit http://localhost:8080

> Sync requires HTTP (not `file://`). Deploy to Cloudflare Pages for the best experience on mobile.

## Self-hosting sync (optional)

### 1. Deploy the Cloudflare Worker

```bash
npm install -g wrangler
wrangler login

cd worker
npm install
wrangler kv namespace create DRAMA_SYNC
# Copy the namespace id into worker/wrangler.toml
npm run deploy
```

### 2. Configure the frontend

```bash
cp config.example.js config.js
```

Edit `config.js`:

```javascript
window.SYNC_CONFIG = {
  apiUrl: 'https://drama-track-sync.your-subdomain.workers.dev',
};
```

### 3. Deploy to Cloudflare Pages

**Option A — Connect GitHub (recommended):**

1. Open [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. Select **drama-track** → **Settings** → **Builds & deployments**
3. Connect **GitHub** → choose `xuswang/drama-track` → branch `main`
4. Build command: leave empty · Output directory: `/`
5. Every push to `main` deploys automatically

**Option B — Manual deploy:**

```bash
wrangler pages deploy . --project-name=drama-track
```

**Option C — GitHub Actions:**

Add repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (account ID is already set). The workflow in `.github/workflows/deploy.yml` will deploy on push.

## Language

- Default: English (or Chinese if your browser language is Chinese)
- Toggle **EN / 中文** in the top-right corner
- Your choice is saved in `localStorage` and persists across visits

## Data & privacy

- **Local data** is stored in browser `localStorage`
- **Cloud data** is AES-encrypted client-side before upload — the server only stores ciphertext
- Your sync passphrase is the encryption key — don't lose it
- Export JSON regularly as a backup

## Project structure

```
drama-track/
├── index.html
├── app.js              # App logic
├── i18n.js             # EN / ZH translations
├── sync.js             # Cloud sync module
├── config.example.js   # API config template
└── worker/             # Cloudflare Worker backend
```

## License

MIT — see [LICENSE](LICENSE)

## Contributing

Issues and pull requests welcome! Fork the repo, deploy your own Worker + Pages instance, and customize as you like.
