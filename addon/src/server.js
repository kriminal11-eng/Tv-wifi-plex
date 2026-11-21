'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createRealDebrid } = require('./providers/realdebrid');
const { createAllDebrid } = require('./providers/alldebrid');
const { createStore } = require('./store');
const { qualityLabel, formatSize } = require('./parse');

// ---- Ayarlar (ortam değişkenleri) ----
const env = process.env;
const PORT = +env.PORT || 7000;
const SECRET = env.ADDON_SECRET;
if (!SECRET || SECRET.length < 12) {
  console.error('ADDON_SECRET en az 12 karakter olmalı (eklenti adresini gizli tutar).');
  process.exit(1);
}

const providers = {};
if (env.RD_TOKEN) providers.rd = createRealDebrid(env.RD_TOKEN);
if (env.AD_KEY) providers.ad = createAllDebrid(env.AD_KEY);
if (!Object.keys(providers).length) {
  console.error('RD_TOKEN veya AD_KEY girilmeli.');
  process.exit(1);
}

const store = createStore({
  upstashUrl: /^https:\/\//.test(env.UPSTASH_REDIS_REST_URL || '') ? env.UPSTASH_REDIS_REST_URL : null,
  upstashToken: env.UPSTASH_REDIS_REST_TOKEN,
  file: path.join(__dirname, '..', 'data', 'lists.json'),
});

const UI_HTML = fs.readFileSync(path.join(__dirname, 'ui.html'), 'utf8');
const PAGE = 100;
const PREFIX = 'dk';

// ---- Klasör listesi (kısa önbellek) ----
let foldersCache = { at: 0, items: [], errors: [] };
async function allFolders(force = false) {
  if (!force && Date.now() - foldersCache.at < 2 * 60 * 1000) return foldersCache;
  const errors = [];
  const results = await Promise.all(
    Object.values(providers).map((p) =>
      p.getFolders().catch((e) => {
        console.warn(`[${p.label}]`, e.message);
        errors.push(`${p.label}: ${e.message}`);
        return [];
      })
    )
  );
  const items = results.flat().sort((a, b) => b.added - a.added);
  foldersCache = { at: Date.now(), items, errors };
  return foldersCache;
}

// ---- Kimlikler: dk:rd:<klasör> veya dk:rd:<klasör>:<dosya> ----
function parseId(id) {
  const [pfx, prov, folder, file] = String(id).split(':');
  if (pfx !== PREFIX || !providers[prov] || !folder) return null;
  return { prov, folder, file: file ?? null };
}

function folderMeta(f) {
  const label = providers[f.provider].label;
  return {
    id: `${PREFIX}:${f.provider}:${f.id}`,
    type: 'series',
    name: f.name,
    posterShape: 'landscape',
    description: `${label} · ${formatSize(f.size)} · ${new Date(f.added).toLocaleDateString('tr-TR')}`,
    releaseInfo: label,
  };
}

function itemMeta(item) {
  const p = parseId(`${PREFIX}:${item.key}`);
  return {
    id: `${PREFIX}:${item.key}`,
    type: 'series',
    name: item.name || item.key,
    posterShape: 'landscape',
    description: p ? providers[p.prov].label : '',
  };
}

async function manifest() {
  const lists = await store.lists();
  const genres = Object.values(providers).map((p) => p.label);
  return {
    id: 'community.debrid.kitaplik',
    version: '0.2.0',
    name: 'Debrid Kitaplığım',
    description: 'Real-Debrid / AllDebrid klasörleriniz ve playlistleriniz',
    resources: [
      'catalog',
      { name: 'meta', types: ['series'], idPrefixes: [`${PREFIX}:`] },
      { name: 'stream', types: ['series'], idPrefixes: [`${PREFIX}:`] },
    ],
    types: ['series'],
    idPrefixes: [`${PREFIX}:`],
    catalogs: [
      {
        type: 'series',
        id: 'dk-folders',
        name: '📁 Klasörlerim',
        extra: [{ name: 'search' }, { name: 'skip' }, { name: 'genre', options: genres }],
      },
      ...lists.map((l) => ({ type: 'series', id: `dk-list-${l.id}`, name: `⭐ ${l.name}`, extra: [{ name: 'skip' }] })),
    ],
    behaviorHints: { configurable: false },
  };
}

async function catalog(id, extra) {
  const skip = +extra.skip || 0;
  if (id === 'dk-folders') {
    let { items } = await allFolders();
    if (extra.genre) items = items.filter((f) => providers[f.provider].label === extra.genre);
    if (extra.search) {
      const q = extra.search.toLowerCase();
      items = items.filter((f) => f.name.toLowerCase().includes(q));
    }
    return { metas: items.slice(skip, skip + PAGE).map(folderMeta) };
  }
  if (id.startsWith('dk-list-')) {
    const list = (await store.lists()).find((l) => `dk-list-${l.id}` === id);
    return { metas: list ? list.items.slice(skip, skip + PAGE).map(itemMeta) : [] };
  }
  return { metas: [] };
}

async function folderName(prov, folder) {
  const f = (await allFolders()).items.find((x) => x.provider === prov && x.id === folder);
  return f ? f.name : folder;
}

