/**
 * @file ui.js — tabs, sidebar, rename, export menu,
 *               DBML/SQL/SVG/PDF export, tab close
 */

// ── Tab switching ─────────────────────────────────────────────────────────────

// ── Dark / light theme toggle ─────────────────────────────────────────────────

function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('dbml_theme', isDark ? 'light' : 'dark');
  _updateThemeIcon(!isDark);
}

function _updateThemeIcon(dark) {
  const icon = document.getElementById('themeIcon');
  if (!icon) return;
  // moon = dark mode active, sun = light mode active
  icon.innerHTML = dark
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'  // moon
    : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'; // sun
}

// Apply correct icon on load
document.addEventListener('DOMContentLoaded', () => {
  _updateThemeIcon(document.documentElement.getAttribute('data-theme') === 'dark');
});

// ── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.toolbar-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
  const isDiagram = name === 'diagram';
  const isDocs    = name === 'docs';
  document.getElementById('zoomControls').style.display   = isDiagram ? 'flex' : 'none';
  document.getElementById('diagramActions').style.display = isDiagram ? 'flex' : 'none';
  if (isDocs) initMarkdownEditor();
  if (!isDiagram) {
    const cs = document.getElementById('canvasSearch');
    if (cs) { cs.value = ''; _clearCanvasSearch(); }
  }
}

// ── Add note at centre of visible canvas ─────────────────────────────────────

function addNoteCenter() {
  if (!diagram) return;
  const c = document.getElementById('diagramContainer');
  const r = c.getBoundingClientRect();
  diagram.addNote(r.width / 2, r.height / 2);
}

// ── Expand sidebar item and pulse a column ───────────────────────────────────

function expandAndPulse(tableName, colName) {
  const targetItem = document.querySelector(`.nav-table-item[data-table="${tableName}"]`);
  if (!targetItem) return;
  const groupTables = targetItem.closest('.nav-group-tables');
  if (groupTables) groupTables.style.display = '';
  const wrapper = targetItem.closest('.nav-table-wrapper');
  const cols    = wrapper.querySelector('.nav-table-columns');
  const chev    = targetItem.querySelector('.nav-table-chevron');
  cols.classList.add('open');
  chev.style.transform = 'rotate(180deg)';
  targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  cols.querySelectorAll('.nav-col-row').forEach(r => {
    if (r.dataset.col === colName) {
      r.classList.remove('fk-highlight');
      void r.offsetWidth;
      r.classList.add('fk-highlight');
      setTimeout(() => r.classList.remove('fk-highlight'), 1200);
    }
  });
}

// Listen for relation line click from diagram
document.getElementById('diagramContainer').addEventListener('refSelected', e => {
  const ref = e.detail;
  expandAndPulse(ref.from_table, ref.from_col);
  expandAndPulse(ref.to_table,   ref.to_col);
});

// ── Sidebar toggle ────────────────────────────────────────────────────────────

function toggleSidebar() {
  const sidebar   = document.getElementById('sidebar');
  const reopenBtn = document.getElementById('sidebarReopenBtn');
  const collapsed = sidebar.classList.toggle('sidebar--collapsed');
  reopenBtn.style.display = collapsed ? '' : 'none';
}

// ── Project rename ────────────────────────────────────────────────────────────

function startRename() {
  const nameEl  = document.getElementById('brandNameText');
  const input   = document.getElementById('brandInput');
  const nameSpan = document.getElementById('brandName');
  input.value = nameEl ? nameEl.textContent.trim() : nameSpan.textContent.trim();
  nameSpan.style.display  = 'none';
  input.style.display = 'block';
  input.select();
}

function cancelRename() {
  document.getElementById('brandName').style.display  = '';
  document.getElementById('brandInput').style.display = 'none';
}

