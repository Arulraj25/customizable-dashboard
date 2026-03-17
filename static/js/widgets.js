/**
 * widgets.js  v4
 * Shared widget rendering engine.
 * New: KPI trend, duplicate, auto-refresh, dimension-responsive orientation,
 *      advanced filters passthrough, widget dropdown menu.
 */

const Widgets = (() => {

  const PALETTE = ['#f5a623','#3b9eff','#10d9a0','#ff5370','#a78bfa','#38bdf8','#fb923c','#4ade80','#f472b6','#facc15'];

  const TYPE_LABEL = { bar:'Bar Chart', line:'Line Chart', pie:'Pie Chart', area:'Area Chart', scatter:'Scatter Plot', table:'Table', kpi:'KPI Value' };

  const COL_LABEL = { id:'ID', first_name:'First', last_name:'Last', email:'Email', phone:'Phone', street:'Street', city:'City', state:'State', postal_code:'Postal', country:'Country', product:'Product', quantity:'Qty', unit_price:'Unit Price', total_amount:'Total', status:'Status', created_by:'Created By', created_at:'Date' };

  /* ── Per-widget auto-refresh timers ──────────────────────────── */
  const _timers = {};
  function clearWidgetTimer(id) {
    if (_timers[id]) { clearInterval(_timers[id]); delete _timers[id]; }
  }
  function setWidgetTimer(widget, dateRange) {
    clearWidgetTimer(widget.id);
    const secs = parseInt(widget.settings?.refreshInterval) || 0;
    if (!secs) return;
    _timers[widget.id] = setInterval(() => {
      renderWidget(widget, dateRange || document.getElementById('dateFilter')?.value || 'all');
      // Flash the dot
      const dot = document.getElementById(`rdot-${widget.id}`);
      if (dot) { dot.classList.add('active'); setTimeout(() => dot.classList.remove('active'), 900); }
    }, secs * 1000);
  }

  /* ── Dimension orientation: detect widget frame shape ────────── */
  function updateOrientation(id) {
    const el = document.querySelector(`[gs-id="${id}"]`);
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    const aspect = w / (h || 1);
    const orient = aspect > 1.8 ? 'h' : aspect < 0.8 ? 'v' : 's';
    el.setAttribute('data-orient', orient);
  }

  /* ── Build widget shell HTML ─────────────────────────────────── */
  function buildShell(widget, editable = false) {
    const { id, type, settings = {} } = widget;
    const title = settings.title || TYPE_LABEL[type] || type;
    const desc  = settings.description || '';

    const menu = editable ? `
      <div class="widget-menu">
        <button class="widget-menu-btn" id="wmbtn-${id}" title="Widget options">⋯</button>
        <div class="widget-dropdown" id="wmdrop-${id}">
          <div class="widget-dd-item" data-action="settings" data-id="${id}">
            <svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="2"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.93 2.93l1.41 1.41M9.66 9.66l1.41 1.41M2.93 11.07l1.41-1.41M9.66 4.34l1.41-1.41" stroke-width="1.3"/></svg>
            Settings
          </div>
          <div class="widget-dd-item" data-action="duplicate" data-id="${id}">
            <svg viewBox="0 0 14 14"><rect x="1" y="4" width="9" height="9" rx="1.5"/><path d="M4 4V2.5A1.5 1.5 0 0 1 5.5 1H12a1.5 1.5 0 0 1 1.5 1.5V9A1.5 1.5 0 0 1 12 10.5H10"/></svg>
            Duplicate
          </div>
          <div class="widget-dd-sep"></div>
          <div class="widget-dd-item danger" data-action="delete" data-id="${id}">
            <svg viewBox="0 0 14 14"><polyline points="1,3 13,3"/><path d="M5 3V2h4v1M3 3l1 10h6l1-10"/></svg>
            Delete
          </div>
        </div>
      </div>` : '';

    return `
      <div class="widget-shell" id="ws-${id}">
        <div class="widget-head">
          <div class="widget-meta">
            <div class="widget-title" id="wt-${id}">${esc(title)}</div>
            <div class="widget-desc" id="wd-${id}" ${desc?'':'style="display:none"'}>${esc(desc)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:4px">
            <span class="widget-refresh-dot" id="rdot-${id}"></span>
            ${menu}
          </div>
        </div>
        <div class="widget-body" id="wb-${id}">
          <div style="color:var(--tx3);font-size:.8rem;padding:8px">Loading…</div>
        </div>
        ${type === 'table' ? `<div class="w-pager" id="wp-${id}"></div>` : ''}
      </div>`;
  }

  /* ── KPI ─────────────────────────────────────────────────────── */
  async function renderKpi(widget, dateRange = 'all') {
    const { id, settings = {} } = widget;
    const body = document.getElementById(`wb-${id}`);
    if (!body) return;
    try {
      const payload = { ...settings, dateRange, ...(window._globalFilters||{}) };
      const res  = await apiFetch('/api/widget/kpi', payload);
      const data = await res.json();
      let val = data.value ?? 0;
      if (settings.format === 'currency') {
        val = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:+settings.decimals||2, maximumFractionDigits:+settings.decimals||2 }).format(val);
      } else {
        val = new Intl.NumberFormat('en-US', { minimumFractionDigits:+settings.decimals||0, maximumFractionDigits:+settings.decimals||0 }).format(val);
      }

      // Trend badge
      let trendHtml = '';
      if (data.trend_pct !== null && data.trend_pct !== undefined) {
        const dir = data.trend_dir || (data.trend_pct >= 0 ? 'up' : 'down');
        const arrow = dir === 'up' ? '↑' : '↓';
        const abs   = Math.abs(data.trend_pct);
        trendHtml = `<div class="kpi-trend ${dir}">
          <svg viewBox="0 0 13 13"><path d="${dir==='up'?'M1 10L6 3l5 7':'M1 3L6 10l5-7'}" stroke-width="1.8"/></svg>
          ${arrow} ${abs}% vs last 7 days
        </div>`;
      }

      body.innerHTML = `
        <div class="kpi-inner">
          <div class="kpi-value">${val}</div>
          <div class="kpi-metric">${esc(settings.metric||'value')} · ${esc(settings.aggregation||'sum')}</div>
          ${trendHtml}
        </div>`;
      updateOrientation(id);
    } catch { body.innerHTML = errHtml(); }
  }

  /* ── Chart ───────────────────────────────────────────────────── */
  async function renderChart(widget, dateRange = 'all') {
    const { id, type, settings = {} } = widget;
    const body = document.getElementById(`wb-${id}`);
    if (!body) return;
    try {
      const payload = { ...settings, chartType: type, dateRange, ...(window._globalFilters||{}) };
      const res  = await apiFetch('/api/widget/chart', payload);
      const data = await res.json();
      destroyChart(body);
      body.innerHTML = `<canvas id="wc-${id}" style="width:100%;height:100%"></canvas>`;
      const ctx   = document.getElementById(`wc-${id}`).getContext('2d');
      const color = settings.color || PALETTE[0];
      const chartType = type === 'area' ? 'line' : type === 'scatter' ? 'scatter' : type;
      let dataset;
      if (type === 'scatter') {
        dataset = { label: settings.yAxis||'value', data: data.labels.map((_,i)=>({x:i,y:data.values[i]})), backgroundColor: color+'cc', borderColor: color, pointRadius:5 };
      } else {
        dataset = { label: settings.yAxis||'value', data: data.values, backgroundColor: type==='area' ? hexRgba(color,.2) : type==='bar' ? PALETTE.map(c=>c+'cc') : color, borderColor: color, borderWidth: type==='bar'?0:2, fill: type==='area', tension:.4, pointRadius:3, borderRadius: type==='bar'?5:0 };
      }
      body._chart = new Chart(ctx, { type: chartType, data: { labels: data.labels, datasets: [dataset] }, options: baseChartOpts() });
      updateOrientation(id);
    } catch { body.innerHTML = errHtml(); }
  }

  /* ── Pie ─────────────────────────────────────────────────────── */
  async function renderPie(widget, dateRange = 'all') {
    const { id, settings = {} } = widget;
    const body = document.getElementById(`wb-${id}`);
    if (!body) return;
    try {
      const payload = { ...settings, dateRange, ...(window._globalFilters||{}) };
      const res  = await apiFetch('/api/widget/pie', payload);
      const data = await res.json();
      destroyChart(body);
      body.innerHTML = `<canvas id="wc-${id}" style="width:100%;height:100%"></canvas>`;
      const ctx = document.getElementById(`wc-${id}`).getContext('2d');
      body._chart = new Chart(ctx, {
        type: 'pie',
        data: { labels: data.labels, datasets: [{ data: data.values, backgroundColor: PALETTE, borderColor: 'transparent', borderWidth: 2 }] },
        options: { responsive:true, maintainAspectRatio:false, plugins: { legend: { display: settings.showLegend!==false, position:'bottom', labels: { color:'var(--tx2)', font:{ size:11 }, boxWidth:12, padding:12 } } } },
      });
      updateOrientation(id);
    } catch { body.innerHTML = errHtml(); }
  }

  /* ── Table ───────────────────────────────────────────────────── */
  async function renderTable(widget, dateRange = 'all', page = 1) {
    const { id, settings = {} } = widget;
    const body  = document.getElementById(`wb-${id}`);
    const pager = document.getElementById(`wp-${id}`);
    if (!body) return;
    const cols    = settings.columns || ['id','first_name','last_name','product','total_amount','status'];
    const perPage = +settings.perPage || 10;
    try {
      const payload = { ...settings, dateRange, page, perPage, ...(window._globalFilters||{}) };
      const res  = await apiFetch('/api/widget/table', payload);
      const data = await res.json();
      const totalPages = Math.max(1, Math.ceil(data.total / perPage));
      const hBg = settings.headerBg ? `background:${settings.headerBg};` : '';
      const fs  = settings.fontSize ? `font-size:${settings.fontSize}px;` : '';
      let html = `<table class="w-table" style="${fs}"><thead><tr>`;
      cols.forEach(c => { html += `<th style="${hBg}">${COL_LABEL[c]||c}</th>`; });
      html += '</tr></thead><tbody>';
      if (!data.rows?.length) {
        html += `<tr><td colspan="${cols.length}" style="text-align:center;padding:20px;color:var(--tx3)">No data</td></tr>`;
      } else {
        data.rows.forEach(row => {
          html += '<tr>';
          cols.forEach(c => {
            let v = row[c]??'—';
            if (c === 'status') v = `<span class="badge ${statusCls(v)}">${v}</span>`;
            if (c === 'created_at') v = fmtDate(v);
            html += `<td>${v}</td>`;
          });
          html += '</tr>';
        });
      }
      html += '</tbody></table>';
      body.innerHTML = html;
      if (pager) {
        pager.innerHTML = `
          <span>${data.total} rows</span>
          <button onclick="Widgets._tablePage('${id}',${page-1},'${dateRange}')" ${page<=1?'disabled':''}>‹ Prev</button>
          <span>${page}/${totalPages}</span>
          <button onclick="Widgets._tablePage('${id}',${page+1},'${dateRange}')" ${page>=totalPages?'disabled':''}>Next ›</button>`;
      }
      updateOrientation(id);
    } catch { body.innerHTML = errHtml(); }
  }

  function _tablePage(wid, page, dateRange) {
    const w = (window._widgetRegistry||{})[wid];
    if (w) renderTable(w, dateRange, page);
  }

  /* ── Master dispatcher ───────────────────────────────────────── */
  function renderWidget(widget, dateRange = 'all') {
    const { type } = widget;
    if (type==='kpi')   return renderKpi(widget, dateRange);
    if (type==='pie')   return renderPie(widget, dateRange);
    if (type==='table') return renderTable(widget, dateRange);
    return renderChart(widget, dateRange);
  }

  /* ── Start/stop auto-refresh for a widget ───────────────────── */
  function startAutoRefresh(widget, dateRange) {
    clearWidgetTimer(widget.id);
    setWidgetTimer(widget, dateRange);
  }
  function stopAutoRefresh(id) { clearWidgetTimer(id); }

  /* ── Utilities ───────────────────────────────────────────────── */
  function apiFetch(url, body) {
    return fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  }
  function destroyChart(el) { if (el._chart) { el._chart.destroy(); el._chart = null; } }
  function baseChartOpts() {
    return { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ x:{ ticks:{ color:'var(--tx3)', font:{size:10}, maxRotation:30 }, grid:{ color:'rgba(255,255,255,.04)' } }, y:{ ticks:{ color:'var(--tx3)', font:{size:10} }, grid:{ color:'rgba(255,255,255,.04)' } } } };
  }
  function hexRgba(hex, a) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function statusCls(s) { return s==='Pending'?'badge-pending':s==='In progress'?'badge-progress':s==='Completed'?'badge-done':''; }
  function fmtDate(d) { if(!d) return '—'; return new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}); }
  function errHtml() { return `<div style="color:var(--danger);font-size:.78rem;padding:8px">Failed to load data</div>`; }
  function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  return { buildShell, renderWidget, renderKpi, renderChart, renderPie, renderTable, _tablePage, startAutoRefresh, stopAutoRefresh, TYPE_LABEL, COL_LABEL, PALETTE };
})();
