'use strict';

// AllDebrid: API sürüm farklarına dayanıklı yazıldı (v4.1 ve v4 denenir).

const { isVideo } = require('../parse');

const API = 'https://api.alldebrid.com';

function createAllDebrid(apikey, agent = 'debrid-kitaplik') {
  const filesCache = new Map();
  const linksFromStatus = new Map();
  let statusRoute = null;

  async function call(path, { method = 'GET', params = {} } = {}) {
    const url = new URL(API + path);
    url.searchParams.set('agent', agent);
    url.searchParams.set('apikey', apikey);
    let body;
    if (method === 'GET') {
      for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(`${k}[]`, x));
        else url.searchParams.set(k, v);
      }
    } else {
      body = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) v.forEach((x) => body.append(`${k}[]`, x));
        else body.set(k, v);
      }
    }
    const res = await fetch(url, { method, body, headers: { Authorization: `Bearer ${apikey}` } });
    const json = await res.json().catch(() => null);
    if (!json || json.status !== 'success') {
      const err = json && json.error ? `${json.error.code} ${json.error.message}` : `HTTP ${res.status}`;
      throw new Error(`AllDebrid ${path}: ${err}`);
    }
    return json.data;
  }

  async function listMagnets() {
    const routes = statusRoute ? [statusRoute] : [['/v4.1/magnet/status', 'POST'], ['/v4/magnet/status', 'GET']];
    let lastErr;
    for (const [path, method] of routes) {
      try {
        const data = await call(path, { method });
        statusRoute = [path, method];
        const m = data.magnets;
        return Array.isArray(m) ? m : Object.values(m || {});
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  async function getFolders() {
    const magnets = await listMagnets();
    return magnets
      .filter((m) => m.statusCode === 4 || m.status === 'Ready')
      .map((m) => {
        if (Array.isArray(m.links) && m.links.length) linksFromStatus.set(String(m.id), m.links);
        const ts = m.completionDate || m.uploadDate || 0;
        return { provider: 'ad', id: String(m.id), name: m.filename, size: m.size, added: ts * 1000 };
      });
  }

  function flatten(nodes, prefix, out) {
    for (const n of nodes || []) {
      const path = prefix ? `${prefix}/${n.n}` : n.n;
      if (n.e) flatten(n.e, path, out);
      else if (n.l) out.push({ name: n.n, path, size: n.s || 0, link: n.l });
    }
    return out;
  }

  async function getFiles(id) {
    if (filesCache.has(id)) return filesCache.get(id);
    let raw;
    const fromStatus = linksFromStatus.get(id);
    if (fromStatus) {
      raw = fromStatus.map((l) => ({ name: l.filename, path: l.filename, size: l.size || 0, link: l.link }));
    } else {
      const data = await call('/v4/magnet/files', { method: 'POST', params: { id: [id] } });
      const entry = (data.magnets || []).find((m) => String(m.id) === id) || (data.magnets || [])[0];
      if (entry && entry.error) throw new Error(`AllDebrid files: ${entry.error.message || entry.error.code}`);
      raw = flatten(entry ? entry.files : [], '', []);
    }
    const files = raw.map((f, i) => ({ key: String(i), ...f })).filter((f) => isVideo(f.name));
    filesCache.set(id, files);
    return files;
  }

  async function resolve(link) {
    const data = await call('/v4/link/unlock', { params: { link } });
    if (!data.link) throw new Error('AllDebrid: link henüz hazır değil');
    return data.link;
  }

  return { key: 'ad', label: 'AD', getFolders, getFiles, resolve };
}

module.exports = { createAllDebrid };
