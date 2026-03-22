/**
 * diagram/core.js — Diagram class skeleton, constructor, color helpers
 */

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
    this._history         = [];
    this._historyIndex    = -1;

    this._activeRef      = null;
    this._groupColorMap  = this._buildColorMap();
    this._tableGroupMap  = this._buildTableGroupMap();

    this._setupDOM();
    this._autoLayout();
    this._renderGroupContainers();
    this._renderCards();
    this._renderNotes();
    this._renderConnections();
    this._bindPanZoom();
    this._applyTransform();
    this._restoreVisibility();
    this._setupMinimap();
    this._pushHistory();
    this._bindUndoRedo();
  }

  // ── color helpers ────────────────────────────────────────

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
}
