// node --test
const test   = require('node:test');
const assert = require('node:assert/strict');
const { normalize, isExcluded, DEFAULTS } = require('../settings.js');

test('normalize : valeurs par défaut et validation', () => {
  assert.deepEqual(normalize(null), { ...DEFAULTS, stats: [...DEFAULTS.stats], excluded: [...DEFAULTS.excluded] });
  const s = normalize({ stats: ['max', 'bogus', 'sum'], decimals: 42, locale: 'xx_invalid!', excluded: ['  HTTPS://*.Example.com/ ', 3, ''] });
  assert.deepEqual(s.stats, ['sum', 'max']);       // ordre canonique, clés inconnues retirées
  assert.equal(s.decimals, 6);
  assert.equal(s.locale, 'auto');
  assert.deepEqual(s.excluded, ['example.com']);
  assert.equal(normalize({ decimals: 1.5 }).decimals, 2);
  assert.equal(normalize({ locale: 'fr-FR' }).locale, 'fr-FR');
});

test('isExcluded', () => {
  const list = DEFAULTS.excluded;
  assert.equal(isExcluded('https://docs.google.com/spreadsheets/d/abc/edit', list), true);
  assert.equal(isExcluded('https://docs.google.com/forms/d/abc', list), false);
  assert.equal(isExcluded('https://www.notion.so/page', list), true);
  assert.equal(isExcluded('https://notion.so.evil.com/', list), false);
  assert.equal(isExcluded('https://mynotion.so/', list), false);
  assert.equal(isExcluded('https://docs.google.com/spreadsheetsX', list), false);
  assert.equal(isExcluded('file:///C:/test.html', list), false);
  assert.equal(isExcluded('not a url', list), false);
});
