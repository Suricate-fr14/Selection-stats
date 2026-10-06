// node --test
const test   = require('node:test');
const assert = require('node:assert/strict');
const { computeStats, formatNumber, buildLabel } = require('../stats.js');

const nbsp = s => s.replace(/[\u00a0\u202f]/g, ' ');

test('computeStats', () => {
  assert.equal(computeStats([]), null);
  const s = computeStats([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(s.count, 8);
  assert.equal(s.sum, 40);
  assert.equal(s.avg, 5);
  assert.equal(s.median, 4.5);
  assert.equal(s.distinct, 5);
  assert.ok(Math.abs(s.stddev - 2.13809) < 1e-5);  // écart-type d'échantillon
  assert.equal(computeStats([3]).stddev, null);
  assert.equal(computeStats([3, 1, 2]).median, 2);
});

test('formatNumber : locale et décimales', () => {
  assert.equal(nbsp(formatNumber(1234.567, 'fr-FR', 2)), '1 234,57');
  assert.equal(formatNumber(1234.567, 'en-US', 2), '1,234.57');
  assert.equal(formatNumber(1234.5, 'de-DE', 0), '1.235');
  assert.equal(formatNumber(12, 'fr-FR', 2), '12');
  assert.equal(nbsp(formatNumber(0.001234, 'fr-FR', 2)), '0,00123');  // pas de 0 trompeur
  assert.equal(formatNumber(-0.004, 'en-US', 2), '-0.004');
  assert.equal(formatNumber(0, 'en-US', 2), '0');
  assert.equal(formatNumber(0.1 + 0.2, 'en-US', 2), '0.3');
  assert.equal(formatNumber(null, 'en-US', 2), '—');
});

test('buildLabel', () => {
  const stats = computeStats([1, 2, 3]);
  const all = ['cells', 'count', 'sum', 'avg', 'min', 'max', 'median', 'stddev', 'distinct'];
  assert.equal(
    buildLabel({ cells: 5, stats }, { show: all, decimals: 2, locale: 'fr-FR' }),
    'cellules: 5 | nb: 3 | somme: 6 | moy: 2 | min: 1 | max: 3 | médiane: 2 | écart-type: 1 | distincts: 3'
  );
  assert.equal(
    buildLabel({ stats }, { show: ['cells', 'sum'], decimals: 2, locale: 'en-US' }),
    'sum: 6'
  );
  assert.equal(buildLabel({ cells: 2, stats: null }, { show: ['cells', 'sum'], decimals: 2, locale: 'en' }), 'cells: 2');
  assert.equal(buildLabel({ stats: null }, { show: ['sum'], decimals: 2, locale: 'en' }), null);
});
