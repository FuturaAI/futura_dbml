/**
 * @file export.js — DBML / SQL / SVG / PDF export functions
 */

function _downloadText(content, filename, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── DBML export ───────────────────────────────────────────────────────────────

function exportDBML() {
  const tables    = PROJECT.tables    || {};
  const groups    = PROJECT.groups    || {};
  const refs      = PROJECT.refs      || [];
  const lines     = [];
  const _stripSchema = s => s.includes('.') ? s.split('.').pop() : s;

  for (const [tname, tbl] of Object.entries(tables)) {
    lines.push(`Table ${tbl.name || _stripSchema(tname)} {`);
    for (const col of tbl.columns) {
      let def = `  ${col.name} ${col.type}`;
      const attrs = [];
      if (col.pk)                           attrs.push('pk');
      if (col.not_null && !col.pk)          attrs.push('not null');
      if (col.unique)                       attrs.push('unique');
      if (col.default != null)              attrs.push(`default: ${col.default}`);
      const noteText = _colNotesCache[`${tname}::${col.name}`] || col.note || null;
      if (noteText)                         attrs.push(`note: '${noteText.replace(/'/g, "\\'")}'`);
      if (attrs.length) def += ` [${attrs.join(', ')}]`;
      lines.push(def);
    }
    const tblNote = _tblNotesCache[tname] || tbl.note || null;
    if (tblNote) lines.push(`  note: '${tblNote.replace(/'/g, "\\'")}'`);
    lines.push('}');
    lines.push('');
  }

  for (const [gname, tnames] of Object.entries(groups)) {
    lines.push(`TableGroup ${gname} {`);
    tnames.forEach(t => lines.push(`  ${tables[t]?.name || _stripSchema(t)}`));
    lines.push('}');
    lines.push('');
  }

  for (const r of refs) {
    const ft = tables[r.from_table]?.name || _stripSchema(r.from_table);
    const tt = tables[r.to_table]?.name   || _stripSchema(r.to_table);
    lines.push(`Ref: ${ft}.${r.from_col} ${r.type} ${tt}.${r.to_col}`);
  }

  _downloadText(lines.join('\n'), `${PROJECT.name}.dbml`, 'text/plain');
}

// ── SQL helpers ───────────────────────────────────────────────────────────────

function _quoteIdent(name, dialect) {
  if (dialect === 'mssql') return `[${name}]`;
  if (dialect === 'mysql') return `\`${name}\``;
  return `"${name}"`;
}

function _quoteTable(fullName, dialect) {
  const dot   = fullName.indexOf('.');
  const table = dot === -1 ? fullName : fullName.slice(dot + 1);
  return _quoteIdent(table, dialect);
}

function _mapType(type, dialect, enums) {
  if (dialect === 'postgres') return type;
  const t = type.toLowerCase();

  if (dialect === 'mysql' && enums && enums.length) {
    const enumDef = enums.find(e => e.name.toLowerCase() === t || e.full_name.toLowerCase() === t);
    if (enumDef) return `ENUM(${enumDef.values.map(v => `'${v.replace(/'/g, "\\'")}'`).join(', ')})`;
  }

  if (dialect === 'mysql') {
    if (t === 'boolean' || t === 'bool')                                    return 'TINYINT(1)';
    if (t === 'serial')                                                     return 'INT';
    if (t === 'bigserial')                                                  return 'BIGINT';
    if (t === 'smallint' || t === 'int2')                                   return 'SMALLINT';
    if (t === 'int' || t === 'integer' || t === 'int4')                     return 'INT';
    if (t === 'bigint' || t === 'int8')                                     return 'BIGINT';
    if (t === 'double precision' || t === 'float8' || t === 'float')        return 'DOUBLE';
    if (t === 'real' || t === 'float4')                                     return 'FLOAT';
    if (t === 'numeric' || t === 'decimal' ||
        t.startsWith('numeric(') || t.startsWith('decimal('))               return type.toUpperCase();
    if (t === 'text' || t === 'clob')                                       return 'LONGTEXT';
    if (t.startsWith('varchar'))                                            return type.toUpperCase();
    if (t === 'char' || t.startsWith('char('))                              return type.toUpperCase();
    if (t === 'bytea' || t === 'blob')                                      return 'BLOB';
    if (t === 'json' || t === 'jsonb')                                      return 'JSON';
    if (t === 'uuid')                                                       return 'CHAR(36)';
    if (t === 'timestamptz' || t === 'timestamp with time zone')            return 'DATETIME';
    if (t === 'timestamp' || t.startsWith('timestamp'))                     return 'DATETIME';
    if (t === 'date')                                                       return 'DATE';
    if (t === 'time')                                                       return 'TIME';
    return type;
  }

  if (dialect === 'sqlite') {
    if (t === 'boolean' || t === 'bool')                                    return 'INTEGER';
    if (t === 'serial')                                                     return 'INTEGER';
    if (t === 'bigserial')                                                  return 'INTEGER';
    if (t === 'smallint' || t === 'int2')                                   return 'INTEGER';
    if (t === 'int' || t === 'integer' || t === 'int4')                     return 'INTEGER';
    if (t === 'bigint' || t === 'int8')                                     return 'INTEGER';
    if (t === 'double precision' || t === 'float8' || t === 'float')        return 'REAL';
    if (t === 'real' || t === 'float4')                                     return 'REAL';
    if (t === 'numeric' || t === 'decimal' ||
        t.startsWith('numeric(') || t.startsWith('decimal('))               return 'NUMERIC';
    if (t === 'text' || t.startsWith('varchar') ||
        t.startsWith('char') || t === 'clob')                               return 'TEXT';
    if (t === 'bytea' || t === 'blob')                                      return 'BLOB';
    if (t === 'json' || t === 'jsonb')                                      return 'TEXT';
    if (t === 'uuid')                                                       return 'TEXT';
    if (t === 'date' || t === 'time' || t.startsWith('timestamp'))          return 'TEXT';
    return type;
  }

  // MSSQL
  if (t === 'boolean' || t === 'bool')             return 'BIT';
  if (t === 'serial')                              return 'INT IDENTITY(1,1)';
  if (t === 'bigserial')                           return 'BIGINT IDENTITY(1,1)';
  if (t === 'text')                                return 'NVARCHAR(MAX)';
  if (t.startsWith('varchar')) {
    const m = type.replace(/varchar/i, 'NVARCHAR');
    return m.toUpperCase() === 'NVARCHAR' ? 'NVARCHAR(MAX)' : m;
  }
  if (t === 'char' || t.startsWith('char(')) {
    const m = type.replace(/^char/i, 'NCHAR');
    return m.toUpperCase() === 'NCHAR' ? 'NCHAR(1)' : m;
  }
  if (t === 'bytea')                               return 'VARBINARY(MAX)';
  if (t === 'json' || t === 'jsonb')               return 'NVARCHAR(MAX)';
  if (t === 'uuid')                                return 'UNIQUEIDENTIFIER';
  if (t === 'timestamptz' || t === 'timestamp with time zone') return 'DATETIMEOFFSET';
  if (t === 'timestamp' || t.startsWith('timestamp')) return 'DATETIME2';
  if (t === 'date')                                return 'DATE';
  if (t === 'time')                                return 'TIME';
  if (t === 'double precision' || t === 'float8')  return 'FLOAT';
  if (t === 'real' || t === 'float4')              return 'REAL';
  return type;
}

