/**
 * @file core.js — Diagram class skeleton, constructor, colour helpers
 */

class Diagram {
  /**
   * @param {Project} project
   * @param {string}  containerId
   */
  constructor(project, containerId) {
    /** @type {Project} */
    this.project = project;
    /** @type {HTMLElement} */
    this.container = /** @type {HTMLElement} */ (document.getElementById(containerId));
    /** @type {number} */
    this.scale = 0.85;
    /** @type {number} */
    this.panX = 0;
    /** @type {number} */
    this.panY = 0;
    /** @type {Record<string, Position>} */
    this.positions = {};
    /** @type {Record<string, HTMLElement>} */
    this.cards = {};
    /** @type {string | null} */
    this.activeTable = null;
    /** @type {Record<string, NoteEntry>} */
    this._notes = {};
    /** @type {Record<string, HTMLElement>} */
    this._groupContainers = {};
    /** @type {Set<string>} */
    this._hiddenGroups = new Set();
    /** @type {Set<string>} */
    this._hiddenTables = new Set();
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._saveTimeout = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._notesTimeout = null;
    /** @type {HistoryEntry[]} */
    this._history = [];
    /** @type {number} */
    this._historyIndex = -1;
    /** @type {Ref | null} */
    this._activeRef = null;
    /** @type {Record<string, string>} */
    this._groupColorMap = this._buildColorMap();
    /** @type {Record<string, string>} */
    this._tableGroupMap = this._buildTableGroupMap();

    // Minimap state (set by minimap.js)
    /** @type {HTMLDivElement | null} */
    this._mmEl = null;
    /** @type {HTMLCanvasElement | null} */
    this._mmCv = null;
    /** @type {CanvasRenderingContext2D | null} */
    this._mmCtx = null;
    /** @type {number} */
    this._mmW = 0;
    /** @type {number} */
    this._mmH = 0;
    /** @type {MinimapState | null} */
    this._mmLast = null;
    /** @type {boolean} */
    this._mmDragging = false;

    // Canvas & SVG (set by layout.js / _setupDOM)
    /** @type {HTMLDivElement} */
    this.canvas = /** @type {any} */ (null);
    /** @type {SVGSVGElement} */
    this.svg = /** @type {any} */ (null);

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

  // ── colour helpers ───────────────────────────────────────

  /**
   * @param {Table} table
   * @returns {number}
   */
  _cardHeight(table) {
    return HEADER_H + table.columns.length * COL_ROW_H + CARD_PAD_B;
  }

  /**
   * @returns {Record<string, string>}
   */
  _buildColorMap() {
    /** @type {Record<string, string>} */
    const map = {};
    Object.keys(this.project.groups || {}).forEach((name, i) => {
      map[name] = GROUP_COLORS[i % GROUP_COLORS.length];
    });
    map['__ungrouped__'] = '#64748b';
    return map;
  }

  /**
   * @returns {Record<string, string>}
   */
  _buildTableGroupMap() {
    /** @type {Record<string, string>} */
    const map = {};
    for (const [g, tables] of Object.entries(this.project.groups || {}))
      tables.forEach(t => { map[t] = g; });
    (this.project.ungrouped || []).forEach(t => { map[t] = '__ungrouped__'; });
    return map;
  }

  /**
   * @param {string} tableName
   * @returns {string}
   */
  _color(tableName) {
    const g = this._tableGroupMap[tableName] || '__ungrouped__';
    return this._groupColorMap[g] || '#64748b';
  }
}
