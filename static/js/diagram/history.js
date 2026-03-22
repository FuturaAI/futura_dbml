/**
 * @file history.js — undo/redo stack (Ctrl+Z / Ctrl+Y)
 */

Object.assign(Diagram.prototype, {

  /**
   * Snapshot current state and push it onto the history stack.
   * Trims any future states (clears redo branch) and caps at 60 entries.
   * @this {Diagram}
   */
  _pushHistory() {
    this._history = this._history.slice(0, this._historyIndex + 1);
    this._history.push({
      positions: JSON.parse(JSON.stringify(this.positions)),
      notes:     JSON.parse(JSON.stringify(this.project.notes || [])),
    });
    this._historyIndex++;
    if (this._history.length > 60) {
      this._history.shift();
      this._historyIndex--;
    }
  },

  /**
   * Apply a history snapshot to the diagram (used by undo/redo).
   * @this {Diagram}
   * @param {HistoryEntry} state
   */
  _restoreHistoryState(state) {
    this.positions = JSON.parse(JSON.stringify(state.positions));
    for (const [name, pos] of Object.entries(this.positions)) {
      const card = this.cards[name];
      if (card) { card.style.left = pos.x + 'px'; card.style.top = pos.y + 'px'; }
    }
    this.project.notes = JSON.parse(JSON.stringify(state.notes));
    Object.values(this._notes).forEach(n => n.el.remove());
    this._notes = {};
    this._renderNotes();
    this._updateGroupContainers();
    this._renderConnections();
    this._updateSVGSize();
    this._savePositions();
    this._saveNotes();
  },

  /**
   * Move one step back in history.
   * @this {Diagram}
   */
  undo() {
    if (this._historyIndex <= 0) return;
    this._historyIndex--;
    this._restoreHistoryState(this._history[this._historyIndex]);
  },

  /**
   * Move one step forward in history.
   * @this {Diagram}
   */
  redo() {
    if (this._historyIndex >= this._history.length - 1) return;
    this._historyIndex++;
    this._restoreHistoryState(this._history[this._historyIndex]);
  },

  /**
   * Register keyboard shortcuts Ctrl+Z (undo) and Ctrl+Y / Ctrl+Shift+Z (redo).
   * @this {Diagram}
   */
  _bindUndoRedo() {
    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); this.redo(); }
    });
  },

});