function saveRename() {
  const nameSpan = document.getElementById('brandName');
  const nameEl   = document.getElementById('brandNameText');
  const input    = document.getElementById('brandInput');
  const current  = nameEl ? nameEl.textContent.trim() : nameSpan.textContent.trim();
  const name     = input.value.trim();
  if (!name || name === current) { cancelRename(); return; }
  fetch(`/project/${PROJECT.id}/rename`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name }),
  })
    .then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(data => {
      if (nameEl) nameEl.textContent = data.name;
      else nameSpan.textContent = data.name;
      const activeTab = document.querySelector('.project-tab.active .tab-name');
      if (activeTab) activeTab.textContent = data.name;
      document.title = data.name + ' - DBML Docs';
    })
    .catch(() => _showApiError('Errore rinomina progetto'));
  cancelRename();
}

// ── Sidebar group / table toggle ──────────────────────────────────────────────

function toggleGroup(header) {
  const tables  = header.nextElementSibling;
  const chevron = header.querySelector('.nav-group-chevron');
  const open    = tables.style.display !== 'none';
  tables.style.display    = open ? 'none' : '';
  chevron.style.transform = open ? 'rotate(-90deg)' : '';
}

function toggleTableExpand(itemEl, name, e) {
  const wrapper = itemEl.closest('.nav-table-wrapper');
  const cols    = wrapper.querySelector('.nav-table-columns');
  const chevron = itemEl.querySelector('.nav-table-chevron');
  const isOpen  = cols.classList.contains('open');
  cols.classList.toggle('open', !isOpen);
  chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
  focusTable(name, e);
}

function focusTable(name, e) {
  document.querySelectorAll('.nav-table-item').forEach(el => el.classList.remove('active'));
  const sideItem = document.querySelector(`.nav-table-item[data-table="${name}"]`);
  if (sideItem) sideItem.classList.add('active');
  if (diagram) diagram.focusTable(name);
}

// ── Sidebar search ────────────────────────────────────────────────────────────

document.getElementById('tableSearch').addEventListener('input', function () {
  const q = this.value.toLowerCase().trim();

  document.querySelectorAll('.nav-group').forEach(group => {
    const groupTables = group.querySelector('.nav-group-tables');
    const chevron     = group.querySelector('.nav-group-chevron');
    let groupHasMatch = false;

    group.querySelectorAll('.nav-table-wrapper').forEach(wrapper => {
      const item       = wrapper.querySelector('.nav-table-item');
      const cols       = wrapper.querySelector('.nav-table-columns');
      const tabChevron = item.querySelector('.nav-table-chevron');
      const tableMatch = item.dataset.table.toLowerCase().includes(q);

      let colMatch = false;
      cols.querySelectorAll('.nav-col-row').forEach(row => {
        const nm   = row.querySelector('.nav-col-name').textContent.toLowerCase();
        const type = row.querySelector('.nav-col-type').textContent.toLowerCase();
        const rowMatch = !q || nm.includes(q) || type.includes(q);
        row.style.display = rowMatch ? '' : 'none';
        if (rowMatch) colMatch = true;
      });

      const show = !q || tableMatch || colMatch;
      wrapper.style.display = show ? '' : 'none';
      if (show) groupHasMatch = true;

      if (!q) {
        cols.querySelectorAll('.nav-col-row').forEach(r => r.style.display = '');
        cols.classList.remove('open');
        tabChevron.style.transform = '';
      } else if (!tableMatch && colMatch) {
        cols.classList.add('open');
        tabChevron.style.transform = 'rotate(180deg)';
      }
    });

    if (!q) {
      group.style.display = '';
      groupTables.style.display = '';
      if (chevron) chevron.style.transform = '';
    } else {
      group.style.display = groupHasMatch ? '' : 'none';
      if (groupHasMatch) groupTables.style.display = '';
    }
  });
});

// ── Global column/table search ────────────────────────────────────────────────

function _gsHi(text, q) {
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return text;
  return text.slice(0, idx) +
    '<mark>' + text.slice(idx, idx + q.length) + '</mark>' +
    text.slice(idx + q.length);
}

