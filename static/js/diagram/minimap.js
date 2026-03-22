/**
 * @file minimap.js — canvas minimap + SVG/canvas size sync
 */

Object.assign(Diagram.prototype, {

  /**
   * Create the minimap widget and append it to the diagram container.
   * @this {Diagram}
   */
  _setupMinimap() {
    // roundRect polyfill for older browsers
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function(
        /** @type {number} */ x,
        /** @type {number} */ y,
        /** @type {number} */ w,
        /** @type {number} */ h,
        /** @type {number} */ r
      ) {
        r = Math.min(r, w / 2, h / 2);
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);  this.arcTo(x + w, y, x + w, y + r, r);
        this.lineTo(x + w, y + h - r); this.arcTo(x + w, y + h, x + w - r, y + h, r);
        this.lineTo(x + r, y + h);  this.arcTo(x, y + h, x, y + h - r, r);
        this.lineTo(x, y + r);      this.arcTo(x, y, x + r, y, r);
        this.closePath();
      };
    }

    const MM_W = 200, MM_H = 130;
    const DPR  = window.devicePixelRatio || 1;

    const wrap = document.createElement('div');
    wrap.className = 'minimap';

    const header = document.createElement('div');
    header.className = 'minimap-header';
    header.textContent = 'Mappa';

    const toggle = document.createElement('button');
    toggle.className = 'minimap-toggle';
    toggle.title = 'Nascondi mappa';
    toggle.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

    let collapsed = false;
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      collapsed = !collapsed;
      cv.style.display = collapsed ? 'none' : 'block';
      wrap.classList.toggle('minimap-collapsed', collapsed);
      toggle.title = collapsed ? 'Mostra mappa' : 'Nascondi mappa';
      toggle.innerHTML = collapsed
        ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
        : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    });

    header.appendChild(toggle);
    wrap.appendChild(header);

    const cv = document.createElement('canvas');
    cv.className = 'minimap-canvas';
    cv.width  = MM_W * DPR;
    cv.height = MM_H * DPR;
    cv.style.width  = MM_W + 'px';
    cv.style.height = MM_H + 'px';
    wrap.appendChild(cv);
    this.container.appendChild(wrap);

    const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
    ctx.scale(DPR, DPR);

    this._mmEl       = wrap;
    this._mmCv       = cv;
    this._mmCtx      = ctx;
    this._mmW        = MM_W;
    this._mmH        = MM_H;
    this._mmLast     = null;
    this._mmDragging = false;

    /** @param {MouseEvent | Touch} e */
    const navigate = e => {
      const rect = cv.getBoundingClientRect();
      const last = this._mmLast;
      if (!last) return;
      const { mmScale, mmMinX, mmMinY } = last;
      const cx = (e.clientX - rect.left)  / mmScale + mmMinX;
      const cy = (e.clientY - rect.top)   / mmScale + mmMinY;
      const cr = this.container.getBoundingClientRect();
      this.panX = cr.width  / 2 - cx * this.scale;
      this.panY = cr.height / 2 - cy * this.scale;
      this._applyTransform();
    };

    cv.addEventListener('mousedown',  e => { e.stopPropagation(); this._mmDragging = true; navigate(e); });
    cv.addEventListener('mousemove',  e => { if (this._mmDragging) navigate(e); });
    document.addEventListener('mouseup', () => { this._mmDragging = false; });
    cv.addEventListener('touchstart', e => { e.stopPropagation(); this._mmDragging = true; navigate(e.touches[0]); }, { passive: true });
    cv.addEventListener('touchmove',  e => { if (this._mmDragging) navigate(e.touches[0]); }, { passive: true });
    cv.addEventListener('touchend',   () => { this._mmDragging = false; }, { passive: true });

    this._updateMinimap();
  },

  /**
   * Redraw the minimap canvas reflecting current positions and viewport.
   * @this {Diagram}
   */
  _updateMinimap() {
    if (!this._mmCtx) return;
    const tables = this.project.tables || {};
    const groups = this.project.groups || {};
    const ctx    = this._mmCtx;
    const W = this._mmW, H = this._mmH;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [name, tbl] of Object.entries(tables)) {
      if (this._hiddenTables.has(name)) continue;
      const grp = this._tableGroupMap[name];
      if (grp && this._hiddenGroups.has(grp)) continue;
      const pos = this.positions[name];
      if (!pos) continue;
      minX = Math.min(minX, pos.x);            minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + CARD_WIDTH); maxY = Math.max(maxY, pos.y + this._cardHeight(tbl));
    }
    if (!isFinite(minX)) { ctx.clearRect(0, 0, W, H); return; }

    const PAD = 10;
    const scaleX = (W - PAD * 2) / Math.max(1, maxX - minX);
    const scaleY = (H - PAD * 2) / Math.max(1, maxY - minY);
    const mmScale = Math.min(scaleX, scaleY);
    const mmMinX  = minX - PAD / mmScale;
    const mmMinY  = minY - PAD / mmScale;
    this._mmLast  = { mmScale, mmMinX, mmMinY };

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, W, H);

    // Group containers
    for (const [gname, tnames] of Object.entries(groups)) {
      if (this._hiddenGroups.has(gname)) continue;
      const color = this._groupColorMap[gname] || '#64748b';
      const valid = tnames.filter(t => tables[t] && this.positions[t] && !this._hiddenTables.has(t));
      if (!valid.length) continue;
      let gx1 = Infinity, gy1 = Infinity, gx2 = -Infinity, gy2 = -Infinity;
      for (const n of valid) {
        gx1 = Math.min(gx1, this.positions[n].x); gy1 = Math.min(gy1, this.positions[n].y);
        gx2 = Math.max(gx2, this.positions[n].x + CARD_WIDTH);
        gy2 = Math.max(gy2, this.positions[n].y + this._cardHeight(tables[n]));
      }
      const rx = (gx1 - GRP_PAD - mmMinX) * mmScale;
      const ry = (gy1 - GRP_PAD - GRP_LABEL_H - mmMinY) * mmScale;
      const rw = (gx2 - gx1 + GRP_PAD * 2) * mmScale;
      const rh = (gy2 - gy1 + GRP_PAD * 2 + GRP_LABEL_H) * mmScale;
      const r  = parseInt(color.slice(1, 3), 16);
      const g  = parseInt(color.slice(3, 5), 16);
      const b  = parseInt(color.slice(5, 7), 16);
      ctx.fillStyle   = `rgba(${r},${g},${b},0.12)`;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 3); ctx.fill(); ctx.stroke();
    }

    // Table cards
    for (const [name, tbl] of Object.entries(tables)) {
      if (this._hiddenTables.has(name)) continue;
      const grp = this._tableGroupMap[name];
      if (grp && this._hiddenGroups.has(grp)) continue;
      const pos = this.positions[name];
      if (!pos) continue;
      const color = this._color(name);
      const x = (pos.x - mmMinX) * mmScale, y = (pos.y - mmMinY) * mmScale;
      const w = CARD_WIDTH * mmScale,        h = this._cardHeight(tbl) * mmScale;
      const hh = Math.min(HEADER_H * mmScale, h);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, y, w, hh, 2); ctx.fill();
      if (hh < h) ctx.fillRect(x, y + hh - 1, w, 1);
    }

    // Viewport rect
    const cr = this.container.getBoundingClientRect();
    const vx = (-this.panX / this.scale - mmMinX) * mmScale;
    const vy = (-this.panY / this.scale - mmMinY) * mmScale;
    const vw = (cr.width  / this.scale) * mmScale;
    const vh = (cr.height / this.scale) * mmScale;
    ctx.fillStyle   = 'rgba(59,130,246,0.07)';
    ctx.strokeStyle = 'rgba(59,130,246,0.7)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.fill(); ctx.stroke();
  },

  /**
   * Resize the SVG overlay and canvas to fit all current content.
   * @this {Diagram}
   */
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
    this.svg.setAttribute('width',  String(maxX));
    this.svg.setAttribute('height', String(maxY));
    this.canvas.style.width  = maxX + 'px';
    this.canvas.style.height = maxY + 'px';
  },

});
