'use strict';

// Sahte RD/AD API'leriyle uçtan uca test.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const SECRET = 'testsecret12345';
const PORT = 7123;
process.env.ADDON_SECRET = SECRET;
process.env.PORT = String(PORT);
process.env.RD_TOKEN = 'rd';
process.env.AD_KEY = 'ad';
delete process.env.UPSTASH_REDIS_REST_URL;
fs.rmSync(path.join(__dirname, '..', 'data'), { recursive: true, force: true });

const json = (data, headers = {}) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json', ...headers } });
globalThis.fetch = async (input, opts = {}) => {
  const url = new URL(String(input));
  if (url.host === 'api.real-debrid.com') {
    if (url.pathname.endsWith('/torrents')) {
      return json([{ id: 'ABC', filename: 'MobLand.S02.1080p', bytes: 5e9, status: 'downloaded', added: '2026-11-01T00:00:00Z' }], { 'x-total-count': '1' });
    }
    if (url.pathname.endsWith('/torrents/info/ABC')) {
      return json({
        files: [
          { id: 1, path: '/MobLand.S02E01.1080p.mkv', bytes: 2e9, selected: 1 },
          { id: 2, path: '/MobLand.S02E02.1080p.mkv', bytes: 2e9, selected: 1 },
          { id: 3, path: '/sample.mkv', bytes: 1e7, selected: 1 },
        ],
        links: ['https://rd/l1', 'https://rd/l2', 'https://rd/l3'],
      });
    }
    if (url.pathname.endsWith('/unrestrict/link')) return json({ download: 'https://download.rd/file.mkv' });
  }
  if (url.host === 'api.alldebrid.com') {
    if (url.pathname === '/v4.1/magnet/status') return json({ status: 'error', error: { code: 'X', message: 'yok' } });
    if (url.pathname === '/v4/magnet/status') {
      return json({ status: 'success', data: { magnets: [{ id: 42, filename: 'Nosferatu (2024)', size: 8e9, statusCode: 4, completionDate: 1763000000 }] } });
    }
    if (url.pathname === '/v4/magnet/files') {
      return json({ status: 'success', data: { magnets: [{ id: 42, files: [{ n: 'Nosferatu', e: [{ n: 'Nosferatu.2024.2160p.DV.mkv', s: 8e9, l: 'https://ad/l1' }, { n: 'info.nfo', s: 1, l: 'https://ad/nfo' }] }] }] } });
    }
    if (url.pathname === '/v4/link/unlock') return json({ status: 'success', data: { link: 'https://download.ad/file.mkv' } });
  }
  throw new Error('beklenmeyen istek ' + url);
};

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers: { 'content-type': 'application/json' } }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d && res.headers['content-type']?.includes('json') ? JSON.parse(d) : d }));
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

require('../src/server');
test.after(() => setImmediate(() => process.exit(process.exitCode || 0)));
const S = `/${SECRET}`;

test('gizli anahtar olmadan erişim yok', async () => {
  assert.strictEqual((await req('GET', '/manifest.json')).status, 404);
});

test('katalog, meta, stream, play ve playlist akışı', async () => {
  await new Promise((r) => setTimeout(r, 100));
  const man = (await req('GET', `${S}/manifest.json`)).body;
  assert.strictEqual(man.catalogs.length, 1);

  const cat = (await req('GET', `${S}/catalog/series/dk-folders.json`)).body;
  assert.deepStrictEqual(cat.metas.map((m) => m.id), ['dk:rd:ABC', 'dk:ad:42']);

  const search = (await req('GET', `${S}/catalog/series/dk-folders/search=mob.json`)).body;
  assert.deepStrictEqual(search.metas.map((m) => m.id), ['dk:rd:ABC']);
  const genre = (await req('GET', `${S}/catalog/series/dk-folders/genre=AD.json`)).body;
  assert.deepStrictEqual(genre.metas.map((m) => m.id), ['dk:ad:42']);

  const meta = (await req('GET', `${S}/meta/series/dk:rd:ABC.json`)).body.meta;
  assert.strictEqual(meta.videos.length, 2, 'sample hariç');
  assert.strictEqual(meta.videos[0].id, 'dk:rd:ABC:1');

  const adMeta = (await req('GET', `${S}/meta/series/dk:ad:42.json`)).body.meta;
  assert.strictEqual(adMeta.videos.length, 1);
  assert.strictEqual(adMeta.name, 'Nosferatu (2024)');

  const st = (await req('GET', `${S}/stream/series/dk:ad:42:0.json`)).body.streams;
  assert.strictEqual(st.length, 1);
  assert.match(st[0].name, /4K DV/);
  const playPath = new URL(st[0].url).pathname;
  const play = await req('GET', playPath);
  assert.strictEqual(play.status, 302);
  assert.strictEqual(play.headers.location, 'https://download.ad/file.mkv');

  const rdPlay = await req('GET', `${S}/play/rd/ABC/2`);
  assert.strictEqual(rdPlay.headers.location, 'https://download.rd/file.mkv');

  const list = (await req('POST', `${S}/api/lists`, { name: 'Favoriler' })).body;
  await req('POST', `${S}/api/lists/${list.id}/items`, { key: 'rd:ABC:2', name: 'MobLand.S02E02.1080p.mkv' });
  const man2 = (await req('GET', `${S}/manifest.json`)).body;
  assert.strictEqual(man2.catalogs[1].name, '⭐ Favoriler');
  const lc = (await req('GET', `${S}/catalog/series/dk-list-${list.id}.json`)).body;
  assert.strictEqual(lc.metas[0].id, 'dk:rd:ABC:2');
  const single = (await req('GET', `${S}/meta/series/dk:rd:ABC:2.json`)).body.meta;
  assert.strictEqual(single.videos.length, 1);
  assert.strictEqual(single.name, 'MobLand.S02E02.1080p.mkv');

  await req('DELETE', `${S}/api/lists/${list.id}/items/rd:ABC:2`);
  assert.strictEqual((await req('GET', `${S}/api/lists`)).body[0].items.length, 0);

  const ui = await req('GET', `${S}/`);
  assert.match(ui.body, /Debrid Kitaplığım/);
  setImmediate(() => process.exit(0));
});
