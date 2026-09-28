// ── Icon generation ──────────────────────────────────────────────────────────
function makeIcon(size, color) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const r      = size / 2 - 1;
  const c      = size / 2;

  // Fond transparent + cercle coloré
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Lettre "S" blanche au centre
  ctx.fillStyle = '#fff';
  ctx.font      = `bold ${Math.round(size * 0.55)}px sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', c, c + 0.5);

  return ctx.getImageData(0, 0, size, size);
}

function applyIcon(enabled) {
  const color = enabled ? '#22c55e' : '#ef4444';
  chrome.action.setIcon({
    imageData: { 16: makeIcon(16, color), 32: makeIcon(32, color) }
  });
  chrome.action.setTitle({
    title: `Selection Stats — ${enabled ? 'Actif' : 'Désactivé'}`
  });
}

// ── State helpers ─────────────────────────────────────────────────────────────
function getEnabled(cb) {
  chrome.storage.local.get('enabled', r => cb(r.enabled !== false));
}

// ── Init ──────────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  getEnabled(applyIcon);
});

// Restaurer l'icône au redémarrage du service worker
chrome.runtime.onStartup.addListener(() => {
  getEnabled(applyIcon);
});

// ── Toggle on icon click ──────────────────────────────────────────────────────
chrome.action.onClicked.addListener(() => {
  getEnabled(enabled => {
    const next = !enabled;
    chrome.storage.local.set({ enabled: next });
    applyIcon(next);
    // Notifier tous les onglets ouverts
    chrome.tabs.query({}, tabs => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'SS_TOGGLE', enabled: next })
          .catch(() => {}); // onglet sans content script → ignorer
      }
    });
  });
});
