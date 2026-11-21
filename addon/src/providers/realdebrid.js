'use strict';

const { isVideo, basename } = require('../parse');

const API = 'https://api.real-debrid.com/rest/1.0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createRealDebrid(token) {
  const filesCache = new Map();

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
      const text = res.status === 204 ? '' : await res.text();
      if (!res.ok) throw new Error(`RealDebrid ${path}: ${res.status} ${text.slice(0, 200)}`);
      return { data: text ? JSON.parse(text) : null, res };
    }
    throw new Error(`RealDebrid ${path}: tekrar denemeler başarısız`);
  }

  // Klasör listesi (torrentler) — dosya detayı olmadan, hızlı
  async function getFolders() {
    const all = [];
    for (let page = 1; page < 50; page++) {
      const { data, res } = await call(`/torrents?page=${page}&limit=500`);
      if (!data || !data.length) break;
      all.push(...data);
      const total = +res.headers.get('x-total-count') || 0;
      if (all.length >= total || data.length < 500) break;
    }
    return all
      .filter((t) => t.status === 'downloaded')
      .map((t) => ({ provider: 'rd', id: t.id, name: t.filename, size: t.bytes, added: Date.parse(t.added) || 0 }));
  }

  // Bir klasörün içindeki videolar
  async function getFiles(id) {
    if (filesCache.has(id)) return filesCache.get(id);
    const { data: info } = await call(`/torrents/info/${id}`);
    const selected = (info.files || []).filter((f) => f.selected === 1).sort((a, b) => a.id - b.id);
    const links = info.links || [];
    let files = [];
    if (selected.length === links.length) {
      files = selected.map((f, i) => ({ key: String(f.id), name: basename(f.path), path: f.path, size: f.bytes, link: links[i] }));
    } else if (links.length === 1 && selected.length) {
      const big = [...selected].sort((a, b) => b.bytes - a.bytes)[0];
      files = [{ key: String(big.id), name: basename(big.path), path: big.path, size: big.bytes, link: links[0] }];
    }
    files = files.filter((f) => isVideo(f.path));
    filesCache.set(id, files);
    return files;
  }

  async function resolve(link) {
    const { data } = await call('/unrestrict/link', {
      method: 'POST',
      body: new URLSearchParams({ link }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data.download;
  }

  return { key: 'rd', label: 'RD', getFolders, getFiles, resolve };
}

module.exports = { createRealDebrid };
