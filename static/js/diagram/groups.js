/**
 * @file groups.js — group containers, group drag, visibility toggling
 */

Object.assign(Diagram.prototype, {

  /**
   * Build and insert one container div per group behind the table cards.
   * @this {Diagram}
   */
  _renderGroupContainers() {
    const groups = this.project.groups || {};
    const tables = this.project.tables || {};

    for (const [groupName, tableNames] of Object.entries(groups)) {
      const valid = tableNames.filter(t => tables[t] && this.positions[t]);
      if (!valid.length) continue;

      const color = this._groupColorMap[groupName] || '#64748b';
      const el    = document.createElement('div');
      el.className = 'group-container';
      el.id        = `grp-${groupName.replace(/\W/g, '_')}`;
      el.style.border     = `2px solid ${color}`;
      el.style.background = hexRgba(color, 0.06);

      const label = document.createElement('div');
      label.className = 'group-cont-label';
      label.style.background = color;
      label.innerHTML = `
        <span class="group-cont-name">${groupName}</span>
        <button class="group-eye-btn" data-group="${groupName}" title="Mostra/nascondi">
          ${SVG_EYE_OPEN}
        </button>
      `;
      label.querySelector('.group-eye-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        this.toggleGroupVisibility(groupName);
      });
      el.appendChild(label);

      this._makeGroupDraggable(el, groupName, valid);
      this.canvas.insertBefore(el, this.svg);
      this._groupContainers[groupName] = el;
    }

    this._updateGroupContainers();
  },

  /**
   * Recompute the bounding box of each group container from current positions.
   * @this {Diagram}
   */
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
  },

  /**
   * Attach mouse/touch drag listeners to a group container element.
   * @this {Diagram}
   * @param {HTMLElement} el
   * @param {string}      groupName
   * @param {string[]}    tableNames
   */
  _makeGroupDraggable(el, groupName, tableNames) {
    let dragging = false;
    let startMX = 0, startMY = 0;
    /** @type {Record<string, Position>} */
    let startPos = {};

    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (/** @type {Element} */ (e.target).closest('.table-card') ||
          /** @type {Element} */ (e.target).closest('.postit')) return;
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
      this._pushHistory();
      this._savePositions();
    });

    el.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      if (/** @type {Element} */ (e.target).closest('.table-card') ||
          /** @type {Element} */ (e.target).closest('.postit')) return;
      e.stopPropagation();
      const t = e.touches[0];
      dragging = true; startMX = t.clientX; startMY = t.clientY;
      tableNames.forEach(tn => { if (this.positions[tn]) startPos[tn] = { ...this.positions[tn] }; });
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      if (!dragging || e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      const dx = (t.clientX - startMX) / this.scale;
      const dy = (t.clientY - startMY) / this.scale;
      tableNames.forEach(tn => {
        if (!startPos[tn]) return;
        this.positions[tn] = { x: startPos[tn].x + dx, y: startPos[tn].y + dy };
        const card = this.cards[tn];
        if (card) { card.style.left = this.positions[tn].x + 'px'; card.style.top = this.positions[tn].y + 'px'; }
      });
      this._updateGroupContainers();
      this._renderConnections(this.activeTable);
      this._updateSVGSize();
    }, { passive: false });

    el.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false; startPos = {};
      this._pushHistory();
      this._savePositions();
    }, { passive: true });
  },

  // ── visibility persistence ───────────────────────────────

  /**
   * @this {Diagram}
   */
  _persistVisibility() {
    const pid = this.project.id;
    localStorage.setItem(`dbml_hg_${pid}`, JSON.stringify([...this._hiddenGroups]));
    localStorage.setItem(`dbml_ht_${pid}`, JSON.stringify([...this._hiddenTables]));
  },

  /**
   * @this {Diagram}
   */
  _restoreVisibility() {
    const pid = this.project.id;
    try {
      const hg = JSON.parse(localStorage.getItem(`dbml_hg_${pid}`) || '[]');
      const ht = JSON.parse(localStorage.getItem(`dbml_ht_${pid}`) || '[]');
      /** @type {string[]} */ (hg).forEach(g => this.toggleGroupVisibility(g));
      /** @type {string[]} */ (ht).forEach(t => this.toggleTableVisibility(t));
    } catch {}
  },

  // ── eye toggles ──────────────────────────────────────────

  /**
   * @this {Diagram}
   * @param {string} groupName
   */
  toggleGroupVisibility(groupName) {
    const hidden = this._hiddenGroups.has(groupName);
    hidden ? this._hiddenGroups.delete(groupName) : this._hiddenGroups.add(groupName);
    const nowHidden = !hidden;

    const tableNames = (this.project.groups || {})[groupName] || [];
    tableNames.forEach(t => {
      const card = this.cards[t];
      if (card) card.style.display = nowHidden ? 'none' : '';
    });

    const cont = this._groupContainers[groupName];
    if (cont) {
      cont.classList.toggle('group-hidden', nowHidden);
      const btn = cont.querySelector('.group-eye-btn');
      if (btn) btn.innerHTML = nowHidden ? SVG_EYE_CLOSED : SVG_EYE_OPEN;
    }

    const sideBtn = document.querySelector(`.nav-group-eye[data-group="${groupName}"]`);
    if (sideBtn) {
      sideBtn.innerHTML = nowHidden ? SVG_EYE_CLOSED : SVG_EYE_OPEN;
      sideBtn.classList.toggle('eye-off', nowHidden);
    }

    this._renderConnections(this.activeTable);
    this._persistVisibility();
    this._updateMinimap();
  },

  /**
   * @this {Diagram}
   * @param {string} name
   */
  toggleTableVisibility(name) {
    const hidden = this._hiddenTables.has(name);
    hidden ? this._hiddenTables.delete(name) : this._hiddenTables.add(name);
    const nowHidden = !hidden;

    const card = this.cards[name];
    if (card) {
      card.classList.toggle('table-hidden', nowHidden);
      const body = card.querySelector('.card-body');
      if (body) /** @type {HTMLElement} */ (body).style.display = nowHidden ? 'none' : '';
      const btn = card.querySelector('.card-eye-btn');
      if (btn) btn.innerHTML = nowHidden ? SVG_EYE_CLOSED : SVG_EYE_OPEN;
    }

    const sideBtn = document.querySelector(`.nav-table-eye[data-table="${name}"]`);
    if (sideBtn) {
      sideBtn.innerHTML = nowHidden ? SVG_EYE_CLOSED : SVG_EYE_OPEN;
      sideBtn.classList.toggle('eye-off', nowHidden);
    }

    this._updateGroupContainers();
    this._renderConnections(this.activeTable);
    this._persistVisibility();
    this._updateMinimap();
  },

});
