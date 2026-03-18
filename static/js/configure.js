/**
 * configure.js  v7.2  - Fixed infinite loop, light theme only
 */

document.addEventListener('DOMContentLoaded', async () => {

  let widgetMap       = {};
  let activeId        = null;
  let currentDashId   = null;
  let currentDashName = '';
  let allDashboards   = [];
  let grid            = null;
  let hasUnsavedChanges = false;
  let resizeObserver  = null;

  // Set light theme
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.setItem('dashforge-theme', 'light');

  // Initialize Gridstack
  grid = GridStack.init({ 
    column:12, 
    cellHeight:62, 
    animate:true, 
    removable:false,
    acceptWidgets: true
  }, '#configGrid');
  
  window._widgetRegistry = widgetMap;

  // Track unsaved changes
  function markUnsaved() { 
    hasUnsavedChanges = true;
    updateUnsavedIndicator(true);
  }
  
  function markSaved() { 
    hasUnsavedChanges = false;
    updateUnsavedIndicator(false);
  }

  // Update page title indicator
  function updateUnsavedIndicator(hasUnsaved) {
    const title = document.querySelector('.page-title');
    if (!title) return;
    
    if (hasUnsaved && !title.querySelector('.unsaved-indicator')) {
      title.innerHTML = 'Configure Dashboard <span class="unsaved-indicator">*</span>';
    } else if (!hasUnsaved && title.querySelector('.unsaved-indicator')) {
      title.innerHTML = 'Configure Dashboard';
    }
  }

  grid.on('change', markUnsaved);
  grid.on('added', markUnsaved);
  grid.on('removed', markUnsaved);
  grid.on('resizestop', markUnsaved);

  /* ── Before unload warning ──────────────────────────────── */
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  });

  /* ── Debounced orientation observer ─────────────────────── */
  if (window.ResizeObserver) {
    const orientationTimers = {};
    
    resizeObserver = new ResizeObserver(entries => {
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
          const {width:w, height:h} = e.contentRect;
          const aspect = w/(h||1);
          let orient = 's';
          if (aspect > 1.5) orient = 'h';
          else if (aspect < 0.8) orient = 'v';
          el.setAttribute('data-orient', orient);
          
          // Update KPI widgets for orientation change (debounced)
          const widget = widgetMap[widgetId];
          if (widget && widget.type === 'kpi') {
            setTimeout(() => {
              Widgets.renderWidget(widget, 'all');
            }, 100);
          }
          
          delete orientationTimers[widgetId];
        }, 100);
      });
    });
    
    const obs = () => document.querySelectorAll('.grid-stack-item-content').forEach(el => resizeObserver.observe(el));
    grid.on('added resizestop change', obs);
  }

  /* ═══════════════════════════════════════════════════════
     DASHBOARD TABS
  ══════════════════════════════════════════════════════ */
  async function loadAllDashboards() {
    try {
      const res = await fetch('/api/dashboards');
      allDashboards = await res.json();
    } catch { 
      allDashboards = []; 
    }
  }

  function renderTabs() {
    const bar = document.getElementById('dashTabsBar');
    if (!bar) return;

    if (!allDashboards.length) {
      bar.innerHTML = `
        <span style="color:var(--tx3);font-size:.82rem;padding:4px 6px">No saved dashboards</span>
        <button class="dash-tab-new" id="tabNewBtn" title="New dashboard">+</button>`;
      document.getElementById('tabNewBtn')?.addEventListener('click', openNewDashDialog);
      return;
    }

    const tabs = allDashboards.map(d => `
      <div class="dash-tab${d.id == currentDashId ? ' active' : ''}" data-tab-id="${d.id}">
        <span class="dash-tab__label" data-tab-id="${d.id}">${esc(d.name)}</span>
        <span class="dash-tab__close" data-close-id="${d.id}" title="Close/Delete">✕</span>
      </div>`).join('');

    bar.innerHTML = tabs + `<button class="dash-tab-new" id="tabNewBtn" title="New dashboard">+</button>`;

    // Click tab to switch
    bar.querySelectorAll('.dash-tab__label').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.tabId;
        if (id == currentDashId) return;
        
        if (hasUnsavedChanges) {
          const shouldSwitch = await confirmDialog('You have unsaved changes. Switch dashboard anyway?');
          if (!shouldSwitch) return;
        }
        
        await switchDashboard(id);
      });
    });

    // Double-click tab label to rename
    bar.querySelectorAll('.dash-tab__label').forEach(el => {
      el.addEventListener('dblclick', async () => {
        const id   = el.dataset.tabId;
        const dash = allDashboards.find(d => d.id == id);
        const name = prompt('Rename dashboard:', dash?.name || '');
        if (!name?.trim()) return;
        
        const res = await fetch(`/api/dashboards/${id}/rename`, {
          method:'PATCH', 
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name: name.trim() }),
        });
        const data = await res.json();
        
        if (data.success) {
          if (id == currentDashId) { 
            currentDashName = name.trim(); 
            setDashLabel(name.trim(), id); 
          }
          await loadAllDashboards(); 
          renderTabs();
          showToast('Renamed ✓');
          markUnsaved();
        } else if (data.error === 'duplicate_name') {
          showToast('A dashboard with this name already exists', 'error');
        } else {
          showToast('Rename failed', 'error');
        }
      });
    });

    // Close (delete) tab
    bar.querySelectorAll('.dash-tab__close').forEach(el => {
      el.addEventListener('click', async e => {
        e.stopPropagation();
        const id   = el.dataset.closeId;
        const dash = allDashboards.find(d => d.id == id);
        if (!await confirmDialog(`Delete dashboard "${dash?.name}"?\nThis also removes its commit history.`)) return;
        
        await fetch(`/api/dashboards/${id}`, { method:'DELETE' });
        
        if (id == currentDashId) {
          // Release all widget names
          Object.values(widgetMap).forEach(w => {
            if (w.settings?.title) Widgets.releaseWidgetName(w.settings.title);
          });
          
          currentDashId = null; 
          currentDashName = '';
          grid.removeAll(); 
          widgetMap = {}; 
          window._widgetRegistry = {};
          syncHint(); 
          setDashLabel('', null);
          markSaved();
        }
        
        await loadAllDashboards(); 
        renderTabs();
        showToast('Dashboard deleted');
      });
    });

    document.getElementById('tabNewBtn')?.addEventListener('click', openNewDashDialog);
  }

  async function switchDashboard(id) {
    try {
      const data = await (await fetch(`/api/dashboards/${id}`)).json();
      
      // Release old widget names
      Object.values(widgetMap).forEach(w => {
        if (w.settings?.title) Widgets.releaseWidgetName(w.settings.title);
      });
      
      grid.removeAll(); 
      widgetMap = {}; 
      window._widgetRegistry = {};
      
      currentDashId   = data.id;
      currentDashName = data.name;
      
      (data.layout||[]).forEach(w => { 
        widgetMap[w.id]=w; 
        window._widgetRegistry[w.id]=w; 
        addToGrid(w, true); 
      });
      
      setDashLabel(data.name, data.id); 
      syncHint();
      renderTabs();
      showToast(`Switched to "${data.name}" ✓`, 'info');
      await refreshHistoryBadge();
      markSaved();
    } catch { 
      showToast('Failed to load dashboard', 'error'); 
    }
  }

  function openNewDashDialog() {
    document.getElementById('newDashName').value = '';
    document.getElementById('newDashErr').textContent = '';
    document.getElementById('newDashOverlay').hidden = false;
    document.getElementById('newDashName').focus();
  }
  
  document.getElementById('cancelNewDashBtn').addEventListener('click', () => {
    document.getElementById('newDashOverlay').hidden = true;
  });
  
  document.getElementById('confirmNewDashBtn').addEventListener('click', async () => {
    const name = document.getElementById('newDashName').value.trim();
    if (!name) { 
      document.getElementById('newDashErr').textContent = 'Please enter a name'; 
      return; 
    }
    
    const res  = await fetch('/api/dashboards', {
      method:'POST', 
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, layout:[], commit_msg:'Initial dashboard' }),
    });
    const data = await res.json();
    
    if (data.success) {
      document.getElementById('newDashOverlay').hidden = true;
      
      // Release old widget names
      Object.values(widgetMap).forEach(w => {
        if (w.settings?.title) Widgets.releaseWidgetName(w.settings.title);
      });
      
      grid.removeAll(); 
      widgetMap = {}; 
      window._widgetRegistry = {};
      
      currentDashId = data.id; 
      currentDashName = data.name;
      setDashLabel(data.name, data.id); 
      syncHint();
      await loadAllDashboards(); 
      renderTabs();
      showToast(`Created "${data.name}" ✓`, 'success');
      markSaved();
    } else if (data.error === 'duplicate_name') {
      document.getElementById('newDashErr').textContent = 'A dashboard with this name already exists';
    } else {
      showToast('Creation failed', 'error');
    }
  });

  /* ── Init: load all dashboards + most recent ────────────── */
  await loadAllDashboards();
  
  try {
    const res  = await fetch('/api/layout');
    const data = await res.json();
    if (data.layout?.length || data.id) {
      currentDashId   = data.id   || null;
      currentDashName = data.name || '';
      
      data.layout?.forEach(w => { 
        if (!widgetMap[w.id]) {
          widgetMap[w.id]=w; 
          window._widgetRegistry[w.id]=w; 
          addToGrid(w, true); 
        }
      });
      
      setDashLabel(data.name, data.id);
      if (currentDashId) await refreshHistoryBadge();
      markSaved();
    }
  } catch { /* silent */ }
  
  renderTabs(); 
  syncHint();

  /* ═══════════════════════════════════════════════════════
     PALETTE DRAG & DROP
  ══════════════════════════════════════════════════════ */
  document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('dragstart', e => { 
      e.dataTransfer.setData('wtype', item.dataset.type); 
      item.style.opacity='.4'; 
    });
    item.addEventListener('dragend', () => { item.style.opacity=''; });
  });
  
  document.getElementById('canvasInner').addEventListener('dragover', e => e.preventDefault());
  
  document.getElementById('canvasInner').addEventListener('drop', e => {
    e.preventDefault();
    const type = e.dataTransfer.getData('wtype');
    if (!type) return;
    
    // Generate unique widget ID
    let widgetId;
    do {
      widgetId = 'w' + Date.now() + Math.floor(Math.random() * 1000);
    } while (widgetMap[widgetId]);
    
    const w = { 
      id: widgetId, 
      type, 
      x: 0, 
      y: 0, 
      w: defW(type), 
      h: defH(type), 
      settings: {} 
    };
    
    widgetMap[w.id]=w; 
    window._widgetRegistry[w.id]=w;
    addToGrid(w, false); 
    syncHint();
    markUnsaved();
  });

  function addToGrid(widget, restore) {
    const outer = document.createElement('div');
    outer.className = 'grid-stack-item';
    
    if (restore) { 
      outer.setAttribute('gs-x', widget.x??0); 
      outer.setAttribute('gs-y', widget.y??0); 
    }
    
    outer.setAttribute('gs-w', widget.w ?? defW(widget.type));
    outer.setAttribute('gs-h', widget.h ?? defH(widget.type));
    outer.setAttribute('gs-id', widget.id);
    
    const inner = document.createElement('div');
    inner.className = 'grid-stack-item-content';
    inner.innerHTML = Widgets.buildShell(widget, true);
    
    outer.appendChild(inner);
    grid.addWidget(outer);
    hookWidgetMenu(widget, outer, inner);
    Widgets.renderWidget(widget, 'all');
  }

  function hookWidgetMenu(widget, outer, inner) {
    const id   = widget.id;
    const btn  = inner.querySelector(`#wmbtn-${id}`);
    const drop = inner.querySelector(`#wmdrop-${id}`);
    if (!btn || !drop) return;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelectorAll('.widget-dropdown.open').forEach(d => { if(d!==drop) d.classList.remove('open'); });
      drop.classList.toggle('open');
    });
    
    document.addEventListener('click', () => drop.classList.remove('open'), { capture:true, passive:true });

    drop.querySelectorAll('.widget-dd-item').forEach(item => {
      item.addEventListener('click', async e => {
        e.stopPropagation(); 
        drop.classList.remove('open');
        
        if (item.dataset.action === 'settings') {
          openSettingsPanel(id);
        }
        else if (item.dataset.action === 'duplicate') {
          duplicateWidget(widget);
        }
        else if (item.dataset.action === 'delete') {
          if (!await confirmDialog('Remove this widget?')) return;
          
          if (widget.settings?.title) Widgets.releaseWidgetName(widget.settings.title);
          grid.removeWidget(outer);
          delete widgetMap[id]; 
          delete window._widgetRegistry[id];
          syncHint();
          markUnsaved();
        }
      });
    });
  }

  function duplicateWidget(original) {
    // Generate unique ID
    let newId;
    do {
      newId = 'w' + Date.now() + Math.floor(Math.random() * 1000);
    } while (widgetMap[newId]);
    
    const clone = JSON.parse(JSON.stringify(original));
    clone.id = newId;
    clone.x  = (original.x||0) + (original.w||4);
    clone.y  = original.y||0;
    
    // Generate unique name for duplicate
    if (clone.settings) {
      const baseName = (clone.settings.title || Widgets.TYPE_LABEL[clone.type]) + ' (copy)';
      clone.settings.title = Widgets.registerWidgetName(baseName, newId);
    }
    
    widgetMap[newId] = clone; 
    window._widgetRegistry[newId] = clone;
    addToGrid(clone, true); 
    syncHint();
    showToast('Widget duplicated ✓');
    markUnsaved();
  }

  function openSettingsPanel(id) {
    closeHistoryPanel();
    activeId = id;
    const w = widgetMap[id];
    document.getElementById('settingsPanelTitle').textContent = `${Widgets.TYPE_LABEL[w.type]||w.type} Settings`;
    document.getElementById('settingsPanelBody').innerHTML = buildForm(w);
    document.getElementById('settingsPanel').hidden  = false;
    document.getElementById('panelBackdrop').hidden  = false;
  }
  
  function closeSettingsPanel() {
    document.getElementById('settingsPanel').hidden = true;
    document.getElementById('panelBackdrop').hidden = true;
    activeId = null;
  }
  
  document.getElementById('closePanelBtn').addEventListener('click', closeSettingsPanel);
  document.getElementById('panelBackdrop').addEventListener('click', closeSettingsPanel);
  
  document.getElementById('applySettingsBtn').addEventListener('click', () => {
    if (!activeId) return;
    
    const w = widgetMap[activeId];
    const oldTitle = w.settings?.title;
    const s = readForm(document.getElementById('settingsPanelBody'), w.type);
    
    // Check if title changed and ensure uniqueness
    if (s.title && s.title !== oldTitle) {
      if (Widgets.usedWidgetNames.has(s.title) && 
          (!oldTitle || (oldTitle && s.title !== oldTitle))) {
        showToast('A widget with this name already exists', 'error');
        return;
      }
      if (oldTitle) Widgets.releaseWidgetName(oldTitle);
      Widgets.usedWidgetNames.add(s.title);
    }
    
    w.settings = s;
    
    const nw=+s.width||w.w, nh=+s.height||w.h;
    if (nw!==w.w||nh!==w.h) {
      w.w=nw; w.h=nh;
      const el = document.querySelector(`[gs-id="${activeId}"]`);
      if (el) grid.update(el, {w:nw, h:nh});
    }
    
    const te=document.getElementById(`wt-${activeId}`);
    const de=document.getElementById(`wd-${activeId}`);
    if (te) te.textContent = s.title || Widgets.TYPE_LABEL[w.type];
    if (de) { 
      de.textContent=s.description||''; 
      de.style.display=s.description?'':'none'; 
    }
    
    Widgets.renderWidget(w,'all');
    closeSettingsPanel(); 
    showToast('Settings applied ✓');
    markUnsaved();
  });

  /* ═══════════════════════════════════════════════════════
     SMART SAVE DASHBOARD
  ══════════════════════════════════════════════════════ */
  document.getElementById('saveLayoutBtn').addEventListener('click', openSaveModal);

  function openSaveModal() {
    const nameEl    = document.getElementById('saveName');
    const commitEl  = document.getElementById('saveCommitMsg');
    const nameRow   = document.getElementById('nameRow');
    const commitRow = document.getElementById('commitRow');
    const errName   = document.getElementById('saveNameErr');
    const errCommit = document.getElementById('commitMsgErr');
    const owRow     = document.getElementById('overwriteRow');
    const owCheck   = document.getElementById('overwriteCheck');
    
    nameEl.value    = currentDashName || '';
    commitEl.value  = '';
    errName.textContent   = '';
    errCommit.textContent = '';
    
    if (currentDashId) {
      nameRow.style.display = 'none';
      commitRow.style.display = 'block';
      owRow.style.display = 'block';
      owCheck.checked = true;
      commitEl.focus();
    } else {
      nameRow.style.display = 'block';
      commitRow.style.display = 'block';
      owRow.style.display = 'none';
      nameEl.focus();
    }
    
    document.getElementById('saveOverlay').hidden = false;
  }
  
  document.getElementById('cancelSaveBtn').addEventListener('click', () => {
    document.getElementById('saveOverlay').hidden = true;
  });

  document.getElementById('confirmSaveBtn').addEventListener('click', async () => {
    const name      = document.getElementById('saveName').value.trim();
    const commitMsg = document.getElementById('saveCommitMsg').value.trim();
    let ok = true;
    
    if (!currentDashId && !name) { 
      document.getElementById('saveNameErr').textContent='Dashboard name is required'; 
      ok=false; 
    }
    if (!commitMsg) { 
      document.getElementById('commitMsgErr').textContent='Commit message is required'; 
      ok=false; 
    }
    if (!ok) return;

    const overwrite = document.getElementById('overwriteCheck').checked;
    const layout    = collectLayout();
    const payload   = { name: name || currentDashName, layout, commit_msg: commitMsg };
    if (overwrite && currentDashId) payload.id = currentDashId;

    try {
      const res  = await fetch('/api/dashboards', {
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify(payload),
      });
      const data = await res.json();
      
      if (data.success) {
        currentDashId = data.id; 
        currentDashName = data.name;
        setDashLabel(data.name, data.id);
        document.getElementById('saveOverlay').hidden = true;
        showToast(`"${data.name}" saved & committed ✓`, 'success');
        await loadAllDashboards(); 
        renderTabs();
        await refreshHistoryBadge();
        markSaved();
      } else if (data.error === 'duplicate_name') {
        document.getElementById('saveNameErr').textContent = 'A dashboard with this name already exists';
      } else if (data.error === 'duplicate_commit') {
        document.getElementById('commitMsgErr').textContent = 'A commit with this message already exists';
      } else {
        showToast('Save failed', 'error');
      }
    } catch { 
      showToast('Network error', 'error'); 
    }
  });

  document.getElementById('clearAllBtn').addEventListener('click', async () => {
    if (!await confirmDialog('Remove all widgets from the canvas?')) return;
    
    Object.values(widgetMap).forEach(w => {
      if (w.settings?.title) Widgets.releaseWidgetName(w.settings.title);
    });
    
    grid.removeAll(); 
    widgetMap={}; 
    window._widgetRegistry={}; 
    syncHint();
    markUnsaved();
  });

  /* ═══════════════════════════════════════════════════════
     HISTORY PANEL
  ══════════════════════════════════════════════════════ */
  document.getElementById('historyBtn').addEventListener('click', openHistoryPanel);
  document.getElementById('closeHistoryBtn').addEventListener('click', closeHistoryPanel);
  document.getElementById('historyBackdrop').addEventListener('click', closeHistoryPanel);

  async function openHistoryPanel() {
    if (!currentDashId) { 
      showToast('Save a dashboard first', 'info'); 
      return; 
    }
    closeSettingsPanel();
    document.getElementById('historyPanel').hidden    = false;
    document.getElementById('historyBackdrop').hidden = false;
    document.getElementById('historyDashName').textContent = `"${currentDashName}"`;
    await renderHistory();
  }
  
  function closeHistoryPanel() {
    document.getElementById('historyPanel').hidden    = true;
    document.getElementById('historyBackdrop').hidden = true;
  }

  async function renderHistory() {
    const body = document.getElementById('historyBody');
    body.innerHTML = '<div style="color:var(--tx3);font-size:.82rem;padding:10px">Loading…</div>';
    
    try {
      const commits = await (await fetch(`/api/dashboards/${currentDashId}/history`)).json();
      
      if (!commits.length) {
        body.innerHTML = `<div class="history-empty"><svg width="38" height="38" viewBox="0 0 38 38" fill="none"><circle cx="19" cy="19" r="17" stroke="currentColor" stroke-width="1.5"/><path d="M19 10v9l5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><p>No commits yet.<br>Every save records a commit.</p></div>`;
        return;
      }
      
      let html = '<div class="commit-timeline">';
      
      commits.forEach((c, idx) => {
        const isHead = idx === 0;
        const cnt    = Array.isArray(c.layout) ? c.layout.length : 0;
        const init   = initOf(c.commit_msg);
        
        html += `<div class="commit-item${isHead?' is-current':''}">
          <div class="commit-dot" title="${isHead?'Latest':''}"> ${init}</div>
          <div class="commit-body">
            <div class="commit-msg-text">${esc(c.commit_msg)}</div>
            <div class="commit-meta">
              <span>${fmtDateFull(c.committed_at)}</span>
              ${isHead?'<span class="tag current">HEAD</span>':''}
              <span class="tag">${cnt} widget${cnt!==1?'s':''}</span>
            </div>
          </div>
          <div class="commit-actions">
            <button class="commit-act-btn" data-preview="${c.id}">👁 Preview</button>
            <button class="commit-act-btn danger" data-delh="${c.id}">✕</button>
          </div>
        </div>`;
      });
      
      html += '</div>';
      body.innerHTML = html;

      body.querySelectorAll('[data-preview]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.location.href = `/preview/${btn.dataset.preview}`;
        });
      });
      
      body.querySelectorAll('[data-delh]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!await confirmDialog('Delete this commit?')) return;
          await fetch(`/api/history/${btn.dataset.delh}`, {method:'DELETE'});
          showToast('Commit deleted');
          await renderHistory(); 
          await refreshHistoryBadge();
        });
      });
    } catch { 
      body.innerHTML = '<div style="color:var(--danger);padding:10px">Failed to load history.</div>'; 
    }
  }

  document.getElementById('newCommitBtn').addEventListener('click', () => {
    document.getElementById('commitMsgInput').value  = '';
    document.getElementById('commitMsgErr2').textContent = '';
    document.getElementById('commitOverlay').hidden  = false;
    document.getElementById('commitMsgInput').focus();
  });
  
  document.getElementById('cancelCommitBtn').addEventListener('click', () => { 
    document.getElementById('commitOverlay').hidden=true; 
  });
  
  document.getElementById('confirmCommitBtn').addEventListener('click', async () => {
    const msg   = document.getElementById('commitMsgInput').value.trim();
    const errEl = document.getElementById('commitMsgErr2');
    
    if (!msg) { 
      errEl.textContent='Required'; 
      return; 
    }
    if (!currentDashId) { 
      showToast('Save a dashboard first','info'); 
      return; 
    }
    
    try {
      const res = await fetch(`/api/dashboards/${currentDashId}/history`, {
        method:'POST', 
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ commit_msg:msg, layout:collectLayout() }),
      });
      const data = await res.json();
      
      if (data.success) {
        document.getElementById('commitOverlay').hidden = true;
        showToast(`Committed: "${msg}" ✓`,'success');
        await renderHistory(); 
        await refreshHistoryBadge();
        markUnsaved();
      } else if (data.error === 'duplicate_commit') {
        errEl.textContent = 'A commit with this message already exists';
      } else {
        showToast('Commit failed', 'error');
      }
    } catch { 
      showToast('Network error','error'); 
    }
  });

  async function refreshHistoryBadge() {
    const btn   = document.getElementById('historyBtn');
    const badge = document.getElementById('historyBadge');
    
    if (!currentDashId) { 
      btn.style.display='none'; 
      return; 
    }
    
    btn.style.display='inline-flex';
    
    try {
      const data = await (await fetch(`/api/dashboards/${currentDashId}/history`)).json();
      badge.textContent = Array.isArray(data) ? data.length : 0;
    } catch { 
      badge.textContent='?'; 
    }
  }

  function collectLayout() {
    return grid.save(false).map(item => {
      const w = widgetMap[item.id];
      return w ? {...w, x:item.x, y:item.y, w:item.w, h:item.h} : null;
    }).filter(Boolean);
  }
  
  function syncHint() {
    const h = document.getElementById('canvasHint');
    if (h) h.style.display = Object.keys(widgetMap).length ? 'none' : 'flex';
  }
  
  function setDashLabel(name, id) {
    const el = document.getElementById('currentDashLabel');
    if (!el) return;
    
    el.textContent = name ? `Editing: "${name}"` : 'No dashboard selected — save to create one';
    el.dataset.name = name||''; 
    el.dataset.id = id||'';
    document.getElementById('historyBtn').style.display = id ? 'inline-flex' : 'none';
  }
  
  function fmtDateFull(d) {
    if(!d) return '';
    return new Date(d).toLocaleString('en-US',{
      year:'numeric',
      month:'short',
      day:'numeric',
      hour:'2-digit',
      minute:'2-digit',
      second:'2-digit'
    });
  }
  
  function initOf(msg) {
    const w = (msg||'').trim().split(/\s+/);
    return w.length===1 ? w[0].slice(0,2).toUpperCase() : (w[0][0]+w[1][0]).toUpperCase();
  }
  
  function defW(t) { return t==='kpi'?3:t==='table'?8:5; }
  function defH(t) { return t==='kpi'?2:t==='table'?5:4; }

  function buildForm(widget) {
    const s=widget.settings||{}, t=widget.type;
    
    let html=`
      <div class="settings-section-label">General</div>
      <div class="form-field"><label>Title</label><input type="text" name="title" value="${x(s.title)}" placeholder="${Widgets.TYPE_LABEL[t]||t}"></div>
      <div class="form-field"><label>Description</label><input type="text" name="description" value="${x(s.description)}"></div>
      <div class="cols-2-sm">
        <div class="form-field"><label>Width (1–12)</label><input type="number" name="width" min="1" max="12" value="${s.width||widget.w||4}"></div>
        <div class="form-field"><label>Height (rows)</label><input type="number" name="height" min="1" max="20" value="${s.height||widget.h||3}"></div>
      </div>`;
    
    if (t==='kpi')   html+=formKpi(s);
    else if (t==='pie')   html+=formPie(s);
    else if (t==='table') html+=formTable(s);
    else                  html+=formChart(s);
    
    return html;
  }

  function formKpi(s) {
    const metrics=[['total_amount','Total Amount'],['quantity','Quantity'],['unit_price','Unit Price'],['customer_id','Customer ID'],['customer_name','Customer Name'],['email','Email'],['address','Address'],['order_date','Order Date'],['product','Product'],['created_by','Created By'],['status','Status']];
    const aggs=[['sum','Sum'],['avg','Average'],['count','Count']];
    const fmts=[['number','Number'],['currency','Currency']];
    
    return `
      <div class="settings-section-label">Metric</div>
      <div class="form-field"><label>Metric</label>${sel('metric',metrics,s.metric||'total_amount')}</div>
      <div class="form-field"><label>Aggregation</label>${sel('aggregation',aggs,s.aggregation||'sum')}</div>
      <div class="settings-section-label">Formatting</div>
      <div class="form-field"><label>Format</label>${sel('format',fmts,s.format||'number')}</div>
      <div class="form-field"><label>Decimal Precision</label><input type="number" name="decimals" min="0" max="6" value="${s.decimals??0}"></div>`;
  }
  
  function formChart(s) {
    const axes=[['product','Product'],['quantity','Quantity'],['unit_price','Unit Price'],['total_amount','Total Amount'],['status','Status'],['created_by','Created By']];
    
    return `
      <div class="settings-section-label">Data</div>
      <div class="form-field"><label>X Axis</label>${sel('xAxis',axes,s.xAxis||'product')}</div>
      <div class="form-field"><label>Y Axis</label>${sel('yAxis',axes,s.yAxis||'total_amount')}</div>
      <div class="settings-section-label">Styling</div>
      <div class="form-field"><label>Chart Color</label><input type="color" name="color" value="${s.color||'#0aa87a'}" style="height:36px;padding:2px 4px"></div>
      <div class="form-field"><label class="check-row"><input type="checkbox" name="showLabels" ${s.showLabels?'checked':''}> Show Data Labels</label></div>`;
  }
  
  function formPie(s) {
    const fields=[['status','Status'],['product','Product'],['created_by','Created By'],['quantity','Quantity'],['total_amount','Total Amount']];
    
    return `
      <div class="settings-section-label">Data</div>
      <div class="form-field"><label>Chart Field</label>${sel('field',fields,s.field||'status')}</div>
      <div class="form-field"><label class="check-row"><input type="checkbox" name="showLegend" ${s.showLegend!==false?'checked':''}> Show Legend</label></div>`;
  }
  
  function formTable(s) {
    const allCols=[['id','Customer ID'],['first_name','First Name'],['last_name','Last Name'],['email','Email'],['phone','Phone'],['street','Street'],['city','City'],['state','State'],['postal_code','Postal'],['country','Country'],['product','Product'],['quantity','Quantity'],['unit_price','Unit Price'],['total_amount','Total Amount'],['status','Status'],['created_by','Created By'],['created_at','Order Date']];
    const selCols=s.columns||['id','first_name','last_name','product','total_amount','status'];
    const cbs=allCols.map(([v,l])=>`<label class="multi-item"><input type="checkbox" name="col_${v}" ${selCols.includes(v)?'checked':''}> ${l}</label>`).join('');
    
    return `
      <div class="settings-section-label">Columns</div>
      <div class="multi-select">${cbs}</div>
      <div class="settings-section-label">Options</div>
      <div class="form-field"><label>Sort By</label>${sel('sortCol',allCols,s.sortCol||'created_at')}</div>
      <div class="form-field"><label>Direction</label>${sel('sortDir',[['desc','Descending'],['asc','Ascending']],s.sortDir||'desc')}</div>
      <div class="form-field"><label>Rows / Page</label><input type="number" name="perPage" min="5" max="50" value="${s.perPage||10}"></div>
      <div class="settings-section-label">Styling</div>
      <div class="cols-2-sm">
        <div class="form-field"><label>Font Size</label><input type="number" name="fontSize" min="12" max="18" value="${s.fontSize||13}"></div>
        <div class="form-field"><label>Header Color</label><input type="color" name="headerBg" value="${s.headerBg||'#e8eef8'}" style="height:36px;padding:2px 4px"></div>
      </div>`;
  }

  function readForm(el, type) {
    const v   = n => el.querySelector(`[name="${n}"]`)?.value??'';
    const chk = n => !!el.querySelector(`[name="${n}"]`)?.checked;
    
    const base = { 
      title:v('title'), 
      description:v('description'), 
      width:+v('width')||undefined, 
      height:+v('height')||undefined
    };
    
    if (type==='kpi') {
      return {...base, 
        metric:v('metric'), 
        aggregation:v('aggregation'), 
        format:v('format'), 
        decimals:+v('decimals')||0
      };
    }
    
    if (type==='pie') {
      return {...base, 
        field:v('field'), 
        showLegend:chk('showLegend')
      };
    }
    
    if (type==='table') {
      const cols=['id','first_name','last_name','email','phone','street','city','state','postal_code','country','product','quantity','unit_price','total_amount','status','created_by','created_at'].filter(c=>chk(`col_${c}`));
      return {...base, 
        columns:cols, 
        sortCol:v('sortCol'), 
        sortDir:v('sortDir'), 
        perPage:+v('perPage')||10, 
        fontSize:+v('fontSize')||13, 
        headerBg:v('headerBg')
      };
    }
    
    return {...base, 
      xAxis:v('xAxis'), 
      yAxis:v('yAxis'), 
      color:v('color'), 
      showLabels:chk('showLabels')
    };
  }

  function sel(name, opts, cur) {
    return `<select name="${name}">${opts.map(([v,l])=>`<option value="${v}"${v===cur?' selected':''}>${l}</option>`).join('')}</select>`;
  }
  
  function x(s) { 
    return String(s??'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); 
  }
});