/**
 * diagram/connections.js — SVG bezier connections, highlight, clear
 */

Object.assign(Diagram.prototype, {

  _renderConnections(highlightTable = null) {
    this.svg.querySelectorAll('path.conn, path.conn-hit, text.conn-label').forEach(p => p.remove());
    const tables    = this.project.tables || {};
    const activeRef = !highlightTable ? this._activeRef : null;

    (this.project.refs || []).forEach(ref => {
      const fromTbl = tables[ref.from_table];
      const toTbl   = tables[ref.to_table];
      const fromPos = this.positions[ref.from_table];
      const toPos   = this.positions[ref.to_table];
      if (!fromTbl || !toTbl || !fromPos || !toPos) return;

      const fromGrp = this._tableGroupMap[ref.from_table];
      const toGrp   = this._tableGroupMap[ref.to_table];
      if (this._hiddenGroups.has(fromGrp)        || this._hiddenGroups.has(toGrp))        return;
      if (this._hiddenTables.has(ref.from_table) || this._hiddenTables.has(ref.to_table)) return;

      const fromColIdx = fromTbl.columns.findIndex(c => c.name === ref.from_col);
      const toColIdx   = toTbl.columns.findIndex(c => c.name === ref.to_col);
      const fromRowY   = HEADER_H + Math.max(0, fromColIdx) * COL_ROW_H + COL_ROW_H / 2;
      const toRowY     = HEADER_H + Math.max(0, toColIdx)   * COL_ROW_H + COL_ROW_H / 2;

      let x1, x2;
      if (fromPos.x <= toPos.x) { x1 = fromPos.x + CARD_WIDTH; x2 = toPos.x; }
      else                       { x1 = fromPos.x;               x2 = toPos.x + CARD_WIDTH; }

      const y1   = fromPos.y + fromRowY;
      const y2   = toPos.y   + toRowY;
      const cpDx = Math.max(60, Math.abs(x2 - x1) * 0.45);
      const cp1x = x1 + (fromPos.x <= toPos.x ?  cpDx : -cpDx);
      const cp2x = x2 + (fromPos.x <= toPos.x ? -cpDx :  cpDx);
      const d    = `M ${x1} ${y1} C ${cp1x} ${y1} ${cp2x} ${y2} ${x2} ${y2}`;

      const isSel = activeRef &&
        activeRef.from_table === ref.from_table && activeRef.from_col === ref.from_col &&
        activeRef.to_table   === ref.to_table   && activeRef.to_col   === ref.to_col;
      const isHi = highlightTable &&
        (ref.from_table === highlightTable || ref.to_table === highlightTable);

      let stroke = '#cbd5e1', strokeW = '1.5', marker = 'url(#arr)';
      if (isSel)      { stroke = '#818cf8'; strokeW = '2.5'; marker = 'url(#arr-sel)'; }
      else if (isHi)  { stroke = '#3b82f6'; strokeW = '2';   marker = 'url(#arr-hi)';  }

      const dimmed = (highlightTable && !isHi) || (activeRef && !isSel);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'conn');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', stroke);
      path.setAttribute('stroke-width', strokeW);
      path.setAttribute('marker-end', marker);
      if (dimmed) path.style.opacity = '0.2';
      this.svg.appendChild(path);

      const labelColor = isSel ? '#818cf8' : isHi ? '#3b82f6' : '#94a3b8';
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('class', 'conn-label');
      lbl.setAttribute('x', (x1 + x2) / 2);
      lbl.setAttribute('y', (y1 + y2) / 2 - 5);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('font-family', 'ui-monospace, monospace, system-ui');
      lbl.setAttribute('font-size', '10');
      lbl.setAttribute('fill', labelColor);
      lbl.setAttribute('stroke', '#f1f5f9');
      lbl.setAttribute('stroke-width', '3');
      lbl.setAttribute('paint-order', 'stroke');
      lbl.setAttribute('pointer-events', 'none');
      if (dimmed) lbl.style.opacity = '0.2';
      lbl.textContent = `${ref.from_col} → ${ref.to_col}`;
      this.svg.appendChild(lbl);

      // Wide invisible hit-area
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('class', 'conn-hit');
      hit.setAttribute('d', d);
      hit.setAttribute('fill', 'none');
      hit.setAttribute('stroke', 'rgba(0,0,0,0.001)');
      hit.setAttribute('stroke-width', '18');
      hit.style.cursor = 'pointer';
      hit.style.pointerEvents = 'stroke';

      const tip       = document.querySelector('.fk-tooltip');
      const tipTarget = tip && tip.querySelector('.fk-tooltip-target');
      hit.addEventListener('mouseenter', e => {
        if (!tip) return;
        if (tipTarget) {
          const fn = (this.project.tables[ref.from_table] || {}).name || ref.from_table;
          const tn = (this.project.tables[ref.to_table]   || {}).name || ref.to_table;
          tipTarget.textContent = `${fn}.${ref.from_col}  ·  ${tn}.${ref.to_col}`;
        }
        tip.style.display = 'block';
        tip.style.left = (e.clientX + 18) + 'px';
        tip.style.top  = (e.clientY - 16) + 'px';
      });
      hit.addEventListener('mousemove', e => {
        if (!tip) return;
        tip.style.left = (e.clientX + 18) + 'px';
        tip.style.top  = (e.clientY - 16) + 'px';
      });
      hit.addEventListener('mouseleave', () => { if (tip) tip.style.display = 'none'; });
      hit.addEventListener('click', e => {
        e.stopPropagation();
        if (tip) tip.style.display = 'none';
        this.focusRef(ref);
      });
      this.svg.appendChild(hit);
    });
  },

  _highlightConnections(tableName) {
    this._renderConnections(tableName);
    const refs = this.project.refs || [];
    Object.entries(this.cards).forEach(([name, card]) => {
      if (card.style.display === 'none' || this._hiddenTables.has(name)) return;
      const related = name === tableName || refs.some(r =>
        (r.from_table === tableName || r.to_table === tableName) &&
        (r.from_table === name      || r.to_table === name)
      );
      card.style.opacity = related ? '1' : '0.4';
    });
  },

  _clearHighlight() {
    this._activeRef = null;
    Object.values(this.cards).forEach(c => { c.style.opacity = '1'; c.classList.remove('highlighted'); });
    this.canvas.querySelectorAll('.col-row.ref-highlight').forEach(r => r.classList.remove('ref-highlight'));
    this._renderConnections();
  },

});
