'use strict';

const { isVideo } = require('../parse');

const API = 'https://api.real-debrid.com/rest/1.0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createRealDebrid(token, cache) {
  async function call(path, opts = {}) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(API + path, {
        ...opts,
        headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (res.status === 204) return { data: null, res };
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(`RealDebrid ${path}: ${res.status} ${text.slice(0, 200)}`);
      return { data, res };
    }
    throw new Error(`RealDebrid ${path}: tekrar denemeler başarısız`);
  }

  async function listTorrents() {
    const all = [];
    for (let page = 1; page < 100; page++) {
      const { data, res } = await call(`/torrents?page=${page}&limit=500`);
      if (!data || !data.length) break;
      all.push(...data);
      const total = +res.headers.get('x-total-count') || 0;
      if (all.length >= total || data.length < 500) break;
    }
    return all.filter((t) => t.status === 'downloaded');
  }

  async function torrentFiles(t) {
    const cached = cache.get('rd', t.id);
    if (cached) return cached;

    const { data: info } = await call(`/torrents/info/${t.id}`);
    await sleep(250); // rate limit dostu
    const selected = (info.files || []).filter((f) => f.selected === 1).sort((a, b) => a.id - b.id);
    const links = info.links || [];
    let files = [];
    if (selected.length === links.length) {
      files = selected.map((f, i) => ({ key: String(f.id), path: f.path, size: f.bytes, link: links[i] }));
    } else if (links.length === 1 && selected.length >= 1) {
      // Tek link: en büyük dosya (rar değilse) — oynatılabilirliği unrestrict anında anlaşılır
      const biggest = [...selected].sort((a, b) => b.bytes - a.bytes)[0];
      files = [{ key: String(biggest.id), path: biggest.path, size: biggest.bytes, link: links[0] }];
    }
    files = files.filter((f) => isVideo(f.path));
    cache.set('rd', t.id, files);
    return files;
  }

  async function getLibrary() {
    const torrents = await listTorrents();
    const out = [];
    for (const t of torrents) {
      try {
        const files = await torrentFiles(t);
        if (files.length) {
          out.push({ provider: 'rd', id: t.id, name: t.filename, added: Date.parse(t.added) || 0, files });
        }
      } catch (e) {
        console.warn('[RD]', t.filename, e.message);
      }
    }
    cache.prune('rd', new Set(torrents.map((t) => t.id)));
    return out;
  }

  async function resolve(link) {
    const body = new URLSearchParams({ link });
    const { data } = await call('/unrestrict/link', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data.download;
  }

  return { name: 'RD', getLibrary, resolve };
}

module.exports = { createRealDebrid };