function globalSearch(raw) {
  const panel  = document.getElementById('globalSearchResults');
  const q      = raw.trim().toLowerCase();
  if (!q) { panel.style.display = 'none'; return; }

  const tables  = PROJECT.tables || {};
  const results = [];
  for (const [tname, tbl] of Object.entries(tables)) {
    if (tbl.name.toLowerCase().includes(q) || tname.toLowerCase().includes(q))
      results.push({ type: 'table', tname, tbl });
    for (const col of tbl.columns) {
      if (col.name.toLowerCase().includes(q) || col.type.toLowerCase().includes(q))
        results.push({ type: 'col', tname, tbl, col });
    }
  }

  if (!results.length) {
    panel.innerHTML = '<div class="gs-empty">Nessun risultato</div>';
    panel.style.display = '';
    return;
  }

  let html = '';
  results.slice(0, 25).forEach(r => {
    if (r.type === 'table') {
      html += `<div class="gs-row gs-row--table" onclick="gsFocusTable('${r.tname}')">
        <span class="gs-badge">TBL</span>
        <span class="gs-name">${_gsHi(r.tbl.name, q)}</span>
      </div>`;
    } else {
      const badges = (r.col.pk ? '<span class="nav-col-pk">PK</span>' : '') +
                     (r.col.fk ? '<span class="nav-col-fk">FK</span>' : '');
      html += `<div class="gs-row" onclick="gsFocusCol('${r.tname}','${r.col.name}')">
        <span class="gs-tname">${r.tbl.name}</span>
        <span class="gs-name">${badges}${_gsHi(r.col.name, q)}</span>
        <code class="gs-type">${r.col.type}</code>
      </div>`;
    }
  });
  if (results.length > 25)
    html += `<div class="gs-more">+${results.length - 25} altri — affina la ricerca</div>`;

  panel.innerHTML = html;
  panel.style.display = '';
}

function _gsClear() {
  const inp = document.getElementById('tableSearch');
  inp.value = '';
  inp.dispatchEvent(new Event('input'));  // restore sidebar filter
  globalSearch('');
}

function gsFocusTable(tname) {
  _gsClear();
  const diagBtn = document.querySelector('.toolbar-tab[data-tab="diagram"]');
  if (diagBtn) switchTab('diagram', diagBtn);
  if (diagram) diagram.focusTable(tname);
}

function gsFocusCol(tname, colname) {
  _gsClear();
  const diagBtn = document.querySelector('.toolbar-tab[data-tab="diagram"]');
  if (diagBtn) switchTab('diagram', diagBtn);
  if (diagram) diagram.focusTable(tname);
  setTimeout(() => expandAndPulse(tname, colname), 300);
}

// ── Export dropdown ───────────────────────────────────────────────────────────

function toggleExportMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('exportMenu');
  const chev = document.querySelector('.export-chevron');
  const open = menu.classList.contains('open');
  menu.classList.toggle('open', !open);
  chev.classList.toggle('open', !open);
}

document.addEventListener('click', () => {
  const menu = document.getElementById('exportMenu');
  const chev = document.querySelector('.export-chevron');
  menu.classList.remove('open');
  chev.classList.remove('open');
});


// ── Tab close — persists state in localStorage ────────────────────────────────

const HIDDEN_KEY = 'dbml_hidden_tabs';

function getHidden() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); } catch { return []; }
}
function addHidden(id) {
  const h = getHidden();
  if (!h.includes(id)) { h.push(id); localStorage.setItem(HIDDEN_KEY, JSON.stringify(h)); }
}
function removeHidden(id) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(getHidden().filter(x => x !== id)));
}

// Always show current project; hide previously closed tabs
(function applyHidden() {
  removeHidden(PROJECT.id);
  const hidden = getHidden();
  document.querySelectorAll('.project-tab[data-id]').forEach(tab => {
    if (hidden.includes(tab.dataset.id)) tab.remove();
  });
})();

document.querySelectorAll('.tab-close').forEach(btn => {
  btn.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const tab    = btn.closest('.project-tab');
    const id     = tab.dataset.id;
    const active = btn.dataset.active === 'true';
    addHidden(id);
    if (active) {
      const tabs = [...document.querySelectorAll('.project-tab:not(.project-tab-new)')];
      const idx  = tabs.indexOf(tab);
      const next = tabs[idx - 1] || tabs[idx + 1];
      tab.remove();
      window.location.href = next ? next.querySelector('.tab-link').href : '/';
    } else {
      tab.remove();
    }
  });
});
