// node --test tests/
const test   = require('node:test');
const assert = require('node:assert/strict');
const { parseNumbers, parseCell, commaDecimalFor } = require('../parse.js');

test('texte : formats de nombres', () => {
  const cases = [
    ['1 234,56', [1234.56]],             // espace normale + virgule décimale
    ['1 234,56', [1234.56]],        // fine insécable
    ['1 234 567', [1234567]],  // insécable
    ["1'234.50", [1234.5]],              // suisse
    ['1,234.56 et 1.234,56', [1234.56, 1234.56]],
    ['12,5 %', [12.5]],
    ['−12', [-12]],                      // moins typographique
    ['(123)', [-123]],                   // négatif comptable
    ['-4 et +5', [-4, 5]],
    ['10-20', [10, 20]],                 // intervalle, pas -20
    ['total 12.', [12]],
    ['A4 v2 H2O', []],                   // chiffres collés à des lettres
    ['10 200', [10, 200]],               // espace normale sans décimale : deux nombres
  ];
  for (const [t, want] of cases) assert.deepEqual(parseNumbers(t), want, t);
});

test('texte : dates et heures ignorées', () => {
  assert.deepEqual(parseNumbers('2024-01-15'), []);
  assert.deepEqual(parseNumbers('le 15/01/2024 à 12:30, 42 €'), [42]);
  assert.deepEqual(parseNumbers('15.01.2024'), []);
});

test('ambiguïté 1,234 / 1.234 selon la langue', () => {
  assert.deepEqual(parseNumbers('1,234'), [1234]);          // langue inconnue
  assert.deepEqual(parseNumbers('1,234', true), [1.234]);   // fr
  assert.deepEqual(parseNumbers('1.234', true), [1234]);
  assert.deepEqual(parseNumbers('1.234', false), [1.234]);  // en
  assert.deepEqual(parseNumbers('1,234', false), [1234]);
  assert.equal(commaDecimalFor('fr-FR'), true);
  assert.equal(commaDecimalFor('en-US'), false);
  assert.equal(commaDecimalFor(''), null);
  assert.equal(commaDecimalFor('!!'), null);
});

test('cellule : uniquement les cellules numériques', () => {
  const cases = [
    ['12,50', 12.5],
    ['1 234,56 €', 1234.56],
    ['$ 1,234.50', 1234.5],
    ['-3', -3],
    ['(45)', -45],
    ['12 kg', 12],
    ['EUR 10', 10],
    ['15 %', 15],
    ['2024', 2024],
    ['iPhone 15', null],
    ['Widget 3', null],
    ['2024-01-15', null],
    ['12:30', null],
    ['entre 10 et 20', null],
    ['N/A', null],
    ['', null],
  ];
  for (const [t, want] of cases) assert.equal(parseCell(t), want, t);
});
