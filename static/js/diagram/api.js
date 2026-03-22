/**
 * @file api.js — public API methods + bootstrap
 */

Object.assign(Diagram.prototype, {

  /**
   * Select and highlight a specific FK reference.
   * @this {Diagram}
   * @param {Ref} ref
   */
  focusRef(ref) {
    this.activeTable = null;
    this._activeRef  = ref;
    this._renderConnections();

    Object.entries(this.cards).forEach(([name, card]) => {
      const related = name === ref.from_table || name === ref.to_table;
      card.style.opacity = related ? '1' : '0.4';
      card.classList.toggle('highlighted', related);
    });

    this.canvas.querySelectorAll('.col-row.ref-highlight').forEach(r => r.classList.remove('ref-highlight'));
    const fromCard = this.cards[ref.from_table];
    const toCard   = this.cards[ref.to_table];
    if (fromCard) {
      const row = fromCard.querySelector(`.col-row[data-col="${ref.from_col}"]`);
      if (row) row.classList.add('ref-highlight');
    }
    if (toCard) {
      const row = toCard.querySelector(`.col-row[data-col="${ref.to_col}"]`);
      if (row) row.classList.add('ref-highlight');
    }

    this.container.dispatchEvent(new CustomEvent('refSelected', { detail: ref, bubbles: true }));
  },

  /**
   * Select a table, highlight its connections, and pan to centre it.
   * @this {Diagram}
   * @param {string} name
   */
  focusTable(name) {
    this.activeTable = name;
    this._activeRef  = null;
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
  },

  /** @this {Diagram} */
  zoomIn()    { this.scale = Math.min(3,    this.scale * 1.15); this._applyTransform(); },
  /** @this {Diagram} */
  zoomOut()   { this.scale = Math.max(0.15, this.scale / 1.15); this._applyTransform(); },
  /** @this {Diagram} */
  resetView() { this.scale = 0.85; this.panX = 0; this.panY = 0; this._applyTransform(); },

  /**
   * Fit all visible tables into the viewport.
   * @this {Diagram}
   */
  fitToScreen() {
    const tables = this.project.tables || {};
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [name, tbl] of Object.entries(tables)) {
      if (this._hiddenTables.has(name)) continue;
      const grp = this._tableGroupMap[name];
      if (grp && this._hiddenGroups.has(grp)) continue;
      const pos = this.positions[name];
      if (!pos) continue;
      minX = Math.min(minX, pos.x); minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + CARD_WIDTH);
      maxY = Math.max(maxY, pos.y + this._cardHeight(tbl));
    }
    if (!isFinite(minX)) return;
    const rect = this.container.getBoundingClientRect();
    const PAD  = 48;
    const sx = (rect.width  - PAD * 2) / (maxX - minX);
    const sy = (rect.height - PAD * 2) / (maxY - minY);
    this.scale = Math.min(3, Math.max(0.15, Math.min(sx, sy)));
    this.panX  = PAD - minX * this.scale;
    this.panY  = PAD - minY * this.scale;
    this._applyTransform();
  },

  /**
   * Reset all table positions to the auto-layout grid.
   * @this {Diagram}
   */
  resetLayout() {
    const savedBackup = this.project.saved_positions;
    this.project.saved_positions = {};
    this.positions = {};
    this._autoLayout();
    this.project.saved_positions = savedBackup;
    for (const [name, card] of Object.entries(this.cards)) {
      const pos = this.positions[name];
      if (pos) { card.style.left = pos.x + 'px'; card.style.top = pos.y + 'px'; }
    }
    this._updateGroupContainers();
    this._renderConnections();
    this._updateSVGSize();
    this._pushHistory();
    this._savePositions();
  },

});

// ── Bootstrap ─────────────────────────────────────────────

/** @type {Diagram | null} */
let diagram = null;

document.addEventListener('DOMContentLoaded', () => {
  if (typeof PROJECT !== 'undefined') {
    diagram = new Diagram(PROJECT, 'diagramContainer');
  }
});
