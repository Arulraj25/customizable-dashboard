/**
 * dashboard.js  v7.3  - Fixed duplicate API calls, light theme only
 */

(async function DashboardView() {

  let widgetList         = [];
  let currentDashId      = null;
  let grid               = null;
  let roObserver         = null;
  let renderInProgress = false; // Prevent multiple simultaneous renders

  const gridEl    = document.getElementById('dashGrid');
  const emptyEl   = document.getElementById('emptyState');
  const nameLabel = document.getElementById('dashNameLabel');

  // Set light theme
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.setItem('dashforge-theme', 'light');

  /* ── Helpers ─────────────────────────────────────────────── */
  function getDateRange() { return document.getElementById('dateFilter')?.value || 'all'; }

  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  /* ── Add clear filter button ─────────────────────────────── */
  function addClearFilterButton() {
    const headerRight = document.querySelector('.page-header__right');
    if (headerRight && !document.getElementById('clearFilterBtn')) {
      const clearBtn = document.createElement('button');
      clearBtn.id = 'clearFilterBtn';
      clearBtn.className = 'btn btn-ghost';
      clearBtn.innerHTML = `
        <svg class="icon-xs" viewBox="0 0 16 16"><path d="M4 8h8M2 4h12M6 12h4"/><circle cx="8" cy="8" r="6.5" stroke="currentColor"/></svg>
        Clear Filter
      `;
      clearBtn.style.display = 'none';
      clearBtn.addEventListener('click', () => {
        Widgets.clearCrossFilter();
      });
      headerRight.appendChild(clearBtn);
    }
  }

  /* ── Debounced orientation observer ──────────────────────── */
  function startOrientationObserver() {
    if (roObserver) roObserver.disconnect();
    if (!window.ResizeObserver) return;
    
    const orientationTimers = {};
    
    roObserver = new ResizeObserver(entries => {
      entries.forEach(e => {
        const el = e.target.closest('.grid-stack-item');
        if (!el) return;
        
        const widgetId = el.getAttribute('gs-id');
        if (!widgetId) return;
        
        // Debounce orientation updates
        if (orientationTimers[widgetId]) {
          clearTimeout(orientationTimers[widgetId]);
        }
        
        orientationTimers[widgetId] = setTimeout(() => {
          const { width:w, height:h } = e.contentRect;
          const asp = w / (h || 1);
          let orient = 's';
          if (asp > 1.5) orient = 'h';
          else if (asp < 0.8) orient = 'v';
          el.setAttribute('data-orient', orient);
          
          // Update widget content based on new orientation (only for KPI)
          const widget = window._widgetRegistry?.[widgetId];
          if (widget && widget.type === 'kpi') {
            // Use a longer delay to prevent rapid re-renders
            setTimeout(() => {
              if (!renderInProgress) {
                renderInProgress = true;
                Widgets.renderWidget(widget, getDateRange());
                setTimeout(() => { renderInProgress = false; }, 200);
              }
            }, 200);
          }
          
          delete orientationTimers[widgetId];
        }, 150);
      });
    });
    
    document.querySelectorAll('.grid-stack-item-content').forEach(el => roObserver.observe(el));
  }

  /* ── Build/rebuild the Gridstack grid ─────────────────────── */
  function buildGrid(data) {
    widgetList    = Array.isArray(data.layout) ? data.layout : [];
    currentDashId = data.id || null;
    window._widgetRegistry = {};
    
    // Clear any existing filter
    Widgets.clearCrossFilter();
    
    widgetList.forEach(w => { window._widgetRegistry[w.id] = w; });

    if (data.name) {
      nameLabel.innerHTML = `Viewing: <strong style="color:var(--accent)">${esc(data.name)}</strong>`;
    } else {
      nameLabel.textContent = 'Live data overview';
    }

    if (grid) { 
      try { grid.destroy(false); } catch {} 
      grid = null; 
    }
    gridEl.innerHTML = '';

    emptyEl.hidden = widgetList.length > 0;

    if (!widgetList.length) return;

    grid = GridStack.init({
      column: 12, 
      cellHeight: 62,
      staticGrid: true, 
      disableDrag: true, 
      disableResize: true,
    }, '#dashGrid');

    const dr = getDateRange();
    
    // Render widgets one by one with a small delay to prevent overwhelming the server
    widgetList.forEach((w, index) => {
      const el = document.createElement('div');
      el.className = 'grid-stack-item';
      el.setAttribute('gs-x', w.x ?? 0); 
      el.setAttribute('gs-y', w.y ?? 0);
      el.setAttribute('gs-w', w.w ?? 4);  
      el.setAttribute('gs-h', w.h ?? 3);
      el.setAttribute('gs-id', w.id);
      const inner = document.createElement('div');
      inner.className = 'grid-stack-item-content';
      inner.innerHTML = Widgets.buildShell(w, false);
      el.appendChild(inner);
      grid.addWidget(el);
      
      // Stagger rendering to avoid too many simultaneous API calls
      setTimeout(() => {
        Widgets.renderWidget(w, dr);
      }, index * 100);
    });

    setTimeout(startOrientationObserver, 500);
    
    // Add clear filter button
    addClearFilterButton();
  }

  async function loadLayout(id) {
    const url = id ? `/api/dashboards/${id}` : '/api/layout';
    const res = await fetch(url);
    if (!res.ok) return { layout: [], name: '', id: null };
    return res.json();
  }

  /* ── Init ────────────────────────────────────────────────── */
  try {
    const data = await loadLayout(null);
    buildGrid(data);
    if (!data.id) {
      nameLabel.innerHTML = `No saved dashboards yet — <a href="/configure" style="color:var(--accent)">Configure one</a>`;
    }
  } catch {
    nameLabel.textContent = 'Could not load dashboard';
    emptyEl.hidden = false;
  }

  /* ── Date filter with debounce ───────────────────────────── */
  let filterTimer;
  document.getElementById('dateFilter')?.addEventListener('change', () => {
    if (filterTimer) clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      const dr = getDateRange();
      renderInProgress = true;
      widgetList.forEach((w, index) => {
        setTimeout(() => {
          Widgets.renderWidget(w, dr);
        }, index * 50);
      });
      setTimeout(() => { renderInProgress = false; }, 1000);
    }, 300);
  });

  /* ── Advanced filters ────────────────────────────────────── */
  (async () => {
    try {
      const opts = await (await fetch('/api/filter-options')).json();
      const bar  = document.getElementById('filtersBar');
      const fields = [
        { key:'product', label:'Product' }, 
        { key:'status', label:'Status' },
        { key:'created_by', label:'Created By' }, 
        { key:'country', label:'Country' },
      ];
      
      bar.innerHTML = `<label>Filters:</label>` +
        fields.map(f => `
          <select data-filter="${f.key}">
            <option value="">All ${f.label}</option>
            ${(opts[f.key]||[]).map(v=>`<option>${esc(v)}</option>`).join('')}
          </select>`).join('') +
        `<button class="filter-reset" id="filterResetBtn">✕ Reset</button>`;

      let filterChangeTimer;
      bar.querySelectorAll('select').forEach(sel => {
        sel.addEventListener('change', () => {
          if (filterChangeTimer) clearTimeout(filterChangeTimer);
          filterChangeTimer = setTimeout(() => {
            window._globalFilters = window._globalFilters || {};
            window._globalFilters[`filter_${sel.dataset.filter}`] = sel.value;
            const dr = getDateRange();
            renderInProgress = true;
            widgetList.forEach((w, index) => {
              setTimeout(() => {
                Widgets.renderWidget(w, dr);
              }, index * 50);
            });
            setTimeout(() => { renderInProgress = false; }, 1000);
          }, 300);
        });
      });
      
      document.getElementById('filterResetBtn')?.addEventListener('click', () => {
        window._globalFilters = {};
        bar.querySelectorAll('select').forEach(s => s.value = '');
        const dr = getDateRange();
        renderInProgress = true;
        widgetList.forEach((w, index) => {
          setTimeout(() => {
            Widgets.renderWidget(w, dr);
          }, index * 50);
        });
        setTimeout(() => { renderInProgress = false; }, 1000);
      });
    } catch { /* silent */ }
  })();

  /* ── Export PDF ──────────────────────────────────────────── */
  document.getElementById('exportPdfBtn')?.addEventListener('click', async () => {
    const name = nameLabel.textContent.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'dashboard';
    await exportDashboardPDF(gridEl, `${name}.pdf`);
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
          buildGrid(await loadLayout(item.dataset.id));
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

  // Monitor filter changes to show/hide clear button (debounced)
  let filterCheckTimer;
  function checkFilter() {
    if (filterCheckTimer) clearTimeout(filterCheckTimer);
    filterCheckTimer = setTimeout(() => {
      const filter = Widgets.getCurrentFilter();
      const clearBtn = document.getElementById('clearFilterBtn');
      if (clearBtn) {
        clearBtn.style.display = filter ? 'inline-flex' : 'none';
      }
    }, 100);
  }
  
  setInterval(checkFilter, 1000);

})();