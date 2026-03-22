/**
 * @file joinview/views.js — saved views (depends on join.js for _jvBFS, shared state)
 */

// ═══════════════════════════════════════════════════════════════════════════════
//  SAVED VIEWS
// ═══════════════════════════════════════════════════════════════════════════════

let _jvCurrentViewId = null;

function _setCurrentView(id) {
  _jvCurrentViewId = id;
  const label = document.getElementById('jvSaveViewLabel');
  if (label) label.textContent = id ? 'Aggiorna Vista' : 'Crea Vista';
}

async function saveJoinView() {
  const graph = document.getElementById('jvGraph');
  const root  = graph.dataset.root;
  const depth = parseInt(document.getElementById('jvDepth').value) || 1;

  const payload = {
    root, depth,
    joinTypes:    { ..._jvJoinTypes },
    excluded:     [..._jvExcluded],
    selectedCols: { ..._jvSelectedCols },
    manualEdges:  _jvManualEdges.map(e => ({ ...e })),
  };

  try {
    if (_jvCurrentViewId) {
      const res = await fetch(`/project/${PROJECT.id}/views/${_jvCurrentViewId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { _showApiError('Errore aggiornamento vista (' + res.status + ')'); return; }
      const idx = (PROJECT.views || []).findIndex(v => v.id === _jvCurrentViewId);
      if (idx !== -1) Object.assign(PROJECT.views[idx], payload);
    } else {
      const name = prompt('Nome della vista:', 'Vista ' + ((PROJECT.views?.length || 0) + 1));
      if (!name) return;
      const res = await fetch(`/project/${PROJECT.id}/views`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, name }),
      });
      if (!res.ok) { _showApiError('Errore creazione vista (' + res.status + ')'); return; }
      const data = await res.json();
      PROJECT.views = PROJECT.views || [];
      PROJECT.views.push({ ...payload, name, id: data.id });
      _setCurrentView(data.id);
    }
  } catch {
    _showApiError('Errore di rete (salvataggio vista)');
    return;
  }

  _updateViewsBadge();
  renderViewsList();
}

async function deleteView(id) {
  try {
    const res = await fetch(`/project/${PROJECT.id}/views/${id}`, { method: 'DELETE' });
    if (!res.ok) { _showApiError('Errore eliminazione vista (' + res.status + ')'); return; }
  } catch {
    _showApiError('Errore di rete (eliminazione vista)');
    return;
  }
  PROJECT.views = (PROJECT.views || []).filter(v => v.id !== id);
  if (_jvCurrentViewId === id) _setCurrentView(null);
  _updateViewsBadge();
  renderViewsList();
}

async function renameView(id, newName) {
  if (!newName.trim()) return;
  try {
    const res = await fetch(`/project/${PROJECT.id}/views/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) { _showApiError('Errore rinomina vista (' + res.status + ')'); return; }
  } catch {
    _showApiError('Errore di rete (rinomina vista)');
    return;
  }
  const v = (PROJECT.views || []).find(v => v.id === id);
  if (v) v.name = newName.trim();
}

function _loadViewById(id) {
  const v = (PROJECT.views || []).find(v => v.id === id);
  if (v) loadView(v);
}

function loadView(v) {
  Object.keys(_jvJoinTypes).forEach(k => delete _jvJoinTypes[k]);
  Object.assign(_jvJoinTypes, v.joinTypes || {});
  _jvExcluded.clear();
  (v.excluded || []).forEach(k => _jvExcluded.add(k));
  Object.keys(_jvSelectedCols).forEach(k => delete _jvSelectedCols[k]);
  Object.assign(_jvSelectedCols, v.selectedCols || {});
  _jvManualEdges = (v.manualEdges || []).map(e => ({ ...e }));
  _setCurrentView(v.id);
  document.getElementById('jvRootSelect').value = v.root;
  document.getElementById('jvDepth').value = v.depth;
  switchJvTab('join', document.getElementById('jvSubJoin'));
  renderJoinView(false);
}

function _updateViewsBadge() {
  const n     = (PROJECT.views || []).length;
  const badge = document.getElementById('jvViewsBadge');
  badge.textContent   = n;
  badge.style.display = n > 0 ? '' : 'none';
}

function renderViewsList() {
  const el     = document.getElementById('jvViewsList');
  const views  = PROJECT.views || [];
  if (!views.length) {
    el.innerHTML = '<div class="jv-empty">Nessuna vista salvata. Usa il builder JOIN e clicca <strong>Crea Vista</strong>.</div>';
    return;
  }
  const tables = PROJECT.tables || {};
  let html = '<div class="jv-saved-views">';
  for (const v of views) {
    const { visited } = _jvBFS(v.root, v.depth, v.excluded || []);
    const color    = _jvGroupColor(v.root);
    const isActive = _jvCurrentViewId === v.id;
    html += `<div class="jv-view-card${isActive ? ' jv-view-active' : ''}">
      <div class="jv-view-head" style="background:${color}">
        <span class="jv-view-name-wrap">
          <span class="jv-view-name" contenteditable="true" spellcheck="false"
            data-id="${v.id}"
            onblur="renameView('${v.id}', this.innerText)"
            onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
          >${v.name}</span>
          <svg class="jv-rename-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="jv-view-btn jv-view-load" onclick="_loadViewById('${v.id}')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="5 12 19 12"/><polyline points="13 6 19 12 13 18"/></svg>
            ${isActive ? 'Attiva' : 'Apri'}
          </button>
          <button class="jv-view-btn jv-view-del" onclick="deleteView('${v.id}')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      </div>
      <div class="jv-view-tables">`;

    const sorted = [...visited.entries()].sort((a, b) => a[1] - b[1]);
    for (const [tname, hop] of sorted) {
      const t = tables[tname]; if (!t) continue;
      const c = _jvGroupColor(tname);
      const selCols = t.columns.filter(col => v.selectedCols?.[`${tname}::${col.name}`] !== false);
      html += `<div class="jv-view-table">
        <div class="jv-view-table-head" style="border-left:3px solid ${c};color:${c}">
          ${hop > 0 ? '<span class="jv-view-hop">hop ' + hop + '</span>' : '<span class="jv-view-hop">ROOT</span>'}
          ${t.name}
        </div>
        <div class="jv-view-cols">`;
      for (const col of selCols) {
        html += `<span class="jv-view-col">${col.name}<code class="jv-col-type" style="margin-left:4px">${col.type}</code></span>`;
      }
      html += `</div></div>`;
    }
    html += `</div></div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

// Init badge on page load
(function () { _updateViewsBadge(); })();
