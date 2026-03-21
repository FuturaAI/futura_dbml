/**
 * Interactive DBML diagram
 * - Group containers (drag group → moves all tables inside)
 * - Eye toggle per group (sidebar + container header)
 * - Persisted positions & notes
 * - Pan / Zoom / Drag individual tables
 * - SVG bezier connections with highlight
 * - Post-it sticky notes
 */

const GROUP_COLORS = [
  '#ef4444', '#3b82f6', '#a855f7', '#22c55e',
  '#f59e0b', '#06b6d4', '#f97316', '#ec4899',
];
const NOTE_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'];

const CARD_WIDTH     = 260;
const COL_ROW_H      = 26;
const HEADER_H       = 44;
const CARD_PAD_B     = 10;
const COL_GAP        = 90;
const ROW_GAP        = 36;
const START_X        = 60;
const START_Y        = 70;   // extra top so group labels don't clip
const GRP_PAD        = 24;   // padding inside group container
const GRP_LABEL_H    = 16;   // floating label clearance above border

// ── hex → rgba ───────────────────────────────────────────────────────────────
function hexRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── SVG eye icons ─────────────────────────────────────────────────────────────
const SVG_EYE_OPEN   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const SVG_EYE_CLOSED = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

// ─────────────────────────────────────────────────────────────────────────────

class Diagram {
  constructor(project, containerId) {
    this.project     = project;
    this.container   = document.getElementById(containerId);
    this.scale       = 0.85;
    this.panX        = 0;
    this.panY        = 0;
    this.positions   = {};
    this.cards       = {};
    this.activeTable = null;
    this._notes           = {};
    this._groupContainers = {};
    this._hiddenGroups    = new Set();
    this._hiddenTables    = new Set();
    this._saveTimeout     = null;
    this._notesTimeout    = null;

    this._groupColorMap = this._buildColorMap();
    this._tableGroupMap = this._buildTableGroupMap();

    this._setupDOM();
    this._autoLayout();
    this._renderGroupContainers();   // ← behind cards
    this._renderCards();
    this._renderNotes();
    this._renderConnections();
    this._bindPanZoom();
    this._applyTransform();
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  _cardHeight(table) {
    return HEADER_H + table.columns.length * COL_ROW_H + CARD_PAD_B;
  }

  _buildColorMap() {
    const map = {};
    Object.keys(this.project.groups || {}).forEach((name, i) => {
      map[name] = GROUP_COLORS[i % GROUP_COLORS.length];
    });
    map['__ungrouped__'] = '#64748b';
    return map;
  }

  _buildTableGroupMap() {
    const map = {};
    for (const [g, tables] of Object.entries(this.project.groups || {}))
      tables.forEach(t => { map[t] = g; });
    (this.project.ungrouped || []).forEach(t => { map[t] = '__ungrouped__'; });
    return map;
  }

  _color(tableName) {
    const g = this._tableGroupMap[tableName] || '__ungrouped__';
    return this._groupColorMap[g] || '#64748b';
  }

  // ── layout ──────────────────────────────────────────────────────────────────

  _autoLayout() {
    const tables    = this.project.tables    || {};
    const groups    = this.project.groups    || {};
    const ungrouped = this.project.ungrouped || [];
    const saved     = this.project.saved_positions || {};

    const tableNames = Object.keys(tables);
    const allSaved   = tableNames.length > 0 && tableNames.every(n => saved[n]);
    if (allSaved) { Object.assign(this.positions, saved); return; }

    let x = START_X;
    const layoutColumn = names => {
      let y = START_Y;
      names.forEach(name => {
        const tbl = tables[name];
        if (!tbl) return;
        this.positions[name] = saved[name] || { x, y };
        y += this._cardHeight(tbl) + ROW_GAP;
      });
      x += CARD_WIDTH + COL_GAP;
    };

    for (const names of Object.values(groups)) {
      const valid = names.filter(t => tables[t]);
      if (valid.length) layoutColumn(valid);
    }
    const validUngrouped = ungrouped.filter(t => tables[t]);
    if (validUngrouped.length) layoutColumn(validUngrouped);
  }

  // ── DOM setup ───────────────────────────────────────────────────────────────

  _setupDOM() {
    this.canvas = document.createElement('div');
    this.canvas.className = 'diagram-canvas';
    this.container.appendChild(this.canvas);

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'connections-svg');
    this.svg.innerHTML = `<defs>
      <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8"/>
      </marker>
      <marker id="arr-hi" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6"/>
      </marker>
    </defs>`;
    this.canvas.appendChild(this.svg);
  }

