(() => {
  'use strict';

  const NAMES = {
    cells: 'Cellules (non vides)', count: 'Nombre de valeurs', sum: 'Somme',
    avg: 'Moyenne', min: 'Minimum', max: 'Maximum',
    median: 'Médiane', stddev: 'Écart-type', distinct: 'Valeurs distinctes',
  };

  const $ = id => document.getElementById(id);
  const statsBox = $('stats');

  for (const key of SSSettings.STAT_KEYS) {
    const label = document.createElement('label');
    const box   = document.createElement('input');
    box.type  = 'checkbox';
    box.value = key;
    label.append(box, ' ', NAMES[key]);
    statsBox.appendChild(label);
  }

  function render(s) {
    for (const box of statsBox.querySelectorAll('input')) box.checked = s.stats.includes(box.value);
    $('decimals').value = s.decimals;
    $('locale').value   = s.locale;
    $('excluded').value = s.excluded.join('\n');
  }

  function read() {
    return SSSettings.normalize({
      stats:    [...statsBox.querySelectorAll('input:checked')].map(b => b.value),
      decimals: parseInt($('decimals').value, 10),
      locale:   $('locale').value,
      excluded: $('excluded').value.split('\n'),
    });
  }

  let statusTimer = null;
  function status(text) {
    $('status').textContent = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { $('status').textContent = ''; }, 2000);
  }

  function save(s) {
    chrome.storage.sync.set({ settings: s }, () => {
      if (chrome.runtime.lastError) { status(`Erreur : ${chrome.runtime.lastError.message}`); return; }
      render(s);
      status('Enregistré');
    });
  }

  chrome.storage.sync.get('settings', r => render(SSSettings.normalize(r && r.settings)));
  $('save').addEventListener('click', () => save(read()));
  $('reset').addEventListener('click', () => save(SSSettings.normalize(null)));
})();
