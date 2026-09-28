// Extraction des nombres d'un texte ou d'une cellule.
// Chargé avant content.js (même monde isolé) ; exporté aussi pour Node (tests).
(function (g) {
  'use strict';

  // Séparateurs de milliers « espace » : insécable, fine insécable, fine,
  // apostrophe (format suisse).
  const GROUP_SEP = '\\u00a0\\u202f\\u2009\'’';

  const NUM =
    // 1 234 567,89 avec espaces insécables / apostrophes
    `\\d{1,3}(?:[${GROUP_SEP}]\\d{3})+(?:[.,]\\d+)?` +
    // 1 234,56 avec espaces normales : uniquement avec virgule décimale,
    // sinon « 10 200 » dans un texte serait ambigu (liste ou nombre)
    `|\\d{1,3}(?: \\d{3})+,\\d+` +
    // cas général : 1234 / 1,234.56 / 1.234,56 / 12,5
    `|\\d[\\d,.]*\\d|\\d`;

  // (1) parenthèse ouvrante, (2) signe, (3) nombre, (4) parenthèse fermante.
  // Pas de chiffre ni de lettre collé avant : exclut A4, v2, H2O…
  const TOKEN = new RegExp(
    `(?<![\\p{L}\\p{N}.,])(\\(\\s*)?([-−+])?(${NUM})(\\s*\\))?`,
    'gu'
  );

  // Dates (2024-01-15, 15/01/2024, 15.01.2024) et heures (12:30, 12:30:45)
  const DATE_TIME =
    /(?<![\p{N}])(?:\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}:\d{2}(?::\d{2})?)(?![\p{N}])/gu;

  // Préfixe / suffixe tolérés autour d'un nombre dans une cellule :
  // symbole monétaire, %, ‰ ou unité courte (kg, EUR, h, m²…)
  const AFFIX = /^\s*(?:\p{Sc}|%|‰|\p{L}{1,4}[²³]?\.?)?\s*$/u;

  // Virgule décimale selon la langue de la page : true / false / null (inconnu)
  function commaDecimalFor(lang) {
    if (!lang) return null;
    try {
      return new Intl.NumberFormat(lang).format(1.5).includes(',');
    } catch (_) {
      return null;
    }
  }

  function normalise(raw, commaDecimal) {
    // Nombre groupé par espaces / apostrophes : le [.,] restant est décimal
    if (new RegExp(`[ ${GROUP_SEP}]`).test(raw)) {
      return raw.replace(new RegExp(`[ ${GROUP_SEP}]`, 'g'), '').replace(',', '.');
    }

    const commas = (raw.match(/,/g) || []).length;
    const dots   = (raw.match(/\./g) || []).length;

    if (commas > 0 && dots > 0) {
      return raw.lastIndexOf(',') > raw.lastIndexOf('.')
        ? raw.replace(/\./g, '').replace(',', '.')  // 1.234,56 → 1234.56
        : raw.replace(/,/g, '');                    // 1,234.56 → 1234.56
    }
    if (commas === 1) {
      // 1,234 : ambigu. Langue à virgule décimale → 1.234, sinon milliers.
      const thousands = raw.split(',')[1].length === 3 && commaDecimal !== true;
      return thousands ? raw.replace(',', '') : raw.replace(',', '.');
    }
    if (dots === 1) {
      // 1.234 : ambigu. Langue à point décimal → 1.234, sinon milliers.
      const thousands = raw.split('.')[1].length === 3 && commaDecimal !== false;
      return thousands ? raw.replace('.', '') : raw;
    }
    if (commas > 1) return raw.replace(/,/g, '');
    if (dots   > 1) return raw.replace(/\./g, '');
    return raw;
  }

  function* tokens(text, commaDecimal) {
    const clean = text.replace(DATE_TIME, ' ');
    TOKEN.lastIndex = 0;
    let m;
    while ((m = TOKEN.exec(clean))) {
      const [all, open, sign, num, close] = m;
      let n = parseFloat(normalise(num, commaDecimal));
      if (!isFinite(n)) continue;
      let start = m.index, end = m.index + all.length;
      // Parenthèses comptables (123) → -123 ; une seule parenthèse → ignorée
      if (open && close) n = -n;
      else if (open) start += open.length;
      else if (close) end -= close.length;
      if (sign && /[-−]/.test(sign)) n = -n;
      yield { n, start, end, clean };
    }
  }

  // Sélection de texte libre : tous les nombres trouvés
  function parseNumbers(text, commaDecimal = null) {
    const out = [];
    for (const t of tokens(text, commaDecimal)) out.push(t.n);
    return out;
  }

  // Cellule de tableau : un seul nombre, entouré au plus d'un symbole
  // monétaire, d'un % ou d'une unité courte. Sinon (texte, date, « iPhone 15 »)
  // la cellule n'est pas numérique → null.
  function parseCell(text, commaDecimal = null) {
    let found = null;
    for (const t of tokens(text, commaDecimal)) {
      if (found) return null;
      found = t;
    }
    if (!found) return null;
    const before = found.clean.slice(0, found.start);
    const after  = found.clean.slice(found.end);
    return AFFIX.test(before) && AFFIX.test(after) ? found.n : null;
  }

  const api = { parseNumbers, parseCell, commaDecimalFor };
  g.SSParse = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