  // ── group containers ────────────────────────────────────────────────────────

  _renderGroupContainers() {
    const groups = this.project.groups || {};
    const tables = this.project.tables || {};

    for (const [groupName, tableNames] of Object.entries(groups)) {
      const valid = tableNames.filter(t => tables[t] && this.positions[t]);
      if (!valid.length) continue;

      const color = this._groupColorMap[groupName] || '#64748b';
      const el    = document.createElement('div');
      el.className = 'group-container';
      el.id        = `grp-${groupName.replace(/\W/g,'_')}`;
      el.style.border     = `2px solid ${color}`;
      el.style.background = hexRgba(color, 0.06);

      // Floating label
      const label = document.createElement('div');
      label.className = 'group-cont-label';
      label.style.background = color;
      label.innerHTML = `
        <span class="group-cont-name">${groupName}</span>
        <button class="group-eye-btn" data-group="${groupName}" title="Mostra/nascondi">
          ${SVG_EYE_OPEN}
        </button>
      `;
      label.querySelector('.group-eye-btn').addEventListener('click', e => {
        e.stopPropagation();
        this.toggleGroupVisibility(groupName);
      });
      el.appendChild(label);

      this._makeGroupDraggable(el, groupName, valid);
      // Insert before SVG so it stays behind cards
      this.canvas.insertBefore(el, this.svg);
      this._groupContainers[groupName] = el;
    }

    this._updateGroupContainers();
  }

  _updateGroupContainers() {
    const tables = this.project.tables || {};
    const groups = this.project.groups || {};

    for (const [groupName, el] of Object.entries(this._groupContainers)) {
      const tableNames = groups[groupName] || [];
      const valid = tableNames.filter(t => tables[t] && this.positions[t]);
      if (!valid.length) continue;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const name of valid) {
        const pos = this.positions[name];
        const h   = this._cardHeight(tables[name]);
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + CARD_WIDTH);
        maxY = Math.max(maxY, pos.y + h);
      }

