/**
 * @file layout.js — auto-layout algorithm and DOM canvas setup
 */

Object.assign(Diagram.prototype, {

  /**
   * Compute initial (x,y) positions for every table.
   * Uses saved positions when all tables are already placed.
   * @this {Diagram}
   */
  _autoLayout() {
    const tables    = this.project.tables    || {};
    const groups    = this.project.groups    || {};
    const ungrouped = this.project.ungrouped || [];
    const saved     = this.project.saved_positions || {};

    const tableNames = Object.keys(tables);
    const allSaved   = tableNames.length > 0 && tableNames.every(n => saved[n]);
    if (allSaved) { Object.assign(this.positions, saved); return; }

    /** @type {string[][]} */
    const columns = [];
    for (const names of Object.values(groups)) {
      const valid = names.filter(t => tables[t]);
      if (valid.length) columns.push(valid);
    }
    const validUngrouped = ungrouped.filter(t => tables[t]);
    if (validUngrouped.length) columns.push(validUngrouped);

    const colHeights = columns.map(names =>
      names.reduce((sum, n) => sum + this._cardHeight(tables[n]) + ROW_GAP, -ROW_GAP)
    );
    const maxH = Math.max(...colHeights);

    let x = START_X;
    columns.forEach((names, ci) => {
      const offsetY = Math.round((maxH - colHeights[ci]) / 2);
      let y = START_Y + offsetY;
      names.forEach(name => {
        const tbl = tables[name];
        if (!tbl) return;
        this.positions[name] = saved[name] || { x, y };
        y += this._cardHeight(tbl) + ROW_GAP;
      });
      x += CARD_WIDTH + COL_GAP + 60;
    });
  },

  /**
   * Create the canvas div and SVG overlay, append to container.
   * @this {Diagram}
   */
  _setupDOM() {
    this.canvas = document.createElement('div');
    this.canvas.className = 'diagram-canvas';
    this.container.appendChild(this.canvas);

    this.svg = /** @type {SVGSVGElement} */ (
      document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    );
    this.svg.setAttribute('class', 'connections-svg');
    this.svg.innerHTML = `<defs>
      <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8"/>
      </marker>
      <marker id="arr-hi" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6"/>
      </marker>
      <marker id="arr-sel" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#818cf8"/>
      </marker>
    </defs>`;
    this.canvas.appendChild(this.svg);
  },

});
