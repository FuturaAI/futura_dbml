/**
 * diagram/cards.js — table card rendering
 */

Object.assign(Diagram.prototype, {

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
        <button class="card-eye-btn" title="Mostra/nascondi">${SVG_EYE_OPEN}</button>
      `;
      header.querySelector('.card-eye-btn').addEventListener('click', e => {
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

      this._makeDraggable(card, name);
      this.cards[name] = card;
      this.canvas.appendChild(card);
    }
    this._updateSVGSize();
  },

});
