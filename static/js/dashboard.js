/**
 * dashboard.js  v5
 * - Auto-loads latest dashboard (no blocking empty page)
 * - Shows subtle empty-hint only when no widgets exist
 * - Global 10s refresh, advanced filters, PDF export, load modal
 * - Dimension-responsive ResizeObserver
 * - Theme toggle sync
 */
(async function DashboardView() {

  let widgetList         = [];
  let currentDashId      = null;
  let grid               = null;
  let globalRefreshTimer = null;
  let roObserver         = null;

  const gridEl    = document.getElementById('dashGrid');
  const emptyEl   = document.getElementById('emptyState');
  const nameLabel = document.getElementById('dashNameLabel');

  /* ── Helpers ─────────────────────────────────────────────── */
  function getDateRange() { return document.getElementById('dateFilter')?.value || 'all'; }

  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  /* ── ResizeObserver for orientation ──────────────────────── */
  function startOrientationObserver() {
    if (roObserver) roObserver.disconnect();
    if (!window.ResizeObserver) return;
    roObserver = new ResizeObserver(entries => {
      entries.forEach(e => {
        const el = e.target.closest('.grid-stack-item');
        if (!el) return;
        const { width:w, height:h } = e.contentRect;
        const asp = w / (h || 1);
        el.setAttribute('data-orient', asp > 1.8 ? 'h' : asp < 0.8 ? 'v' : 's');
      });
    });
    document.querySelectorAll('.grid-stack-item-content').forEach(el => roObserver.observe(el));
  }

  /* ── Build/rebuild the Gridstack grid ─────────────────────── */
  function buildGrid(data) {
    widgetList    = Array.isArray(data.layout) ? data.layout : [];
    currentDashId = data.id || null;
    window._widgetRegistry = {};
    widgetList.forEach(w => { window._widgetRegistry[w.id] = w; });

    // Update subtitle
    if (data.name) {
      nameLabel.innerHTML = `Viewing: <strong style="color:var(--accent)">${esc(data.name)}</strong>`;
    } else {
      nameLabel.textContent = 'Live data overview';
    }

    // Destroy old grid
    if (grid) { try { grid.destroy(false); } catch {} grid = null; }
    gridEl.innerHTML = '';

    // Show/hide empty hint
    emptyEl.hidden = widgetList.length > 0;

    if (!widgetList.length) return; // hint shown, nothing to render

    // Init Gridstack
    grid = GridStack.init({
      column: 12, cellHeight: 62,
      staticGrid: true, disableDrag: true, disableResize: true,
    }, '#dashGrid');

    const dr = getDateRange();
    widgetList.forEach(w => {
      const el = document.createElement('div');
      el.className = 'grid-stack-item';
      el.setAttribute('gs-x', w.x ?? 0); el.setAttribute('gs-y', w.y ?? 0);
      el.setAttribute('gs-w', w.w ?? 4);  el.setAttribute('gs-h', w.h ?? 3);
      el.setAttribute('gs-id', w.id);
      const inner = document.createElement('div');
      inner.className = 'grid-stack-item-content';
      inner.innerHTML = Widgets.buildShell(w, false);
      el.appendChild(inner);
      grid.addWidget(el);
      Widgets.renderWidget(w, dr);
      Widgets.startAutoRefresh(w, dr);
    });

    setTimeout(startOrientationObserver, 200);
  }

  /* ── Load a dashboard (by id or latest) ──────────────────── */
  async function loadLayout(id) {
    const url = id ? `/api/dashboards/${id}` : '/api/layout';
    const res = await fetch(url);
    if (!res.ok) return { layout: [], name: '', id: null };
    return res.json();
  }

  /* ── Init: auto-load latest saved dashboard ──────────────── */
  try {
    const data = await loadLayout(null);
    buildGrid(data);
    // If completely no dashboards exist, show a helpful subtitle
    if (!data.id) {
      nameLabel.innerHTML = `No saved dashboards yet — <a href="/configure" style="color:var(--accent)">Configure one</a>`;
    }
  } catch {
    nameLabel.textContent = 'Could not load dashboard';
    emptyEl.hidden = false;
  }

  /* ── Global 10-second real-time refresh ──────────────────── */
  function startGlobalRefresh() {
    stopGlobalRefresh();
    globalRefreshTimer = setInterval(() => {
      const dr = getDateRange();
      widgetList.forEach(w => Widgets.renderWidget(w, dr));
    }, 10000);
  }
  function stopGlobalRefresh() {
    if (globalRefreshTimer) { clearInterval(globalRefreshTimer); globalRefreshTimer = null; }
  }
  startGlobalRefresh();
  document.addEventListener('visibilitychange', () =>
    document.hidden ? stopGlobalRefresh() : startGlobalRefresh());

  /* ── Date filter ─────────────────────────────────────────── */
  document.getElementById('dateFilter')?.addEventListener('change', () => {
    const dr = getDateRange();
    widgetList.forEach(w => Widgets.renderWidget(w, dr));
  });

  /* ── Advanced filters ────────────────────────────────────── */
  (async () => {
    try {
      const opts = await (await fetch('/api/filter-options')).json();
      const bar  = document.getElementById('filtersBar');
      const fields = [
        { key:'product', label:'Product' }, { key:'status', label:'Status' },
        { key:'created_by', label:'Created By' }, { key:'country', label:'Country' },
      ];
      bar.innerHTML = `<label>Filters:</label>` +
        fields.map(f => `
          <select data-filter="${f.key}">
            <option value="">All ${f.label}</option>
            ${(opts[f.key]||[]).map(v=>`<option>${esc(v)}</option>`).join('')}
          </select>`).join('') +
        `<button class="filter-reset" id="filterResetBtn">✕ Reset</button>`;

      bar.querySelectorAll('select').forEach(sel => {
        sel.addEventListener('change', () => {
          window._globalFilters[`filter_${sel.dataset.filter}`] = sel.value;
          const dr = getDateRange();
          widgetList.forEach(w => Widgets.renderWidget(w, dr));
        });
      });
      document.getElementById('filterResetBtn')?.addEventListener('click', () => {
        window._globalFilters = {};
        bar.querySelectorAll('select').forEach(s => s.value = '');
        const dr = getDateRange();
        widgetList.forEach(w => Widgets.renderWidget(w, dr));
      });
    } catch { /* silent */ }
  })();

  /* ── Export PDF ──────────────────────────────────────────── */
  document.getElementById('exportPdfBtn')?.addEventListener('click', async () => {
    const name = nameLabel.textContent.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'dashboard';
    await exportDashboardPDF(gridEl, `${name}.pdf`);
  });

  /* ── Theme toggle sync ───────────────────────────────────── */
  document.querySelector('.theme-toggle')?.addEventListener('click', () => {
    toggleTheme();
    const t = document.documentElement.getAttribute('data-theme');
    document.querySelector('.theme-toggle-label').textContent = t === 'dark' ? '☀ Light' : '🌙 Dark';
  });

  /* ── Load Dashboard modal ────────────────────────────────── */
  async function openLoadModal() {
    const overlay = document.getElementById('loadOverlay');
    const listEl  = document.getElementById('dashList');
    overlay.hidden = false;
    listEl.innerHTML = '<li style="color:var(--tx3);padding:10px">Loading…</li>';
    try {
      const rows = await (await fetch('/api/dashboards')).json();
      if (!rows.length) {
        listEl.innerHTML = '<li style="color:var(--tx3);padding:10px">No saved dashboards yet.</li>';
        return;
      }
      listEl.innerHTML = rows.map(d => `
        <li class="dash-item" data-id="${d.id}">
          <div class="dash-item__info">
            <div class="dash-item__name">${esc(d.name)}</div>
            <div class="dash-item__date">Updated ${fmtDate(d.updated_at)}</div>
          </div>
          <span style="font-size:.78rem;color:var(--tx3)">▶</span>
        </li>`).join('');

      listEl.querySelectorAll('.dash-item').forEach(item => {
        item.addEventListener('click', async () => {
          overlay.hidden = true;
          stopGlobalRefresh();
          widgetList.forEach(w => Widgets.stopAutoRefresh(w.id));
          buildGrid(await loadLayout(item.dataset.id));
          startGlobalRefresh();
        });
      });
    } catch {
      listEl.innerHTML = '<li style="color:var(--danger);padding:10px">Failed to load dashboards.</li>';
    }
  }

  document.getElementById('loadDashBtn')?.addEventListener('click', openLoadModal);
  document.getElementById('emptyLoadBtn')?.addEventListener('click', openLoadModal);
  document.getElementById('cancelLoadBtn')?.addEventListener('click', () => {
    document.getElementById('loadOverlay').hidden = true;
  });

})();
