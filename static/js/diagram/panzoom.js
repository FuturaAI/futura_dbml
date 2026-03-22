/**
 * diagram/panzoom.js — mouse/touch pan, wheel zoom, pinch zoom, transform apply
 */

Object.assign(Diagram.prototype, {

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

    // ── Touch pan & pinch-zoom ────────────────────────────
    let touchPanX0 = 0, touchPanY0 = 0, touchX0 = 0, touchY0 = 0;
    let lastPinchDist = null;

    this.container.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        const onBg = e.target === this.container || e.target === this.canvas || e.target === this.svg;
        if (!onBg) return;
        const t = e.touches[0];
        touchX0 = t.clientX; touchY0 = t.clientY;
        touchPanX0 = this.panX; touchPanY0 = this.panY;
        this.activeTable = null;
        this._clearHighlight();
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.hypot(dx, dy);
      }
    }, { passive: true });

    this.container.addEventListener('touchmove', e => {
      if (e.touches.length === 1) {
        const onBg = e.target === this.container || e.target === this.canvas || e.target === this.svg;
        if (!onBg) return;
        e.preventDefault();
        const t = e.touches[0];
        this.panX = touchPanX0 + (t.clientX - touchX0);
        this.panY = touchPanY0 + (t.clientY - touchY0);
        this._applyTransform();
      } else if (e.touches.length === 2 && lastPinchDist) {
        e.preventDefault();
        const dx   = e.touches[0].clientX - e.touches[1].clientX;
        const dy   = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newScale = Math.min(3, Math.max(0.15, this.scale * (dist / lastPinchDist)));
        const rect = this.container.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        this.panX = cx - (cx - this.panX) * (newScale / this.scale);
        this.panY = cy - (cy - this.panY) * (newScale / this.scale);
        this.scale = newScale;
        lastPinchDist = dist;
        this._applyTransform();
      }
    }, { passive: false });

    this.container.addEventListener('touchend', () => { lastPinchDist = null; }, { passive: true });

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
  },

  _applyTransform() {
    this.canvas.style.transform = `translate(${this.panX}px,${this.panY}px) scale(${this.scale})`;
    const label = document.getElementById('zoomLabel');
    if (label) label.textContent = Math.round(this.scale * 100) + '%';
    this._updateMinimap();
  },

});