function _generateSQL(dialect) {
  const tables = PROJECT.tables || {};
  const refs   = PROJECT.refs   || [];
  const enums  = PROJECT.enums  || [];
  const lines  = [];
  const dialectLabel = {
    postgres: 'PostgreSQL', mssql: 'MS SQL Server',
    sqlite: 'SQLite', mysql: 'MySQL / MariaDB',
  }[dialect] || dialect;

  lines.push(`-- Generated by DBML Docs`);
  lines.push(`-- Project: ${PROJECT.name}`);
  lines.push(`-- Dialect: ${dialectLabel}`);
  if (dialect === 'mssql') lines.push(`-- Nota: tipi custom/enum potrebbero richiedere creazione manuale`);
  lines.push('');

  if (dialect === 'sqlite') { lines.push('PRAGMA foreign_keys = ON;'); lines.push(''); }

  if (dialect === 'postgres' && enums.length) {
    lines.push('-- Enum types');
    for (const e of enums) {
      const typeName = e.schema ? `"${e.schema}"."${e.name}"` : `"${e.name}"`;
      const vals = e.values.map(v => `'${v.replace(/'/g, "\\'")}'`).join(', ');
      lines.push(`CREATE TYPE ${typeName} AS ENUM (${vals});`);
    }
    lines.push('');
  }

  const inlineFKs = {};
  if (dialect === 'sqlite' || dialect === 'mysql') {
    for (const r of refs) {
      if (r.type === '>') {
        if (!inlineFKs[r.from_table]) inlineFKs[r.from_table] = [];
        inlineFKs[r.from_table].push(r);
      }
    }
  }

  for (const [tname, tbl] of Object.entries(tables)) {
    const tableSql = _quoteTable(tbl.full_name || tname, dialect);
    lines.push(`CREATE TABLE ${tableSql} (`);

    const pkCols = tbl.columns.filter(c => c.pk).map(c => c.name);
    const colDefs = tbl.columns.map(col => {
      let mappedType = _mapType(col.type, dialect, enums);
      const t = col.type.toLowerCase();
      const isSerial = t === 'serial' || t === 'bigserial';
      let def = `  ${_quoteIdent(col.name, dialect)} ${mappedType}`;
      if (dialect === 'mysql' && isSerial) def += ' AUTO_INCREMENT';
      if (col.pk && pkCols.length === 1) {
        def += ' PRIMARY KEY';
        if (dialect === 'sqlite' && isSerial) def += ' AUTOINCREMENT';
      }
      if (col.not_null && !col.pk) def += ' NOT NULL';
      if (col.unique)              def += ' UNIQUE';
      if (col.default != null)     def += ` DEFAULT ${col.default}`;
      return def;
    });

    if (pkCols.length > 1) {
      colDefs.push(`  PRIMARY KEY (${pkCols.map(c => _quoteIdent(c, dialect)).join(', ')})`);
    }

    if (inlineFKs[tname]) {
      for (const r of inlineFKs[tname]) {
        const fkName = `fk_${r.from_table.replace(/\W/g, '_')}_${r.from_col}`;
        if (dialect === 'mysql') {
          colDefs.push(`  CONSTRAINT ${fkName} FOREIGN KEY (${_quoteIdent(r.from_col, dialect)}) REFERENCES ${_quoteTable(r.to_table, dialect)} (${_quoteIdent(r.to_col, dialect)})`);
        } else {
          colDefs.push(`  FOREIGN KEY (${_quoteIdent(r.from_col, dialect)}) REFERENCES ${_quoteTable(r.to_table, dialect)} (${_quoteIdent(r.to_col, dialect)})`);
        }
      }
    }

    lines.push(colDefs.join(',\n'));
    lines.push(dialect === 'mysql' ? ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;' : ');');
    lines.push('');
  }

  if (dialect !== 'sqlite' && dialect !== 'mysql') {
    const fkRefs = refs.filter(r => r.type === '>');
    if (fkRefs.length) {
      lines.push('-- Foreign keys');
      for (const r of fkRefs) {
        const fkName = `fk_${r.from_table.replace(/\W/g, '_')}_${r.from_col}`;
        lines.push(`ALTER TABLE ${_quoteTable(r.from_table, dialect)}`);
        lines.push(`  ADD CONSTRAINT ${fkName}`);
        lines.push(`  FOREIGN KEY (${_quoteIdent(r.from_col, dialect)})`);
        lines.push(`  REFERENCES ${_quoteTable(r.to_table, dialect)} (${_quoteIdent(r.to_col, dialect)});`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function exportSQL(dialect) {
  const ext = { postgres: 'pg.sql', mssql: 'mssql.sql', sqlite: 'sqlite.sql', mysql: 'mysql.sql' }[dialect] || `${dialect}.sql`;
  _downloadText(_generateSQL(dialect), `${PROJECT.name}.${ext}`, 'text/plain');
}

// ── SVG / PDF diagram export ──────────────────────────────────────────────────

function _buildDiagramSVG() {
  if (!diagram) return null;
  const tables = PROJECT.tables || {};
  const groups = PROJECT.groups || {};
  const refs   = PROJECT.refs   || [];
  const pos    = diagram.positions || {};

  const CARD_W = 260, HDR_H = 44, COL_H = 26, PAD_B = 10, GRP_P = 24, GRP_LH = 16;
  function cardH(t) { return HDR_H + t.columns.length * COL_H + PAD_B; }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [name, tbl] of Object.entries(tables)) {
    if (!pos[name]) continue;
    const { x, y } = pos[name];
    const h = cardH(tbl);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + CARD_W); maxY = Math.max(maxY, y + h);
  }
  for (const [, tnames] of Object.entries(groups)) {
    const valid = tnames.filter(t => tables[t] && pos[t]);
    if (!valid.length) continue;
    let gx1 = Infinity, gy1 = Infinity;
    for (const n of valid) { gx1 = Math.min(gx1, pos[n].x); gy1 = Math.min(gy1, pos[n].y); }
    minX = Math.min(minX, gx1 - GRP_P);
    minY = Math.min(minY, gy1 - GRP_P - GRP_LH);
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }
  const MARGIN = 40;
  const W = maxX - minX + MARGIN * 2, H = maxY - minY + MARGIN * 2;
  const ox = -minX + MARGIN, oy = -minY + MARGIN;

  const GROUP_COLORS = ['#ef4444','#3b82f6','#a855f7','#22c55e','#f59e0b','#06b6d4','#f97316','#ec4899'];
  const groupColorMap = {};
  Object.keys(groups).forEach((g, i) => { groupColorMap[g] = GROUP_COLORS[i % 8]; });
  const tableGroupMap = {};
  for (const [g, ts] of Object.entries(groups)) ts.forEach(t => { tableGroupMap[t] = g; });
  (PROJECT.ungrouped || []).forEach(t => { tableGroupMap[t] = '__ungrouped__'; });
  function tableColor(name) { return groupColorMap[tableGroupMap[name]] || '#64748b'; }
  function hexRgbaLocal(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const svgParts = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  svgParts.push(`<rect width="${W}" height="${H}" fill="#f1f5f9"/>`);

  const hiddenGroups = diagram._hiddenGroups || new Set();
  const hiddenTables = diagram._hiddenTables || new Set();

  for (const [gname, tnames] of Object.entries(groups)) {
    if (hiddenGroups.has(gname)) continue;
    const valid = tnames.filter(t => tables[t] && pos[t] && !hiddenTables.has(t));
    if (!valid.length) continue;
    const color = groupColorMap[gname] || '#64748b';
    let gx1 = Infinity, gy1 = Infinity, gx2 = -Infinity, gy2 = -Infinity;
    for (const n of valid) {
      gx1 = Math.min(gx1, pos[n].x); gy1 = Math.min(gy1, pos[n].y);
      gx2 = Math.max(gx2, pos[n].x + CARD_W); gy2 = Math.max(gy2, pos[n].y + cardH(tables[n]));
    }
    const rx = gx1 - GRP_P + ox, ry = gy1 - GRP_P - GRP_LH + oy;
    const rw = gx2 - gx1 + GRP_P * 2, rh = gy2 - gy1 + GRP_P * 2 + GRP_LH;
    svgParts.push(`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="10" fill="${hexRgbaLocal(color,0.06)}" stroke="${color}" stroke-width="2"/>`);
    svgParts.push(`<rect x="${rx+10}" y="${ry-11}" width="${Math.min(esc(gname).length*8+16,200)}" height="22" rx="6" fill="${color}"/>`);
    svgParts.push(`<text x="${rx+18}" y="${ry+5}" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="#fff">${esc(gname)}</text>`);
  }

  function connPoints(fromT, toT) {
    const fp = pos[fromT], tp = pos[toT];
    if (!fp || !tp) return null;
    const fh = cardH(tables[fromT]), th = cardH(tables[toT]);
    const fCx = fp.x + CARD_W / 2, tCx = tp.x + CARD_W / 2;
    let x1, x2;
    if (fCx <= tCx) { x1 = fp.x + CARD_W; x2 = tp.x; }
    else             { x1 = fp.x;           x2 = tp.x + CARD_W; }
    const y1 = fp.y + fh / 2, y2 = tp.y + th / 2;
    const dx = Math.abs(x2 - x1) * 0.5;
    return { x1: x1+ox, y1: y1+oy, x2: x2+ox, y2: y2+oy, dx };
  }

  for (const r of refs) {
    if (hiddenTables.has(r.from_table) || hiddenTables.has(r.to_table)) continue;
    const fg = tableGroupMap[r.from_table], tg = tableGroupMap[r.to_table];
    if (fg && hiddenGroups.has(fg)) continue;
    if (tg && hiddenGroups.has(tg)) continue;
    const p = connPoints(r.from_table, r.to_table);
    if (!p) continue;
    const { x1, y1, x2, y2, dx } = p;
    svgParts.push(`<path d="M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}" stroke="#94a3b8" stroke-width="1.5" fill="none" marker-end="url(#svgArr)"/>`);
    const lx = (x1 + x2) / 2, ly = (y1 + y2) / 2;
    svgParts.push(`<text x="${lx}" y="${ly - 5}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#94a3b8" stroke="#f1f5f9" stroke-width="3" paint-order="stroke" pointer-events="none">${esc(r.from_col)} \u2192 ${esc(r.to_col)}</text>`);
  }

  svgParts.splice(2, 0, `<defs><marker id="svgArr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#94a3b8"/></marker></defs>`);

  for (const [tname, tbl] of Object.entries(tables)) {
    if (!pos[tname] || hiddenTables.has(tname)) continue;
    const tgrp = tableGroupMap[tname];
    if (tgrp && hiddenGroups.has(tgrp)) continue;
    const { x, y } = pos[tname];
    const sx = x + ox, sy = y + oy;
    const h  = cardH(tbl);
    const color = tableColor(tname);

    svgParts.push(`<rect x="${sx}" y="${sy}" width="${CARD_W}" height="${h}" rx="8" fill="#fff" stroke="#e2e8f0" stroke-width="1.5"/>`);
    svgParts.push(`<rect x="${sx}" y="${sy}" width="${CARD_W}" height="${HDR_H}" rx="8" fill="${color}"/>`);
    svgParts.push(`<rect x="${sx}" y="${sy+HDR_H-8}" width="${CARD_W}" height="8" fill="${color}"/>`);
    svgParts.push(`<text x="${sx+14}" y="${sy+HDR_H/2+5}" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#fff">${esc(tbl.name || tname)}</text>`);

    tbl.columns.forEach((col, ci) => {
      const cy = sy + HDR_H + ci * COL_H;
      if (ci % 2 === 0) svgParts.push(`<rect x="${sx+1}" y="${cy}" width="${CARD_W-2}" height="${COL_H}" fill="#f8fafc"/>`);
      if (col.pk) svgParts.push(`<rect x="${sx+6}" y="${cy+6}" width="22" height="14" rx="3" fill="#fef9c3"/>`);
      const textY = cy + COL_H / 2 + 4;
      let nameX = sx + 36;
      if (col.pk) svgParts.push(`<text x="${sx+8}" y="${textY}" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#854d0e">PK</text>`);
      else nameX = sx + 12;
      svgParts.push(`<text x="${nameX}" y="${textY}" font-family="system-ui,sans-serif" font-size="12" fill="#1e293b">${esc(col.name)}</text>`);
      svgParts.push(`<text x="${sx+CARD_W-8}" y="${textY}" font-family="system-ui,sans-serif" font-size="11" fill="#64748b" text-anchor="end">${esc(col.type)}</text>`);
    });

    svgParts.push(`<rect x="${sx}" y="${sy+h-8}" width="${CARD_W}" height="8" rx="0" fill="#fff" stroke="none"/>`);
    svgParts.push(`<path d="M${sx+1},${sy+h-8} L${sx+1},${sy+h} Q${sx+1},${sy+h+7.5} ${sx+8.5},${sy+h+7.5}" stroke="none" fill="none"/>`);
  }

  svgParts.push('</svg>');
  return svgParts.join('\n');
}

function exportSVG() {
  const svg = _buildDiagramSVG();
  if (!svg) return;
  _downloadText(svg, `${PROJECT.name}.svg`, 'image/svg+xml');
}

function exportPDF() {
  const svg = _buildDiagramSVG();
  if (!svg) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${PROJECT.name}</title>
<style>body{margin:0;background:#f1f5f9;}svg{display:block;max-width:100%;height:auto;}
@media print{body{background:white;}@page{size:auto;margin:10mm;}}</style>
</head><body>${svg}
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
  win.document.close();
}
