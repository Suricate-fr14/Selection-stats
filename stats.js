// Calcul et mise en forme des statistiques.
// Chargé avant content.js ; exporté aussi pour Node (tests).
(function (g) {
  'use strict';

  // Ordre d'affichage des indicateurs dans la barre
  const STAT_KEYS = ['cells', 'count', 'sum', 'avg', 'min', 'max', 'median', 'stddev', 'distinct'];

  const LABELS = {
    fr: {
      cells: 'cellules', count: 'nb', sum: 'somme', avg: 'moy', min: 'min', max: 'max',
      median: 'médiane', stddev: 'écart-type', distinct: 'distincts',
      copy: 'Copier', copied: '✓ Copié', copyFailed: 'Échec de la copie',
    },
    en: {
      cells: 'cells', count: 'count', sum: 'sum', avg: 'avg', min: 'min', max: 'max',
      median: 'median', stddev: 'stddev', distinct: 'distinct',
      copy: 'Copy', copied: '✓ Copied!', copyFailed: 'Copy failed',
    },
  };

  function labelsFor(locale) {
    return /^fr\b/i.test(locale || '') ? LABELS.fr : LABELS.en;
  }

  function computeStats(nums) {
    const n = nums.length;
    if (!n) return null;
    let sum = 0, min = nums[0], max = nums[0];
    for (const x of nums) {
      sum += x;
      if (x < min) min = x;
      if (x > max) max = x;
    }
    const avg    = sum / n;
    const sorted = [...nums].sort((a, b) => a - b);
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    // Écart-type d'échantillon (ÉCARTYPE / STDEV.S des tableurs)
    let sq = 0;
    for (const x of nums) sq += (x - avg) ** 2;
    const stddev   = n > 1 ? Math.sqrt(sq / (n - 1)) : null;
    const distinct = new Set(nums).size;
    return { count: n, sum, avg, min, max, median, stddev, distinct };
  }

  const formatters = new Map();
  function formatter(locale, opts) {
    const key = locale + JSON.stringify(opts);
    if (!formatters.has(key)) {
      let f;
      try { f = new Intl.NumberFormat(locale, opts); }
      catch (_) { f = new Intl.NumberFormat('en-US', opts); }
      formatters.set(key, f);
    }
    return formatters.get(key);
  }

  function formatNumber(x, locale, decimals) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    // Valeur non nulle qui s'afficherait 0 (ex. 0,001 avec 2 décimales) :
    // 3 chiffres significatifs plutôt qu'un 0 trompeur
    if (x !== 0 && Math.abs(x) < 0.5 * 10 ** -decimals) {
      return formatter(locale, { maximumSignificantDigits: 3 }).format(x);
    }
    return formatter(locale, { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(x);
  }

  // cells : nombre de cellules non vides (null hors sélection de cellules)
  // stats : résultat de computeStats (null si aucun nombre)
  // show  : indicateurs à afficher ; renvoie null si rien à afficher
  function buildLabel({ cells = null, stats = null }, { show, decimals, locale }) {
    const L = labelsFor(locale);
    const parts = [];
    for (const key of STAT_KEYS) {
      if (!show.includes(key)) continue;
      if (key === 'cells') {
        if (cells !== null) parts.push(`${L.cells}: ${formatNumber(cells, locale, 0)}`);
        continue;
      }
      if (!stats || stats[key] === null) continue;
      const d = key === 'count' || key === 'distinct' ? 0 : decimals;
      parts.push(`${L[key]}: ${formatNumber(stats[key], locale, d)}`);
    }
    return parts.length ? parts.join(' | ') : null;
  }

  const api = { STAT_KEYS, labelsFor, computeStats, formatNumber, buildLabel };
  g.SSStats = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
