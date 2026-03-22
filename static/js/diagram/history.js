/**
 * diagram/history.js — undo/redo stack (Ctrl+Z / Ctrl+Y)
 */

Object.assign(Diagram.prototype, {

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

  undo() {
    if (this._historyIndex <= 0) return;
    this._historyIndex--;
    this._restoreHistoryState(this._history[this._historyIndex]);
  },

  redo() {
    if (this._historyIndex >= this._history.length - 1) return;
    this._historyIndex++;
    this._restoreHistoryState(this._history[this._historyIndex]);
  },

  _bindUndoRedo() {
    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); this.redo(); }
    });
  },

});