      el.style.left   = (minX - GRP_PAD) + 'px';
      el.style.top    = (minY - GRP_PAD - GRP_LABEL_H) + 'px';
      el.style.width  = (maxX - minX + GRP_PAD * 2) + 'px';
      el.style.height = (maxY - minY + GRP_PAD * 2 + GRP_LABEL_H) + 'px';
    }
  }

  _makeGroupDraggable(el, groupName, tableNames) {
    let dragging = false, startMX, startMY;
    let startPos = {};

    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      // Don't drag if clicking on a table card or post-it inside
      if (e.target.closest('.table-card') || e.target.closest('.postit')) return;
      e.stopPropagation();
      e.preventDefault();
      dragging = true;
      startMX  = e.clientX;
      startMY  = e.clientY;
      tableNames.forEach(t => {
        if (this.positions[t]) startPos[t] = { ...this.positions[t] };
      });
      el.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = (e.clientX - startMX) / this.scale;
      const dy = (e.clientY - startMY) / this.scale;
      tableNames.forEach(t => {
        if (!startPos[t]) return;
        this.positions[t] = { x: startPos[t].x + dx, y: startPos[t].y + dy };
        const card = this.cards[t];
        if (card) { card.style.left = this.positions[t].x + 'px'; card.style.top = this.positions[t].y + 'px'; }
      });
      this._updateGroupContainers();
      this._renderConnections(this.activeTable);
      this._updateSVGSize();
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      startPos = {};
      el.style.cursor = '';
      this._savePositions();
    });
  }

  // ── eye toggle ───────────────────────────────────────────────────────────────

  toggleGroupVisibility(groupName) {
    const hidden = this._hiddenGroups.has(groupName);
    hidden ? this._hiddenGroups.delete(groupName) : this._hiddenGroups.add(groupName);
    const nowHidden = !hidden;

    const tableNames = (this.project.groups || {})[groupName] || [];
    tableNames.forEach(t => {
      const card = this.cards[t];
      if (card) card.style.display = nowHidden ? 'none' : '';
    });

    // Update container appearance
    const cont = this._groupContainers[groupName];
    if (cont) {
      cont.classList.toggle('group-hidden', nowHidden);
      const btn = cont.querySelector('.group-eye-btn');
      if (btn) btn.innerHTML = nowHidden ? SVG_EYE_CLOSED : SVG_EYE_OPEN;
    }

    // Update sidebar icon
    const sideBtn = document.querySelector(`.nav-group-eye[data-group="${groupName}"]`);
    if (sideBtn) {
      sideBtn.innerHTML = nowHidden ? SVG_EYE_CLOSED : SVG_EYE_OPEN;
      sideBtn.classList.toggle('eye-off', nowHidden);
    }

    this._renderConnections(this.activeTable);
  }

  toggleTableVisibility(name) {
    const hidden = this._hiddenTables.has(name);
    hidden ? this._hiddenTables.delete(name) : this._hiddenTables.add(name);
    const nowHidden = !hidden;

    const card = this.cards[name];
    if (card) {
      card.classList.toggle('table-hidden', nowHidden);
      const body = card.querySelector('.card-body');
      if (body) body.style.display = nowHidden ? 'none' : '';
      const btn = card.querySelector('.card-eye-btn');
      if (btn) btn.innerHTML = nowHidden ? SVG_EYE_CLOSED : SVG_EYE_OPEN;
    }

    // Sidebar icon
    const sideBtn = document.querySelector(`.nav-table-eye[data-table="${name}"]`);
    if (sideBtn) {
      sideBtn.innerHTML = nowHidden ? SVG_EYE_CLOSED : SVG_EYE_OPEN;
      sideBtn.classList.toggle('eye-off', nowHidden);
    }

    // Also collapse the group container height if needed
    this._updateGroupContainers();
    this._renderConnections(this.activeTable);
  }

  // ── table cards ──────────────────────────────────────────────────────────────

  _renderCards() {
    for (const [name, tbl] of Object.entries(this.project.tables || {})) {
      const pos = this.positions[name];
      if (!pos) continue;

      const color = this._color(name);
      const card  = document.createElement('div');
      card.className  = 'table-card';
      card.id         = `card-${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      card.style.left = pos.x + 'px';
      card.style.top  = pos.y + 'px';

      const header = document.createElement('div');
      header.className = 'card-header';
      header.style.background = color;
      header.innerHTML = `
        <div class="card-header-left">
          ${tbl.schema ? `<span class="card-schema">${tbl.schema}</span>` : ''}
          <span class="card-table-name">${tbl.name}</span>
        </div>
        <button class="card-eye-btn" title="Mostra/nascondi">${SVG_EYE_OPEN}</button>
      `;
      header.querySelector('.card-eye-btn').addEventListener('click', e => {
        e.stopPropagation();
        this.toggleTableVisibility(name);
      });
      card.appendChild(header);

      const body = document.createElement('div');
      body.className = 'card-body';
      tbl.columns.forEach(col => {
        const row = document.createElement('div');
        row.className   = 'col-row';
        row.dataset.col = col.name;
        const pkIcon = col.pk
          ? `<span class="col-pk-icon" style="color:#f59e0b" title="PK">&#128273;</span>`
          : `<span class="col-pk-icon"></span>`;
        let badges = '';
        if (col.fk)                  badges += `<span class="badge-card-fk">FK</span>`;
        if (col.not_null && !col.pk) badges += `<span class="badge-card-nn">NN</span>`;
        if (col.unique)              badges += `<span class="badge-card-uq">UQ</span>`;
        row.innerHTML = `${pkIcon}
          <span class="col-name" title="${col.name}">${col.name}</span>
          <span class="col-type-label">${col.type}</span>
          ${badges ? `<span class="col-badges">${badges}</span>` : ''}`;
        body.appendChild(row);
      });
      card.appendChild(body);

      card.addEventListener('mouseenter', () => {
        if (!this.activeTable) this._highlightConnections(name);
      });
      card.addEventListener('mouseleave', () => {
        if (!this.activeTable) this._renderConnections();
      });
      card.addEventListener('click', e => { e.stopPropagation(); this.focusTable(name); });

      this._makeDraggable(card, name);
      this.cards[name] = card;
      this.canvas.appendChild(card);
    }
    this._updateSVGSize();
  }

  // ── connections ──────────────────────────────────────────────────────────────

  _renderConnections(highlightTable = null) {
    this.svg.querySelectorAll('path.conn').forEach(p => p.remove());
    const tables = this.project.tables || {};

    (this.project.refs || []).forEach(ref => {
      const fromTbl = tables[ref.from_table];
      const toTbl   = tables[ref.to_table];
      const fromPos = this.positions[ref.from_table];
      const toPos   = this.positions[ref.to_table];
      if (!fromTbl || !toTbl || !fromPos || !toPos) return;

      // Skip connections involving hidden groups or hidden individual tables
      const fromGrp = this._tableGroupMap[ref.from_table];
      const toGrp   = this._tableGroupMap[ref.to_table];
      if (this._hiddenGroups.has(fromGrp)        || this._hiddenGroups.has(toGrp))        return;
      if (this._hiddenTables.has(ref.from_table) || this._hiddenTables.has(ref.to_table)) return;

      const fromColIdx = fromTbl.columns.findIndex(c => c.name === ref.from_col);
      const toColIdx   = toTbl.columns.findIndex(c => c.name === ref.to_col);
      const fromRowY   = HEADER_H + Math.max(0, fromColIdx) * COL_ROW_H + COL_ROW_H / 2;
      const toRowY     = HEADER_H + Math.max(0, toColIdx)   * COL_ROW_H + COL_ROW_H / 2;

      let x1, x2;
      if (fromPos.x <= toPos.x) { x1 = fromPos.x + CARD_WIDTH; x2 = toPos.x; }
      else                       { x1 = fromPos.x;               x2 = toPos.x + CARD_WIDTH; }

      const y1   = fromPos.y + fromRowY;
      const y2   = toPos.y   + toRowY;
      const cpDx = Math.max(60, Math.abs(x2 - x1) * 0.45);
      const cp1x = x1 + (fromPos.x <= toPos.x ?  cpDx : -cpDx);
      const cp2x = x2 + (fromPos.x <= toPos.x ? -cpDx :  cpDx);

      const isHi = highlightTable &&
        (ref.from_table === highlightTable || ref.to_table === highlightTable);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'conn');
      path.setAttribute('d', `M ${x1} ${y1} C ${cp1x} ${y1} ${cp2x} ${y2} ${x2} ${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', isHi ? '#3b82f6' : '#cbd5e1');
      path.setAttribute('stroke-width', isHi ? '2' : '1.5');
      path.setAttribute('marker-end', isHi ? 'url(#arr-hi)' : 'url(#arr)');
      if (highlightTable && !isHi) path.style.opacity = '0.25';
      this.svg.appendChild(path);
    });
  }

  _highlightConnections(tableName) {
    this._renderConnections(tableName);
    const refs = this.project.refs || [];
    Object.entries(this.cards).forEach(([name, card]) => {
      if (card.style.display === 'none' || this._hiddenTables.has(name)) return;
      const related = name === tableName || refs.some(r =>
        (r.from_table === tableName || r.to_table === tableName) &&
        (r.from_table === name      || r.to_table === name)
      );
      card.style.opacity = related ? '1' : '0.4';
    });
  }

  _clearHighlight() {
    Object.values(this.cards).forEach(c => { c.style.opacity = '1'; });
    this._renderConnections();
  }

  // ── drag individual table ────────────────────────────────────────────────────

  _makeDraggable(card, name) {
    let dragging = false, startMX, startMY, startPX, startPY, hasMoved;

    card.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      dragging = true; hasMoved = false;
      startMX = e.clientX; startMY = e.clientY;
      startPX = this.positions[name].x; startPY = this.positions[name].y;
      card.style.zIndex = '20';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = (e.clientX - startMX) / this.scale;
      const dy = (e.clientY - startMY) / this.scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
      this.positions[name] = { x: startPX + dx, y: startPY + dy };
      card.style.left = this.positions[name].x + 'px';
      card.style.top  = this.positions[name].y + 'px';
      this._updateGroupContainers();
      this._renderConnections(this.activeTable);
      this._updateSVGSize();
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      card.style.zIndex = '';
      if (hasMoved) this._savePositions();
      else          this.focusTable(name);
    });
  }

  _savePositions() {
    clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      fetch(`/project/${this.project.id}/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.positions),
      });
    }, 600);
  }

  // ── post-it notes ────────────────────────────────────────────────────────────

  _renderNotes() {
    (this.project.notes || []).forEach(n => this._createNoteElement(n));
  }

  _createNoteElement(note) {
    const el = document.createElement('div');
    el.className  = 'postit';
    el.id         = `note-${note.id}`;
    el.style.left = note.x + 'px';
    el.style.top  = note.y + 'px';
    el.style.setProperty('--note-color', note.color || '#fef08a');

    const dots = NOTE_COLORS.map(c =>
      `<span class="note-color-dot" style="background:${c}" data-color="${c}"></span>`
    ).join('');

    el.innerHTML = `
      <div class="postit-handle">
        <div class="note-colors">${dots}</div>
        <button class="postit-delete" title="Elimina">&#10005;</button>
      </div>
      <div class="postit-body" contenteditable="true" spellcheck="false">${note.text || ''}</div>
    `;

    el.querySelector('.postit-delete').addEventListener('click', e => {
      e.stopPropagation(); this.deleteNote(note.id);
    });
    el.querySelector('.postit-body').addEventListener('input', ev => {
      note.text = ev.target.innerText; this._saveNotes();
    });
    el.querySelectorAll('.note-color-dot').forEach(dot => {
      dot.addEventListener('click', e => {
        e.stopPropagation();
        this._changeNoteColor(note.id, dot.dataset.color);
      });
    });

    this._makeNoteDraggable(el, note);
    this.canvas.appendChild(el);
    this._notes[note.id] = { el, data: note };
  }

  _makeNoteDraggable(el, note) {
    const handle = el.querySelector('.postit-handle');
    let dragging = false, startMX, startMY, startPX, startPY;

    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      dragging = true;
      startMX = e.clientX; startMY = e.clientY;
      startPX = note.x; startPY = note.y;
      el.style.zIndex = '30';
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      note.x = startPX + (e.clientX - startMX) / this.scale;
      note.y = startPY + (e.clientY - startMY) / this.scale;
      el.style.left = note.x + 'px';
      el.style.top  = note.y + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false; el.style.zIndex = '';
      this._saveNotes();
    });
  }

  addNote(canvasX, canvasY) {
    const x = (canvasX - this.panX) / this.scale;
    const y = (canvasY - this.panY) / this.scale;
    const note = { id: Date.now().toString(), x, y, text: '', color: NOTE_COLORS[0] };
    if (!this.project.notes) this.project.notes = [];
    this.project.notes.push(note);
    this._createNoteElement(note);
    this._saveNotes();
    setTimeout(() => {
      const el = document.getElementById(`note-${note.id}`);
      if (el) el.querySelector('.postit-body').focus();
    }, 50);
  }

  deleteNote(id) {
    const n = this._notes[id];
    if (n) { n.el.remove(); delete this._notes[id]; }
    this.project.notes = (this.project.notes || []).filter(n => n.id !== id);
    this._saveNotes();
  }

  _changeNoteColor(id, color) {
    const n = this._notes[id];
    if (!n) return;
    n.data.color = color;
    n.el.style.setProperty('--note-color', color);
    this._saveNotes();
  }

  _saveNotes() {
    clearTimeout(this._notesTimeout);
    this._notesTimeout = setTimeout(() => {
      fetch(`/project/${this.project.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.project.notes || []),
      });
    }, 500);
  }

  // ── pan & zoom ───────────────────────────────────────────────────────────────

  _bindPanZoom() {
    let panning = false, px0, py0;

    this.container.addEventListener('mousedown', e => {
      const onBg = e.target === this.container ||
                   e.target === this.canvas     ||
                   e.target === this.svg;
      if (!onBg) return;
      panning = true;
      px0 = e.clientX - this.panX;
      py0 = e.clientY - this.panY;
      this.container.style.cursor = 'grabbing';
      this.activeTable = null;
      this._clearHighlight();
      document.querySelectorAll('.nav-table-item').forEach(el => el.classList.remove('active'));
      Object.values(this.cards).forEach(c => c.classList.remove('highlighted'));
    });

    document.addEventListener('mousemove', e => {
      if (!panning) return;
      this.panX = e.clientX - px0;
      this.panY = e.clientY - py0;
      this._applyTransform();
    });

    document.addEventListener('mouseup', () => { panning = false; this.container.style.cursor = ''; });

    // Double-click empty canvas → add note
    this.container.addEventListener('dblclick', e => {
      const onBg = e.target === this.container || e.target === this.canvas || e.target === this.svg;
      if (!onBg) return;
      const rect = this.container.getBoundingClientRect();
      this.addNote(e.clientX - rect.left, e.clientY - rect.top);
    });

    this.container.addEventListener('wheel', e => {
      e.preventDefault();
      const factor   = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(3, Math.max(0.15, this.scale * factor));
      const rect = this.container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      this.panX = cx - (cx - this.panX) * (newScale / this.scale);
      this.panY = cy - (cy - this.panY) * (newScale / this.scale);
      this.scale = newScale;
      this._applyTransform();
    }, { passive: false });
  }

  _applyTransform() {
    this.canvas.style.transform = `translate(${this.panX}px,${this.panY}px) scale(${this.scale})`;
    const label = document.getElementById('zoomLabel');
    if (label) label.textContent = Math.round(this.scale * 100) + '%';
  }

  _updateSVGSize() {
    let maxX = 400, maxY = 400;
    const tables = this.project.tables || {};
    for (const [name, pos] of Object.entries(this.positions)) {
      const tbl = tables[name];
      if (!tbl) continue;
      maxX = Math.max(maxX, pos.x + CARD_WIDTH + START_X);
      maxY = Math.max(maxY, pos.y + this._cardHeight(tbl) + START_Y);
    }
    for (const { data } of Object.values(this._notes)) {
      maxX = Math.max(maxX, data.x + 260);
      maxY = Math.max(maxY, data.y + 200);
    }
    this.svg.style.width  = maxX + 'px';
    this.svg.style.height = maxY + 'px';
    this.svg.setAttribute('width',  maxX);
    this.svg.setAttribute('height', maxY);
    this.canvas.style.width  = maxX + 'px';
    this.canvas.style.height = maxY + 'px';
  }

  // ── public API ───────────────────────────────────────────────────────────────

  focusTable(name) {
    this.activeTable = name;
    this._highlightConnections(name);
    Object.values(this.cards).forEach(c => c.classList.remove('highlighted'));
    const card = this.cards[name];
    if (card) card.classList.add('highlighted');

    const pos = this.positions[name];
    const tbl = (this.project.tables || {})[name];
    if (pos && tbl) {
      const rect = this.container.getBoundingClientRect();
      const cardH = this._cardHeight(tbl);
      this.panX = rect.width  / 2 - (pos.x + CARD_WIDTH / 2) * this.scale;
      this.panY = rect.height / 2 - (pos.y + cardH       / 2) * this.scale;
      this._applyTransform();
    }
  }

  zoomIn()    { this.scale = Math.min(3,    this.scale * 1.15); this._applyTransform(); }
  zoomOut()   { this.scale = Math.max(0.15, this.scale / 1.15); this._applyTransform(); }
  resetView() { this.scale = 0.85; this.panX = 0; this.panY = 0; this._applyTransform(); }
}

// ── bootstrap ─────────────────────────────────────────────────────────────────

let diagram = null;

document.addEventListener('DOMContentLoaded', () => {
  if (typeof PROJECT !== 'undefined') {
    diagram = new Diagram(PROJECT, 'diagramContainer');
  }
});
