/**
 * @file ui.js — tabs, sidebar, rename, export menu,
 *               DBML/SQL/SVG/PDF export, tab close
 */

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
