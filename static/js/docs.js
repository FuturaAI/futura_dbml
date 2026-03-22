/**
 * @file docs.js — documentation tab: notes, table notes, column notes,
 *                 canvas search, FK tooltip, docs collapse/expand
 */

// ── Error toast ───────────────────────────────────────────────────────────────

function _showApiError(msg) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#ef4444;color:#fff;' +
    'padding:10px 16px;border-radius:8px;font-size:13px;z-index:9999;' +
    'box-shadow:0 4px 12px rgba(0,0,0,.2);pointer-events:none';
  el.textContent = '\u26a0 ' + msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Multi-note system ─────────────────────────────────────────────────────────

let _docNotes     = (PROJECT.doc_notes || []);
let _docNoteTimer = null;

function switchDocsTab(name, btn) {
  document.querySelectorAll('.docs-subtab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.docs-subpanel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('docs-sub-' + name).classList.add('active');
}

function _saveDocNotes() {
  clearTimeout(_docNoteTimer);
  _docNoteTimer = setTimeout(() => {
    fetch(`/project/${PROJECT.id}/doc_notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_docNotes),
    })
      .then(r => { if (!r.ok) _showApiError('Errore salvataggio note (' + r.status + ')'); })
      .catch(() => _showApiError('Errore di rete (note)'));
  }, 700);
}

function docNoteAdd() {
  const note = { id: Date.now().toString(), title: 'Nuova nota', content: '' };
  _docNotes.push(note);
  _saveDocNotes();
  _renderDocNotes();
  setTimeout(() => {
    const card = document.getElementById('dncard-' + note.id);
    if (card) { card.scrollIntoView({ behavior: 'smooth' }); docNoteEdit(note.id); }
  }, 80);
}

function docNoteDelete(id) {
  if (!confirm('Eliminare questa nota?')) return;
  _docNotes = _docNotes.filter(n => n.id !== id);
  _saveDocNotes();
  _renderDocNotes();
}

function docNoteEdit(id) {
  const card = document.getElementById('dncard-' + id);
  if (!card) return;
  card.querySelector('.dn-view').style.display   = 'none';
  card.querySelector('.dn-editor').style.display = '';
  card.querySelector('.dn-textarea').focus();
}

function docNoteClose(id) {
  const note = _docNotes.find(n => n.id === id);
  const card = document.getElementById('dncard-' + id);
  if (!card || !note) return;
  const ta      = card.querySelector('.dn-textarea');
  note.content  = ta.value;
  const titleEl = card.querySelector('.dn-title-input');
  note.title    = titleEl.value || 'Nota';
  card.querySelector('.dn-view').style.display   = '';
  card.querySelector('.dn-editor').style.display = 'none';
  const body = card.querySelector('.dn-rendered');
  body.innerHTML = note.content.trim()
    ? marked.parse(note.content)
    : '<span class="md-empty">Nota vuota.</span>';
  card.querySelector('.dn-card-title').textContent = note.title;
  _saveDocNotes();
  _buildNoteList();
}

function _docNoteInput(id) {
  const note = _docNotes.find(n => n.id === id);
  if (!note) return;
  const card   = document.getElementById('dncard-' + id);
  note.content = card.querySelector('.dn-textarea').value;
  note.title   = card.querySelector('.dn-title-input').value || 'Nota';
  _saveDocNotes();
}

function _renderDocNotes() {
  const container = document.getElementById('docsNoteCards');
  if (!_docNotes.length) {
    container.innerHTML = '<div class="dn-empty">Nessuna nota. Clicca <strong>+ Nuova nota</strong> per iniziare.</div>';
    _buildNoteList();
    return;
  }
  container.innerHTML = '';
  for (const note of _docNotes) {
    const div = document.createElement('div');
    div.className = 'dn-card';
    div.id = 'dncard-' + note.id;
    const rendered = note.content.trim()
      ? marked.parse(note.content)
      : '<span class="md-empty">Nota vuota.</span>';
    div.innerHTML = `
      <div class="dn-view">
        <div class="dn-card-head">
          <span class="dn-card-title">${note.title}</span>
          <div style="display:flex;gap:6px">
            <button class="btn-edit-notes" onclick="docNoteEdit('${note.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Modifica
            </button>
            <button class="dn-delete-btn" onclick="docNoteDelete('${note.id}')" title="Elimina">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </div>
        <div class="dn-rendered notes-rendered">${rendered}</div>
      </div>
      <div class="dn-editor" style="display:none">
        <div class="dn-editor-head">
          <input class="dn-title-input" value="${note.title}" placeholder="Titolo nota" oninput="_docNoteInput('${note.id}')"/>
          <button class="btn-close-notes" onclick="docNoteClose('${note.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Salva
          </button>
        </div>
        <textarea class="dn-textarea" placeholder="Scrivi in Markdown..." oninput="_docNoteInput('${note.id}')">${note.content}</textarea>
      </div>`;
    container.appendChild(div);
  }
  _buildNoteList();
}

function _buildNoteList() {
  const list = document.getElementById('docsNoteList');
  if (!_docNotes.length) { list.innerHTML = '<span class="docs-bm-empty">Nessuna nota</span>'; return; }
  list.innerHTML = '';
  _docNotes.forEach(note => {
    const a = document.createElement('a');
    a.className   = 'docs-bm-item docs-bm-h1';
    a.textContent = note.title;
    a.href = '#';
    a.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('dncard-' + note.id)?.scrollIntoView({ behavior: 'smooth' });
    });
    list.appendChild(a);
  });
}

// keep stubs so existing references don't break
function renderNotes() {}
function initMarkdownEditor() { _renderDocNotes(); }

// ── DOMContentLoaded: notes + FK tooltip ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  _renderDocNotes();

  // Build FK lookup: "table::col" → {table, col}
  const fkLookup = {};
  (PROJECT.refs || []).forEach(r => {
    if (r.type === '>' || r.type === '-')
      fkLookup[`${r.from_table}::${r.from_col}`] = { table: r.to_table, col: r.to_col };
    if (r.type === '<' || r.type === '-')
      fkLookup[`${r.to_table}::${r.to_col}`] = { table: r.from_table, col: r.from_col };
  });

  const tip = document.createElement('div');
  tip.className = 'fk-tooltip';
  tip.innerHTML = '<span class="fk-tooltip-arrow">\u2192</span><span class="fk-tooltip-target"></span>';
  document.body.appendChild(tip);
  const tipTarget = tip.querySelector('.fk-tooltip-target');

  function moveTip(e) {
    tip.style.left = (e.clientX + 18) + 'px';
    tip.style.top  = (e.clientY - 16) + 'px';
  }

  document.querySelectorAll('.nav-col-row').forEach(row => {
    const tbl    = row.dataset.table;
    const col    = row.dataset.col;
    const target = fkLookup[`${tbl}::${col}`];
    if (!target) return;

    row.classList.add('has-fk');
    row.addEventListener('mouseenter', e => {
      const tName = (PROJECT.tables[target.table] || {}).name || target.table;
      tipTarget.textContent = `${tName}.${target.col}`;
      tip.style.display = 'block';
      moveTip(e);
    });
    row.addEventListener('mousemove', moveTip);
    row.addEventListener('mouseleave', () => tip.style.display = 'none');
    row.addEventListener('click', e => {
      e.stopPropagation();
      tip.style.display = 'none';
      focusTable(target.table, e);
      expandAndPulse(target.table, target.col);
    });
  });
});

// ── Canvas search ─────────────────────────────────────────────────────────────

function _clearCanvasSearch() {
  if (!diagram) return;
  Object.values(diagram.cards).forEach(c => { c.style.opacity = ''; });
}

let _csTimer = null;
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('canvasSearch').addEventListener('input', function () {
    clearTimeout(_csTimer);
    _csTimer = setTimeout(() => {
      if (!diagram) return;
      const q = this.value.toLowerCase().trim();
      if (!q) { _clearCanvasSearch(); return; }
      Object.entries(diagram.cards).forEach(([name, card]) => {
        const tbl   = PROJECT.tables[name];
        const match = name.toLowerCase().includes(q) ||
          (tbl && tbl.columns.some(c => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)));
        card.style.opacity = match ? '1' : '0.12';
      });
    }, 180);
  });
});

// ── Docs: collapse / expand all ──────────────────────────────────────────────

function collapseAllDocs() {
  document.querySelectorAll('.docs-group-toggle').forEach(el => {
    el.classList.add('collapsed');
    el.nextElementSibling.classList.add('collapsed');
  });
}

function expandAllDocs() {
  document.querySelectorAll('.docs-group-toggle, .docs-table-toggle').forEach(el => {
    el.classList.remove('collapsed');
    el.nextElementSibling.classList.remove('collapsed');
  });
}

function toggleDocsGroup(titleEl) {
  const body = titleEl.nextElementSibling;
  const open = !body.classList.contains('collapsed');
  titleEl.classList.toggle('collapsed', open);
  body.classList.toggle('collapsed', open);
}

function toggleDocsTable(headerEl) {
  const body = headerEl.nextElementSibling;
  const open = !body.classList.contains('collapsed');
  headerEl.classList.toggle('collapsed', open);
  body.classList.toggle('collapsed', open);
}

// ── Docs: inline table note editing ──────────────────────────────────────────

let _tblNotesCache = Object.assign({}, PROJECT.table_notes || {});
let _tblNoteTimer  = null;

function saveTableNote(el) {
  const tname = el.dataset.tname;
  const text  = el.innerText.trim();
  _tblNotesCache[tname] = text;
  clearTimeout(_tblNoteTimer);
  _tblNoteTimer = setTimeout(() => {
    fetch(`/project/${PROJECT.id}/table_notes`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(_tblNotesCache),
    })
      .then(r => { if (!r.ok) _showApiError('Errore salvataggio note tabella (' + r.status + ')'); })
      .catch(() => _showApiError('Errore di rete (note tabella)'));
  }, 800);
}

// ── Docs: inline column note editing ─────────────────────────────────────────

let _colNotesCache = Object.assign({}, PROJECT.column_notes || {});
let _colNoteTimer  = null;

function _saveColNotes() {
  clearTimeout(_colNoteTimer);
  _colNoteTimer = setTimeout(() => {
    fetch(`/project/${PROJECT.id}/column_notes`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(_colNotesCache),
    })
      .then(r => { if (!r.ok) _showApiError('Errore salvataggio note colonne (' + r.status + ')'); })
      .catch(() => _showApiError('Errore di rete (note colonne)'));
  }, 800);
}

document.addEventListener('DOMContentLoaded', () => {
  Object.entries(_colNotesCache).forEach(([key, text]) => {
    const [tbl, col] = key.split('::');
    const cell = document.querySelector(`.col-note[data-table="${tbl}"][data-col="${col}"]`);
    if (cell && text) cell.textContent = text;
  });

  document.querySelectorAll('td.col-note[contenteditable]').forEach(cell => {
    cell.addEventListener('blur', () => {
      const key  = `${cell.dataset.table}::${cell.dataset.col}`;
      const text = cell.textContent.trim();
      _colNotesCache[key] = text;
      _saveColNotes();
    });
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); cell.blur(); }
    });
    cell.addEventListener('click', e => e.stopPropagation());
  });
});
