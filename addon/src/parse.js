'use strict';

// Dosya / torrent adlarından film-dizi bilgisi çıkarır.

const VIDEO_EXT = /\.(mkv|mp4|avi|m4v|ts|m2ts|mov|wmv|webm|mpg|mpeg)$/i;
const QUALITY_TOKEN = /\b(2160p|1080p|720p|576p|480p|4k|uhd|bluray|blu ray|brrip|bdrip|web ?dl|webrip|web|hdtv|dvdrip|remux|x264|x265|h ?264|h ?265|hevc|avc|hdr10?\+?|hdr|dv|dovi|proper|repack|extended|unrated|imax|multi|dual|turkish|tr|dublaj|altyaz[iı]|10bit|ddp?5 1|atmos|truehd|dts)\b/i;

function isVideo(name) {
  return VIDEO_EXT.test(name) && !/(^|[\s._-])sample([\s._-]|$)/i.test(name);
}

function basename(p) {
  return String(p).split(/[\\/]/).pop();
}

function cleanup(raw) {
  let name = basename(raw).replace(VIDEO_EXT, '');
  name = name
    .replace(/^\[[^\]]*\]\s*-?\s*/, '') // [site] - ...
    .replace(/^www\.\S+\s*-\s*/i, '') // www.site.com - ...
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name;
}

function tidyTitle(t) {
  return t
    .replace(/[\s\-\[\(\{]+$/, '')
    .replace(/^[\s\-\]\)\}]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitYear(title) {
  // "Show (2021)" / "Show 2021" -> { title: 'Show', year: 2021 }
  const m = title.match(/^(.*?)[\s(\[]*((?:19|20)\d{2})[)\]]?$/);
  if (m && m[1].trim()) return { title: tidyTitle(m[1]), year: +m[2] };
  return { title: tidyTitle(title), year: null };
}

function parseName(raw) {
  const clean = cleanup(raw);
  const maxYear = new Date().getFullYear() + 1;
  let m;

  // Bölüm: S02E05, S02E05E06, S02 E05
  m = clean.match(/^(.*?)\bS(\d{1,2}) ?E(\d{1,3})\b/i);
  if (m && m[1].trim()) {
    const { title, year } = splitYear(tidyTitle(m[1]));
    return { type: 'series', title, year, season: +m[2], episode: +m[3] };
  }
  // Bölüm: 2x05
  m = clean.match(/^(.*?)\b(\d{1,2})x(\d{2,3})\b/i);
  if (m && m[1].trim()) {
    const { title, year } = splitYear(tidyTitle(m[1]));
    return { type: 'series', title, year, season: +m[2], episode: +m[3] };
  }
  // Sezon paketi: S02, Season 2, Sezon 2
  m = clean.match(/^(.*?)\b(?:S(\d{1,2})|Season ?(\d{1,2})|Sezon ?(\d{1,2}))\b/i);
  if (m && m[1].trim()) {
    const { title, year } = splitYear(tidyTitle(m[1]));
    return { type: 'series', title, year, season: +(m[2] || m[3] || m[4]), episode: null };
  }
  // Tüm dizi paketi
  m = clean.match(/^(.*?)\b(?:complete series|the complete|complete|tum sezonlar|tüm sezonlar)\b/i);
  if (m && m[1].trim() && !/\b(?:19|20)\d{2}\b/.test(m[1])) {
    const { title, year } = splitYear(tidyTitle(m[1]));
    return { type: 'series', title, year, season: null, episode: null };
  }

  // Film: son geçerli yıl, başlıktan sonra gelen
  const years = [...clean.matchAll(/\b((?:19|20)\d{2})\b/g)];
  for (let i = years.length - 1; i >= 0; i--) {
    const y = +years[i][1];
    const before = tidyTitle(clean.slice(0, years[i].index));
    if (before && y >= 1900 && y <= maxYear) {
      return { type: 'movie', title: before, year: y, season: null, episode: null };
    }
  }

  // Yıl yok: ilk kalite etiketine kadar
  const q = clean.match(QUALITY_TOKEN);
  const title = tidyTitle(q && q.index > 0 ? clean.slice(0, q.index) : clean);
  return { type: 'movie', title, year: null, season: null, episode: null };
}

// Sezon paketi içindeki dosyadan bölüm numarası ("E05", "Episode 5", "Bölüm 5", "05 - Ad")
function episodeFromFile(raw) {
  const clean = cleanup(raw);
  const m =
    clean.match(/\bE(\d{1,3})\b/i) ||
    clean.match(/\b(?:Episode|Ep|B[öo]l[üu]m)\s?(\d{1,3})\b/i) ||
    clean.match(/^(\d{1,3})\b/);
  return m ? +m[1] : null;
}

function normalizeKey(title) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function qualityLabel(name) {
  const n = cleanup(name);
  const parts = [];
  if (/\b(2160p|4k|uhd)\b/i.test(n)) parts.push('4K');
  else if (/\b1080p\b/i.test(n)) parts.push('1080p');
  else if (/\b720p\b/i.test(n)) parts.push('720p');
  if (/\b(dv|dovi|dolby ?vision)\b/i.test(n)) parts.push('DV');
  if (/\bhdr10\+|hdr10plus\b/i.test(n)) parts.push('HDR10+');
  else if (/\bhdr(10)?\b/i.test(n)) parts.push('HDR');
  if (/\bremux\b/i.test(n)) parts.push('REMUX');
  if (/\b(dts|dts ?hd|dts ?x)\b/i.test(n)) parts.push('DTS');
  return parts.join(' ');
}

function formatSize(bytes) {
  if (!bytes) return '';
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

module.exports = { isVideo, basename, parseName, episodeFromFile, normalizeKey, qualityLabel, formatSize };
