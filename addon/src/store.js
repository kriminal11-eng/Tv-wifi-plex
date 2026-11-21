'use strict';

// Playlist deposu: Upstash Redis (ücretsiz, kalıcı) varsa onu, yoksa yerel dosyayı kullanır.

const fs = require('fs');
const path = require('path');

const KEY = 'debrid-kitaplik:lists';

function createStore({ upstashUrl, upstashToken, file }) {
  let cache = null;

  async function upstash(cmd) {
    const res = await fetch(upstashUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${upstashToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    const json = await res.json();
    if (json.error) throw new Error(`Upstash: ${json.error}`);
    return json.result;
  }

  async function load() {
    if (cache) return cache;
    let raw = null;
    if (upstashUrl) raw = await upstash(['GET', KEY]);
    else if (fs.existsSync(file)) raw = fs.readFileSync(file, 'utf8');
    cache = raw ? JSON.parse(raw) : { lists: [] };
    return cache;
  }

  async function save(data) {
    cache = data;
    const raw = JSON.stringify(data);
    if (upstashUrl) await upstash(['SET', KEY, raw]);
    else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, raw);
    }
  }

  const newId = () => Math.random().toString(36).slice(2, 8);

  return {
    persistent: Boolean(upstashUrl),
    async lists() {
      return (await load()).lists;
    },
    async createList(name) {
      const data = await load();
      const list = { id: newId(), name: String(name).slice(0, 60), items: [] };
      data.lists.push(list);
      await save(data);
      return list;
    },
    async renameList(id, name) {
      const data = await load();
      const l = data.lists.find((x) => x.id === id);
      if (l) l.name = String(name).slice(0, 60);
      await save(data);
    },
    async deleteList(id) {
      const data = await load();
      data.lists = data.lists.filter((x) => x.id !== id);
      await save(data);
    },
    async addItem(id, item) {
      const data = await load();
      const l = data.lists.find((x) => x.id === id);
      if (!l) throw new Error('Liste yok');
      if (!l.items.some((x) => x.key === item.key)) l.items.unshift({ key: item.key, name: String(item.name || '').slice(0, 300) });
      await save(data);
    },
    async removeItem(id, key) {
      const data = await load();
      const l = data.lists.find((x) => x.id === id);
      if (l) l.items = l.items.filter((x) => x.key !== key);
      await save(data);
    },
  };
}

module.exports = { createStore };