async function meta(id) {
  const p = parseId(id);
  if (!p) return null;
  const files = await providers[p.prov].getFiles(p.folder);
  const chosen = p.file === null ? files : files.filter((f) => f.key === p.file);
  const sorted = [...chosen].sort((a, b) => a.path.localeCompare(b.path, 'tr', { numeric: true }));
  const name = p.file !== null && chosen[0] ? chosen[0].name : await folderName(p.prov, p.folder);
  return {
    id,
    type: 'series',
    name,
    posterShape: 'landscape',
    description: `${providers[p.prov].label} · ${sorted.length} video`,
    videos: sorted.map((f, i) => ({
      id: `${PREFIX}:${p.prov}:${p.folder}:${f.key}`,
      title: f.name,
      season: 1,
      episode: i + 1,
      released: new Date(0).toISOString(),
      overview: [qualityLabel(f.name), formatSize(f.size)].filter(Boolean).join(' · '),
    })),
  };
}

async function streams(id, base) {
  const p = parseId(id);
  if (!p) return [];
  const files = await providers[p.prov].getFiles(p.folder);
  const list = p.file === null ? files : files.filter((f) => f.key === p.file);
  return list.map((f) => ({
    name: `${providers[p.prov].label}\n${qualityLabel(f.name) || 'Video'}`,
    title: `${f.name}\n💾 ${formatSize(f.size)}`,
    url: `${base}/play/${p.prov}/${encodeURIComponent(p.folder)}/${encodeURIComponent(f.key)}`,
    behaviorHints: { notWebReady: true, bingeGroup: `dk-${p.prov}-${p.folder}` },
  }));
}

// ---- HTTP ----
function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function parseExtra(str) {
  const out = {};
  if (!str) return out;
  for (const part of str.split('&')) {
    const [k, v = ''] = part.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'health') return send(res, 200, { ok: true });
  if (parts[0] !== SECRET) return send(res, 404, { error: 'not found' });

  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0];
  const base = `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}/${SECRET}`;
  const rest = parts.slice(1).map(decodeURIComponent);
  const route = rest.join('/');
  const m = (re) => route.match(re);
  let r;

  // Stremio
  if (route === 'manifest.json') return send(res, 200, await manifest());
  if ((r = m(/^catalog\/series\/([^/]+?)(?:\/(.+))?\.json$/))) return send(res, 200, await catalog(r[1], parseExtra(r[2])));
  if ((r = m(/^meta\/series\/(.+)\.json$/))) {
    const mt = await meta(r[1]);
    return mt ? send(res, 200, { meta: mt }) : send(res, 404, { meta: null });
  }
  if ((r = m(/^stream\/series\/(.+)\.json$/))) return send(res, 200, { streams: await streams(r[1], base) });
  if (rest[0] === 'play' && rest.length === 4) {
    const [, prov, folder, key] = rest;
    if (!providers[prov]) return send(res, 404, { error: 'provider' });
    const f = (await providers[prov].getFiles(folder)).find((x) => x.key === key);
    if (!f) return send(res, 404, { error: 'dosya yok' });
    const link = await providers[prov].resolve(f.link);
    res.writeHead(302, { Location: link, 'Cache-Control': 'no-store' });
    return res.end();
  }

  // Yönetim sayfası + API
  if (route === '') return send(res, 200, UI_HTML, 'text/html; charset=utf-8');
  if (route === 'api/info') {
    return send(res, 200, {
      manifestUrl: `${base}/manifest.json`,
      persistent: store.persistent,
      providers: Object.values(providers).map((p) => p.label),
    });
  }
  if (route === 'api/folders') {
    const c = await allFolders(url.searchParams.get('refresh') === '1');
    return send(res, 200, { items: c.items, errors: c.errors });
  }
  if ((r = m(/^api\/files\/(rd|ad)\/(.+)$/)) && providers[r[1]]) {
    const files = await providers[r[1]].getFiles(r[2]);
    return send(res, 200, files.map(({ link, ...f }) => f));
  }
  if (route === 'api/lists' && req.method === 'GET') return send(res, 200, await store.lists());
  if (route === 'api/lists' && req.method === 'POST') {
    const b = await readBody(req);
    if (!b.name) return send(res, 400, { error: 'isim gerekli' });
    return send(res, 200, await store.createList(b.name));
  }
  if ((r = m(/^api\/lists\/([a-z0-9]+)$/))) {
    if (req.method === 'DELETE') await store.deleteList(r[1]);
    if (req.method === 'POST') await store.renameList(r[1], (await readBody(req)).name);
    return send(res, 200, { ok: true });
  }
  if ((r = m(/^api\/lists\/([a-z0-9]+)\/items$/)) && req.method === 'POST') {
    const b = await readBody(req);
    if (!b.key) return send(res, 400, { error: 'key gerekli' });
    await store.addItem(r[1], b);
    return send(res, 200, { ok: true });
  }
  if ((r = m(/^api\/lists\/([a-z0-9]+)\/items\/(.+)$/)) && req.method === 'DELETE') {
    await store.removeItem(r[1], r[2]);
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'not found' });
}

http
  .createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) send(res, 500, { error: e.message });
    });
  })
  .listen(PORT, () => {
    console.log(`Debrid Kitaplığım çalışıyor: http://localhost:${PORT}/${SECRET.slice(0, 3)}…/`);
    console.log(`Sağlayıcılar: ${Object.values(providers).map((p) => p.label).join(', ')} | Liste deposu: ${store.persistent ? 'Upstash' : 'yerel dosya'}`);
  });
