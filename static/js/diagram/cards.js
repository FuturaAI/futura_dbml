/**
 * @file cards.js — table card rendering
 */

Object.assign(Diagram.prototype, {

  /**
   * Create one DOM card per table and append it to the canvas.
   * @this {Diagram}
   */
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
      const grpLabel = this._tableGroupMap[name];
      const subLabel = (grpLabel && grpLabel !== '__ungrouped__') ? grpLabel : '';
      header.innerHTML = `
        <div class="card-header-left">
          ${subLabel ? `<span class="card-schema">${subLabel}</span>` : ''}
          <span class="card-table-name">${tbl.name}</span>
        </div>
        <button class="card-copy-btn" title="Copia DDL"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" fill="none"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none"/></svg></button>
        <button class="card-eye-btn" title="Mostra/nascondi">${SVG_EYE_OPEN}</button>
      `;
      header.querySelector('.card-copy-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        const ddl = this._generateDDL(name, tbl);
        navigator.clipboard.writeText(ddl).catch(() => {});
        const btn = /** @type {HTMLElement} */ (e.currentTarget);
        btn.style.opacity = '1';
        btn.innerHTML = '<svg width="13" height="13" fill="none" stroke="#4ade80" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => {
          btn.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          btn.style.opacity = '';
        }, 1200);
      });
      header.querySelector('.card-eye-btn')?.addEventListener('click', e => {
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
      card.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); this._showCtxMenu(e.clientX, e.clientY, name); });

      this._makeDraggable(card, name);
      this.cards[name] = card;
      this.canvas.appendChild(card);
    }
    this._updateSVGSize();
  },

});
