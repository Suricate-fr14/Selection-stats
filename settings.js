// Réglages : valeurs par défaut, validation, exclusion de sites.
// Partagé par content.js et options.js ; exporté aussi pour Node (tests).
(function (g) {
  'use strict';

  const STAT_KEYS = ['cells', 'count', 'sum', 'avg', 'min', 'max', 'median', 'stddev', 'distinct'];

  const DEFAULTS = Object.freeze({
    stats:    ['cells', 'count', 'sum', 'avg', 'min', 'max'],
    decimals: 2,
    locale:   'auto',
    // Sites ayant leur propre sélection de cellules
    excluded: [
      'docs.google.com/spreadsheets',
      'docs.google.com/document',
      'docs.google.com/presentation',
      'airtable.com',
      'notion.so',
      'app.smartsheet.com',
    ],
  });

  const MAX_EXCLUDED = 200;

  function validLocale(l) {
    if (l === 'auto') return true;
    try { return Intl.NumberFormat.supportedLocalesOf([l]).length > 0; }
    catch (_) { return false; }
  }

  // Toute valeur lue du stockage passe par ici : types et bornes garantis
  function normalize(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const stats = Array.isArray(s.stats)
      ? STAT_KEYS.filter(k => s.stats.includes(k))
      : [...DEFAULTS.stats];
    const d = Number.isInteger(s.decimals) ? s.decimals : DEFAULTS.decimals;
    const decimals = Math.max(0, Math.min(6, d));
    const locale = typeof s.locale === 'string' && validLocale(s.locale) ? s.locale : DEFAULTS.locale;
    const excluded = Array.isArray(s.excluded)
      ? s.excluded.filter(x => typeof x === 'string').map(cleanEntry).filter(Boolean).slice(0, MAX_EXCLUDED)
      : [...DEFAULTS.excluded];
    return { stats, decimals, locale, excluded };
  }

  // « https://*.Example.com/path/ » → « example.com/path »
  function cleanEntry(entry) {
    return entry.trim().toLowerCase()
      .replace(/^[a-z]+:\/\//, '')
      .replace(/^\*\./, '')
      .replace(/\/+$/, '');
  }

  // Entrée « domaine[/chemin] » : le domaine couvre ses sous-domaines,
  // le chemin est un préfixe (docs.google.com/spreadsheets)
  function isExcluded(href, list) {
    let url;
    try { url = new URL(href); } catch (_) { return false; }
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    return list.some(raw => {
      const entry = cleanEntry(raw);
      if (!entry) return false;
      const i = entry.indexOf('/');
      const h = i < 0 ? entry : entry.slice(0, i);
      const p = i < 0 ? ''    : entry.slice(i);
      if (host !== h && !host.endsWith('.' + h)) return false;
      return !p || path === p || path.startsWith(p + '/');
    });
  }

  function resolveLocale(locale, fallback) {
    return locale === 'auto' ? (fallback || 'en-US') : locale;
  }

  const api = { STAT_KEYS, DEFAULTS, normalize, isExcluded, cleanEntry, resolveLocale };
  g.SSSettings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
