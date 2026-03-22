/**
 * @file drag.js — individual table card drag + position persistence
 */

Object.assign(Diagram.prototype, {

  /**
   * Attach mouse/touch drag listeners to a table card.
   * @this {Diagram}
   * @param {HTMLElement} card
   * @param {string}      name  - table key
   */
  _makeDraggable(card, name) {
    let dragging = false;
    let startMX = 0, startMY = 0, startPX = 0, startPY = 0;
    let hasMoved = false;

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
      if (hasMoved) { this._pushHistory(); this._savePositions(); }
      else          this.focusTable(name);
    });

    card.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      const t = e.touches[0];
      dragging = true; hasMoved = false;
      startMX = t.clientX; startMY = t.clientY;
      startPX = this.positions[name].x; startPY = this.positions[name].y;
      card.style.zIndex = '20';
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      if (!dragging || e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      const dx = (t.clientX - startMX) / this.scale;
      const dy = (t.clientY - startMY) / this.scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
      this.positions[name] = { x: startPX + dx, y: startPY + dy };
      card.style.left = this.positions[name].x + 'px';
      card.style.top  = this.positions[name].y + 'px';
      this._updateGroupContainers();
      this._renderConnections(this.activeTable);
      this._updateSVGSize();
    }, { passive: false });

    card.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false; card.style.zIndex = '';
      if (hasMoved) { this._pushHistory(); this._savePositions(); }
      else          this.focusTable(name);
    }, { passive: true });
  },

  /**
   * Debounced POST to persist current positions to the server.
   * @this {Diagram}
   */
  _savePositions() {
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      fetch(`/project/${this.project.id}/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.positions),
      });
    }, 600);
  },

});
