// ── Icon ─────────────────────────────────────────────────────────────────────
function iconSet(state) {
  return {
    16: `icons/${state}-16.png`,
    32: `icons/${state}-32.png`,
    48: `icons/${state}-48.png`,
  };
}

function applyIcon(enabled) {
  chrome.action.setIcon({ path: iconSet(enabled ? 'on' : 'off') });
  chrome.action.setTitle({
    title: `Selection Stats — ${enabled ? 'Actif' : 'Désactivé'} (clic droit → Options)`
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
        if (tab.id == null) continue;
        chrome.tabs.sendMessage(tab.id, { type: 'SS_TOGGLE', enabled: next })
          .catch(() => {}); // onglet sans content script → ignorer
      }
    });
  });
});
