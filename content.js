(() => {
  'use strict';

  // ── Enabled state ─────────────────────────────────────────────────────────
  let enabled = true;

  // Appliquer immédiatement (défaut = actif), puis corriger depuis le storage
  setActiveClass(true);
  chrome.storage.local.get('enabled', r => {
    enabled = r.enabled !== false;
    setActiveClass(enabled);
    if (!enabled) { clearCells(); hideBar(); }
  });

  // Toggle en temps réel via message du background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== 'SS_TOGGLE') return;
    enabled = msg.enabled;
    setActiveClass(enabled);
    if (!enabled) { clearCells(); hideBar(); }
  });

  // Fallback : storage.onChanged (si message non reçu)
  chrome.storage.onChanged.addListener((changes) => {
    if (!('enabled' in changes)) return;
    enabled = changes.enabled.newValue !== false;
    setActiveClass(enabled);
    if (!enabled) { clearCells(); hideBar(); }
  });

  // ── CSS (cell highlight + cursor, conditionné à .__ss-on__) ──────────────────
  (() => {
    const s = document.createElement('style');
    s.textContent = `
      .__ss-on__ .__ss-cell__ {
        background: rgba(26,115,232,.15) !important;
        outline: 1.5px solid #1a73e8 !important;
        outline-offset: -1px !important;
      }
      .__ss-on__ table td,
      .__ss-on__ table th { cursor: cell; }
    `;
    (document.head || document.documentElement).appendChild(s);
  })();

  function setActiveClass(on) {
    document.documentElement.classList.toggle('__ss-on__', on);
  }

  // ── Bar ────────────────────────────────────────────────────────────────────
  let bar      = null;
  let statsSpan = null;
  let copyBtn   = null;
  let feedbackTimer = null;

  function getBar() {
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = '__sel-stats__';
    Object.assign(bar.style, {
      position:      'fixed',
      zIndex:        '2147483647',
      background:    '#1a73e8',
      color:         '#fff',
      font:          '700 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      letterSpacing: '.2px',
      padding:       '5px 8px',
      borderRadius:  '5px',
      boxShadow:     '0 2px 10px rgba(0,0,0,.35)',
      whiteSpace:    'nowrap',
      userSelect:    'none',
      display:       'none',
      alignItems:    'center',
      gap:           '8px',
    });

    statsSpan = document.createElement('span');
    statsSpan.style.pointerEvents = 'none';
    bar.appendChild(statsSpan);

    copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    Object.assign(copyBtn.style, {
      background:   'rgba(255,255,255,.22)',
      border:       '1px solid rgba(255,255,255,.5)',
      borderRadius: '3px',
      color:        '#fff',
      font:         '700 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      cursor:       'pointer',
      padding:      '3px 7px',
      flexShrink:   '0',
    });
    copyBtn.addEventListener('mouseenter', () => {
      copyBtn.style.background = 'rgba(255,255,255,.35)';
    });
    copyBtn.addEventListener('mouseleave', () => {
      copyBtn.style.background = 'rgba(255,255,255,.22)';
    });
    copyBtn.addEventListener('click', e => {
      e.stopPropagation();
      copySelection();
    });
    bar.appendChild(copyBtn);

    document.documentElement.appendChild(bar);
    return bar;
  }

  function showBar(text, rect, showCopy) {
    const el = getBar();
    statsSpan.textContent    = text;
    copyBtn.style.display    = showCopy ? 'inline-block' : 'none';
    el.style.display         = 'flex';
    el.style.transform       = '';

    const bw = el.offsetWidth;
    const bh = el.offsetHeight;
    const M  = 8;

    if (rect && (rect.width || rect.height)) {
      let top  = rect.top - bh - M;
      if (top < M) top = rect.bottom + M;
      let left = rect.left + (rect.width - bw) / 2;
      left = Math.max(M, Math.min(left, window.innerWidth - bw - M));
      el.style.top  = `${top}px`;
      el.style.left = `${left}px`;
    } else {
      el.style.top       = `${M}px`;
      el.style.left      = '50%';
      el.style.transform = 'translateX(-50%)';
    }
  }

  function hideBar() {
    if (bar) bar.style.display = 'none';
  }

  function flashCopied() {
    const orig = statsSpan.textContent;
    statsSpan.textContent = '✓ Copied!';
    copyBtn.style.display = 'none';
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      statsSpan.textContent = orig;
      if (activeCells.size) copyBtn.style.display = 'inline-block';
    }, 1200);
  }

  // ── Number parsing ─────────────────────────────────────────────────────────
  function normalise(raw) {
    const commas = (raw.match(/,/g) || []).length;
    const dots   = (raw.match(/\./g) || []).length;

    if (commas > 0 && dots > 0) {
      return raw.lastIndexOf(',') > raw.lastIndexOf('.')
        ? raw.replace(/\./g, '').replace(',', '.')  // 1.234,56 → 1234.56
        : raw.replace(/,/g, '');                    // 1,234.56 → 1234.56
    }
    if (commas === 1) {
      return raw.split(',')[1].length === 3 ? raw.replace(',', '') : raw.replace(',', '.');
    }
    if (dots === 1) {
      return raw.split('.')[1].length === 3 ? raw.replace('.', '') : raw;
    }
    if (commas > 1) return raw.replace(/,/g, '');
    if (dots   > 1) return raw.replace(/\./g, '');
    return raw;
  }

  function parseNumbers(text) {
    const out = [];
    for (const m of (text.match(/-?\d[\d,.]*/g) || [])) {
      const n = parseFloat(normalise(m));
      if (!isNaN(n) && isFinite(n)) out.push(n);
    }
    return out;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  function statsLabel(nums) {
    if (!nums.length) return null;
    let sum = 0, min = nums[0], max = nums[0];
    for (const n of nums) {
      sum += n;
      if (n < min) min = n;
      if (n > max) max = n;
    }
    return `count: ${nums.length} | sum: ${r2(sum)} | avg: ${r2(sum / nums.length)} | min: ${r2(min)} | max: ${r2(max)}`;
  }

  // ── Cell selection ─────────────────────────────────────────────────────────
  // Modèle : la sélection affichée = baseCells (plages déjà validées via Ctrl)
  // combinée à rangeCells (la plage en cours de définition par drag / Shift).
  // dragMode indique si la plage en cours ajoute ou retire des cellules.
  const CLS = '__ss-cell__';
  let isDragging    = false;
  let dragMode      = 'add';      // 'add' | 'remove'
  let anchorCell    = null;       // ancre de la plage en cours
  let lastHoverCell = null;       // dernière cellule survolée pendant le drag
  let baseCells     = new Set();  // plages validées par les Ctrl+clic précédents
  let rangeCells    = [];         // plage en cours
  let activeCells   = new Set();  // résultat affiché (ordre = ordre du document)

  function toCell(el) { return el?.closest('td,th') || null; }

  function sameTable(a, b) {
    return a && b && a.closest('table') && a.closest('table') === b.closest('table');
  }

  function cellPos(cell) {
    const table = cell.closest('table');
    if (!table) return null;
    return {
      table,
      row: Array.from(table.rows).indexOf(cell.parentElement),
      col: Array.from(cell.parentElement.cells).indexOf(cell),
    };
  }

  function rangeOf(a, b) {
    const pa = cellPos(a), pb = cellPos(b);
    if (!pa || !pb || pa.table !== pb.table) return [a];
    const r0 = Math.min(pa.row, pb.row), r1 = Math.max(pa.row, pb.row);
    const c0 = Math.min(pa.col, pb.col), c1 = Math.max(pa.col, pb.col);
    const out = [];
    for (let r = r0; r <= r1; r++) {
      const row = pa.table.rows[r];
      if (!row) continue;
      for (let c = c0; c <= c1; c++) {
        if (row.cells[c]) out.push(row.cells[c]);
      }
    }
    return out;
  }

  // Trier dans l'ordre du document : indispensable dès que la sélection est
  // composée de plusieurs plages saisies dans un ordre quelconque.
  function docOrder(cells) {
    return cells.sort((a, b) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1
    );
  }

  function composeSelection() {
    const out = new Set(baseCells);
    if (dragMode === 'remove') {
      for (const c of rangeCells) out.delete(c);
    } else {
      for (const c of rangeCells) out.add(c);
    }
    return docOrder([...out]);
  }

  function applyHighlight(cells) {
    for (const c of activeCells) c.classList.remove(CLS);
    activeCells = new Set(cells);
    for (const c of cells) c.classList.add(CLS);
  }

  // Recalcule sélection + surbrillance + barre à partir de base/range
  function refreshSelection() {
    const cells = composeSelection();
    applyHighlight(cells);
    if (cells.length) updateFromCells(cells);
    else hideBar();
  }

  function updateFromCells(cells) {
    const text  = cells.map(c => c.innerText).join('\n');
    const nums  = parseNumbers(text);
    const label = statsLabel(nums);
    if (!label) { hideBar(); return; }

    // Bounding rect englobant toutes les cellules sélectionnées
    const rects = cells.map(c => c.getBoundingClientRect());
    const rect  = {
      top:    Math.min(...rects.map(r => r.top)),
      bottom: Math.max(...rects.map(r => r.bottom)),
      left:   Math.min(...rects.map(r => r.left)),
      right:  Math.max(...rects.map(r => r.right)),
    };
    rect.width  = rect.right  - rect.left;
    rect.height = rect.bottom - rect.top;
    showBar(label, rect, true);
  }

  // ── Copy (TSV – colle directement dans Excel / Sheets) ────────────────────
  function buildTSV(cells) {
    // Regrouper les cellules par ligne de tableau (cells déjà en ordre document)
    const rows = new Map();
    for (const cell of cells) {
      const row = cell.parentElement;
      if (!rows.has(row)) rows.set(row, []);
      const val = cell.innerText.trim();
      // TSV : si le contenu contient \n ou \t ou ", on l'encadre de guillemets
      rows.get(row).push(/[\n\t"]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val);
    }
    return [...rows.values()].map(r => r.join('\t')).join('\n');
  }

  function copySelection() {
    if (!activeCells.size) return;
    const tsv = buildTSV([...activeCells]);
    navigator.clipboard.writeText(tsv).then(flashCopied).catch(() => {
      // Fallback execCommand pour les pages qui bloquent l'API Clipboard
      const ta = document.createElement('textarea');
      ta.value = tsv;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      flashCopied();
    });
  }

  function clearCells() {
    applyHighlight([]);
    baseCells     = new Set();
    rangeCells    = [];
    anchorCell    = null;
    lastHoverCell = null;
    dragMode      = 'add';
    isDragging    = false;
  }

  // ── Text selection (fallback hors tableau) ─────────────────────────────────
  let textTimer = null;
  let lastText  = '';

  function updateFromText() {
    if (activeCells.size) return;               // cellules actives → priorité
    const sel  = window.getSelection();
    const text = sel?.toString() || '';
    if (text === lastText) return;
    lastText = text;
    if (!text.trim()) { hideBar(); return; }
    const label = statsLabel(parseNumbers(text));
    if (!label) { hideBar(); return; }
    try {
      showBar(label, sel.getRangeAt(0).getBoundingClientRect(), false);
    } catch (_) {
      showBar(label, null, false);
    }
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  document.addEventListener('mousedown', e => {
    if (!enabled || e.button !== 0) return;
    // Clic sur la barre de stats → ne pas effacer la sélection
    if (bar && bar.contains(e.target)) return;

    const cell = toCell(e.target);
    if (!cell) {
      // Clic hors tableau → effacer la sélection de cellules
      if (activeCells.size) { clearCells(); hideBar(); }
      return;
    }

    const additive = e.ctrlKey || e.metaKey;   // Ctrl (Win/Linux) ou Cmd (Mac)
    const extend   = e.shiftKey;

    if (extend && anchorCell && sameTable(anchorCell, cell)) {
      // Shift+clic → redéfinir la plage courante depuis l'ancre existante,
      // sans toucher aux plages déjà validées. dragMode est conservé : si la
      // plage en cours retirait des cellules, Shift étend ce retrait.
      rangeCells = rangeOf(anchorCell, cell);
    } else if (additive) {
      // Ctrl+clic → valider la sélection courante, puis ouvrir une plage.
      // Si la cellule cliquée est déjà sélectionnée, la plage retire au lieu
      // d'ajouter (même logique qu'Excel).
      baseCells  = new Set(composeSelection());
      dragMode   = baseCells.has(cell) ? 'remove' : 'add';
      anchorCell = cell;
      rangeCells = [cell];
    } else {
      // Clic simple → repartir de zéro
      baseCells  = new Set();
      dragMode   = 'add';
      anchorCell = cell;
      rangeCells = [cell];
    }

    lastHoverCell = cell;
    isDragging    = true;
    refreshSelection();
    // Empêcher la sélection de texte pendant le drag
    document.documentElement.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!enabled || !isDragging || !anchorCell) return;
    const cell = toCell(e.target);
    if (!cell || cell === lastHoverCell) return;
    lastHoverCell = cell;
    rangeCells    = rangeOf(anchorCell, cell);
    refreshSelection();
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.documentElement.style.userSelect = '';
    if (!enabled) return;
    if (!activeCells.size) updateFromText();
  });

  // Ctrl/Cmd/Shift + clic dans une cellule : neutraliser le comportement natif
  // (ouverture d'un lien dans un nouvel onglet, handlers de la page, etc.)
  document.addEventListener('click', e => {
    if (!enabled) return;
    if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
    if (!toCell(e.target)) return;
    if (bar && bar.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.addEventListener('selectionchange', () => {
    if (!enabled || activeCells.size) return;
    clearTimeout(textTimer);
    textTimer = setTimeout(updateFromText, 60);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activeCells.size) {
      clearCells();
      hideBar();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && activeCells.size) {
      e.preventDefault();
      copySelection();
    }
  });
})();
