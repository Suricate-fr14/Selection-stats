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
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (sender.id !== chrome.runtime.id) return;
    if (!msg || msg.type !== 'SS_TOGGLE' || typeof msg.enabled !== 'boolean') return;
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
  let bar      = null;           // hôte (dans le DOM de la page)
  let statsSpan = null;           // éléments internes : shadow root fermé,
  let lastLabel = '';
  let copyBtn   = null;
  let feedbackTimer = null;

  function getBar() {
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = '__sel-stats__';
    // Shadow root fermé : la page ne peut ni lire, ni restyler, ni
    // manipuler le contenu de la barre (bouton Copy compris).
    const root  = bar.attachShadow({ mode: 'closed' });
    const inner = document.createElement('div');
    root.appendChild(inner);
    Object.assign(bar.style, {
      position:      'fixed',
      zIndex:        '2147483647',
      display:       'none',
    });
    Object.assign(inner.style, {
      background:    '#1a73e8',
      color:         '#fff',
      font:          '700 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      letterSpacing: '.2px',
      padding:       '5px 8px',
      borderRadius:  '5px',
      boxShadow:     '0 2px 10px rgba(0,0,0,.35)',
      whiteSpace:    'nowrap',
      userSelect:    'none',
      display:       'flex',
      alignItems:    'center',
      gap:           '8px',
    });

    statsSpan = document.createElement('span');
    statsSpan.style.pointerEvents = 'none';
    inner.appendChild(statsSpan);

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
      // Ignorer les clics synthétiques déclenchés par la page
      if (!e.isTrusted) return;
      copySelection();
    });
    inner.appendChild(copyBtn);

    document.documentElement.appendChild(bar);
    return bar;
  }

  // Source de la position de la barre : 'cells' | 'text' | null
  let barSource = null;

  function showBar(text, source) {
    const el = getBar();
    clearTimeout(feedbackTimer);
    lastLabel                = text;
    statsSpan.textContent    = text;
    copyBtn.style.display    = source === 'cells' ? 'inline-block' : 'none';
    el.style.display         = 'block';
    barSource                = source;
    positionBar();
  }

  // Rectangle englobant de ce que la barre décrit, en coordonnées viewport
  function sourceRect() {
    if (barSource === 'cells') {
      // (boucle plutôt que Math.min(...arr) : évite un RangeError sur de très
      // grandes sélections)
      const rect = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity };
      for (const c of activeCells) {
        const r = c.getBoundingClientRect();
        if (r.top    < rect.top)    rect.top    = r.top;
        if (r.bottom > rect.bottom) rect.bottom = r.bottom;
        if (r.left   < rect.left)   rect.left   = r.left;
        if (r.right  > rect.right)  rect.right  = r.right;
      }
      if (rect.top === Infinity) return null;
      rect.width  = rect.right  - rect.left;
      rect.height = rect.bottom - rect.top;
      return rect;
    }
    if (barSource === 'text') {
      try { return window.getSelection().getRangeAt(0).getBoundingClientRect(); }
      catch (_) { return null; }
    }
    return null;
  }

  function positionBar() {
    if (!bar || bar.style.display === 'none') return;
    const el   = bar;
    const rect = sourceRect();
    el.style.transform = '';

    const bw = el.offsetWidth;
    const bh = el.offsetHeight;
    const M  = 8;

    if (rect && (rect.width || rect.height)) {
      let top  = rect.top - bh - M;
      if (top < M) top = rect.bottom + M;
      // Rester dans la fenêtre même si la sélection en sort au défilement
      top = Math.max(M, Math.min(top, window.innerHeight - bh - M));
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

  // Suivre le défilement (page ou conteneur interne) et le redimensionnement
  let posFrame = 0;
  function schedulePosition() {
    if (posFrame) return;
    posFrame = requestAnimationFrame(() => {
      posFrame = 0;
      // Défilement pendant un glisser (molette, clavier, bord de fenêtre) :
      // la cellule sous le pointeur change sans mousemove → étendre la plage
      if (isDragging) extendDragAt(lastX, lastY);
      positionBar();
    });
  }
  window.addEventListener('scroll', schedulePosition, { capture: true, passive: true });
  window.addEventListener('resize', schedulePosition, { passive: true });

  function hideBar() {
    if (bar) bar.style.display = 'none';
    barSource = null;
  }

  function flashCopied(ok = true) {
    statsSpan.textContent = ok ? '✓ Copied!' : 'Copy failed';
    copyBtn.style.display = 'none';
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      statsSpan.textContent = lastLabel;
      if (activeCells.size) copyBtn.style.display = 'inline-block';
    }, 1200);
  }

  // ── Number parsing (parse.js) ──────────────────────────────────────────
  // Virgule ou point décimal selon la langue déclarée par la page (lève
  // l'ambiguïté de « 1,234 » / « 1.234 ») ; null si la page n'en déclare pas.
  const commaDecimal = SSParse.commaDecimalFor(document.documentElement.lang);
  const parseNumbers = text => SSParse.parseNumbers(text, commaDecimal);
  const parseCell    = text => SSParse.parseCell(text, commaDecimal);

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
    // Toute cellule non vide compte (texte compris, comme dans un tableur) ;
    // somme, moyenne, min et max portent sur les cellules numériques.
    // La barre reste affichée même sans nombre, pour garder le bouton Copy.
    let filled = 0;
    const nums = [];
    for (const c of cells) {
      const text = c.innerText.trim();
      if (!text) continue;
      filled++;
      const n = parseCell(text);
      if (n !== null) nums.push(n);
    }
    const stats = statsLabel(nums);
    showBar(`cells: ${filled}` + (stats ? ` | ${stats}` : ''), 'cells');
  }

  // ── Copy (TSV – colle directement dans Excel / Sheets) ────────────────────
  // Injection de formule (CSV/TSV injection) : un contenu de page commençant
  // par = + - @ serait interprété comme formule une fois collé dans un tableur
  // (ex. =HYPERLINK(...), DDE). On le neutralise avec une apostrophe, sauf
  // pour les nombres (ex. -12,5) qui doivent rester numériques.
  function sanitizeCell(val) {
    if (/^[=+\-@\t\r]/.test(val) && !/^[+-]?\d[\d\s.,]*%?$/.test(val)) {
      return `'${val}`;
    }
    return val;
  }

  function buildTSV(cells) {
    // Regrouper les cellules par ligne de tableau (cells déjà en ordre document)
    const rows = new Map();
    for (const cell of cells) {
      const row = cell.parentElement;
      if (!rows.has(row)) rows.set(row, []);
      const val = sanitizeCell(cell.innerText.trim());
      // TSV : si le contenu contient \n, \r, \t ou ", on l'encadre de guillemets
      rows.get(row).push(/[\n\r\t"]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val);
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
      (document.body || document.documentElement).appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      flashCopied(ok);
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
    showBar(label, 'text');
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
    lastX         = e.clientX;
    lastY         = e.clientY;
    if (!edgeFrame) edgeFrame = requestAnimationFrame(edgeScrollTick);
    refreshSelection();
    // Empêcher la sélection de texte pendant le drag
    document.documentElement.style.userSelect = 'none';
  });

  // ── Glisser : extension de plage et défilement automatique ────────────────
  let lastX = 0, lastY = 0;     // dernière position du pointeur (viewport)
  let edgeFrame = 0;

  function extendDragTo(cell) {
    if (!enabled || !isDragging || !anchorCell) return;
    if (!cell || cell === lastHoverCell) return;
    lastHoverCell = cell;
    rangeCells    = rangeOf(anchorCell, cell);
    refreshSelection();
  }

  function extendDragAt(x, y) {
    const cx = Math.max(0, Math.min(x, window.innerWidth  - 1));
    const cy = Math.max(0, Math.min(y, window.innerHeight - 1));
    extendDragTo(toCell(document.elementFromPoint(cx, cy)));
  }

  // Pointeur près du bord haut/bas (ou hors fenêtre) pendant un glisser :
  // faire défiler la page, plus vite à mesure qu'on s'éloigne du bord
  function edgeScrollTick() {
    edgeFrame = 0;
    if (!enabled || !isDragging) return;
    const EDGE = 40, MAX = 40;
    let dy = 0;
    if (lastY < EDGE) dy = -Math.min(MAX, (EDGE - lastY) / 2);
    else if (lastY > window.innerHeight - EDGE) dy = Math.min(MAX, (lastY - window.innerHeight + EDGE) / 2);
    if (dy) window.scrollBy(0, dy);
    edgeFrame = requestAnimationFrame(edgeScrollTick);
  }

  document.addEventListener('mousemove', e => {
    if (!enabled || !isDragging || !anchorCell) return;
    lastX = e.clientX;
    lastY = e.clientY;
    extendDragTo(toCell(e.target));
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

  function isEditable(el) {
    return !!el && (el.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }

  document.addEventListener('keydown', e => {
    if (!enabled || !activeCells.size) return;
    if (e.key === 'Escape') {
      clearCells();
      hideBar();
    }
    // Ne pas détourner Ctrl+C si l'utilisateur est dans un champ de saisie
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'c'
        && !isEditable(document.activeElement)) {
      e.preventDefault();
      copySelection();
    }
  });
})();
