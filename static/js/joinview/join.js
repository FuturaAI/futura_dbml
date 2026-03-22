/**
 * @file joinview/join.js — shared state, BFS, JOIN builder
 */

// ── Shared colours ────────────────────────────────────────────────────────────

const JV_COLORS = ['#3b82f6','#a855f7','#22c55e','#f59e0b','#06b6d4','#f97316','#ec4899','#ef4444'];

function _jvGroupColor(tname) {
  const groups = PROJECT.groups || {};
  const idx = Object.keys(groups).findIndex(g => (groups[g] || []).includes(tname));
  return idx >= 0 ? JV_COLORS[idx % 8] : '#64748b';
}

function _jvAlias(name) {
  const tablePart = name.includes('.') ? name.split('.').pop() : name;
  const parts = tablePart.split(/[_\s]+/).filter(Boolean);
  if (parts.length === 1) return tablePart.slice(0, 3).toLowerCase();
  return parts.map(p => p[0]).join('').toLowerCase();
}

// ── Sub-tab switch ─────────────────────────────────────────────────────────────

function switchJvTab(name, btn) {
  document.querySelectorAll('.jv-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.jv-subtab').forEach(b => b.classList.remove('active'));
  document.getElementById('jv-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'views') renderViewsList();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  JOIN BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

const _jvJoinTypes    = {};         // "from::to" → join type string
const _jvExcluded     = new Set();  // "from::to" edges excluded from query
const _jvSelectedCols = {};         // "tname::colname" → true/false (default true)
let   _jvManualEdges  = [];         // manually added join edges

function _jvGetJoinType(from, to) {
  return _jvJoinTypes[from + '::' + to] || _jvJoinTypes[to + '::' + from] || 'INNER JOIN';
}

function _jvSetJoinType(from, to, type) {
  _jvJoinTypes[from + '::' + to] = type;
  delete _jvJoinTypes[to + '::' + from];
  _rebuildJoinSQL();
}

// ── Manual join helpers ───────────────────────────────────────────────────────

function _jvShowAddJoin(btn) {
  const existing = btn.parentElement.querySelector('.jv-add-join-form');
  if (existing) { existing.remove(); return; }

  const graph   = document.getElementById('jvGraph');
  const visited = new Map(JSON.parse(graph.dataset.visited || '[]'));
  const tables  = PROJECT.tables || {};

  let leftOpts = '';
  for (const [tname] of [...visited.entries()].sort((a, b) => a[1] - b[1])) {
    const t = tables[tname];
    if (!t) continue;
    leftOpts += `<optgroup label="${t.name}">`;
    for (const c of t.columns) leftOpts += `<option value="${tname}::${c.name}">${t.name}.${c.name}</option>`;
    leftOpts += '</optgroup>';
  }

  let rightTableOpts = '<option value="">— tabella —</option>';
  for (const [tname, t] of Object.entries(tables)) {
    rightTableOpts += `<option value="${tname}">${t.name}</option>`;
  }

  const form = document.createElement('div');
  form.className = 'jv-add-join-form';
  form.innerHTML = `
    <select class="jv-manual-jt">
      <option>INNER JOIN</option><option>LEFT JOIN</option><option>RIGHT JOIN</option><option>FULL JOIN</option>
    </select>
    <div class="jv-manual-cond">
      <select class="jv-manual-left">${leftOpts}</select>
      <span style="color:#94a3b8;font-size:11px">=</span>
      <select class="jv-manual-rtbl" onchange="_jvFillRightCols(this)">${rightTableOpts}</select>
      <select class="jv-manual-rcol"><option value="">— colonna —</option></select>
    </div>
    <div style="display:flex;gap:6px;margin-top:4px">
      <button class="jv-manual-confirm" onclick="_jvConfirmAddJoin(this)">\u2713 Aggiungi</button>
      <button class="jv-manual-cancel"  onclick="this.closest('.jv-add-join-form').remove()">\u2715</button>
    </div>`;
  btn.after(form);
}

function _jvFillRightCols(tblSelect) {
  const tname  = tblSelect.value;
  const tables = PROJECT.tables || {};
  const colSel = tblSelect.closest('.jv-manual-cond').querySelector('.jv-manual-rcol');
  colSel.innerHTML = '<option value="">— colonna —</option>';
  if (!tname || !tables[tname]) return;
  for (const c of tables[tname].columns) {
    const opt = document.createElement('option');
    opt.value = c.name; opt.textContent = c.name;
    colSel.appendChild(opt);
  }
}

function _jvConfirmAddJoin(btn) {
  const form    = btn.closest('.jv-add-join-form');
  const jt      = form.querySelector('.jv-manual-jt').value;
  const leftVal = form.querySelector('.jv-manual-left').value;
  const toTbl   = form.querySelector('.jv-manual-rtbl').value;
  const toCol   = form.querySelector('.jv-manual-rcol').value;
  if (!leftVal || !toTbl || !toCol) return;

  const [fromTbl, fromCol] = leftVal.split('::');
  const tables = PROJECT.tables || {};
  const color  = _jvGroupColor(toTbl);

  _jvJoinTypes[fromTbl + '::' + toTbl] = jt;
  const edge = { from: fromTbl, fromCol, to: toTbl, toCol, color, manual: true };
  _jvManualEdges.push(edge);

  const fromName = tables[fromTbl]?.name || fromTbl.split('.').pop();
  const toName   = tables[toTbl]?.name   || toTbl.split('.').pop();
  const badge = document.createElement('div');
  badge.className = 'jv-conn-badge jv-conn-badge--manual';
  badge.dataset.from = fromTbl; badge.dataset.to = toTbl;
  badge.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px">
      <button class="jv-incl-btn" title="Rimuovi join manuale"
        onclick="_jvRemoveManual('${fromTbl}','${toTbl}',this.closest('.jv-conn-badge'))"></button>
      <select class="jv-join-select" style="color:${color};border-color:${color}"
        onchange="_jvSetJoinType('${fromTbl}','${toTbl}',this.value)"
        data-from="${fromTbl}" data-to="${toTbl}">
        <option${jt==='INNER JOIN'?' selected':''}>INNER JOIN</option>
        <option${jt==='LEFT JOIN' ?' selected':''}>LEFT JOIN</option>
        <option${jt==='RIGHT JOIN'?' selected':''}>RIGHT JOIN</option>
        <option${jt==='FULL JOIN' ?' selected':''}>FULL JOIN</option>
      </select>
    </div>
    <span class="jv-conn-cond jv-conn-cond--manual" style="color:${color};border-color:${color}">
      ${fromName}.<strong>${fromCol}</strong> = ${toName}.<strong>${toCol}</strong>
    </span>`;
  form.replaceWith(badge);
  _rebuildJoinSQL();
}

function _jvRemoveManual(from, to, badgeEl) {
  _jvManualEdges = _jvManualEdges.filter(e => !(e.from === from && e.to === to));
  delete _jvJoinTypes[from + '::' + to];
  badgeEl.remove();
  _rebuildJoinSQL();
}

// ── Excluded-edge helpers ─────────────────────────────────────────────────────

function _jvGetExcludedTables(edges) {
  const excl = new Set();
  for (const e of edges) {
    if (_jvExcluded.has(e.from + '::' + e.to)) excl.add(e.to);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      if (excl.has(e.from) && !excl.has(e.to)) { excl.add(e.to); changed = true; }
    }
  }
  return excl;
}

function _jvToggleEdge(from, to, btn) {
  const key = from + '::' + to;
  if (_jvExcluded.has(key)) _jvExcluded.delete(key);
  else                       _jvExcluded.add(key);
  _jvUpdateCardOpacities();
  _rebuildJoinSQL();
}

function _jvUpdateCardOpacities() {
  const graph = document.getElementById('jvGraph');
  const edges = JSON.parse(graph.dataset.edges || '[]');
  const excl  = _jvGetExcludedTables(edges);

  document.querySelectorAll('#jvGraph .jv-card').forEach(card => {
    const dim = excl.has(card.dataset.tname);
    card.style.opacity = dim ? '0.32' : '';
    card.style.filter  = dim ? 'grayscale(0.6)' : '';
  });
  document.querySelectorAll('#jvGraph .jv-conn-badge').forEach(badge => {
    const key      = badge.dataset.from + '::' + badge.dataset.to;
    const fromExcl = excl.has(badge.dataset.from);
    const dim      = _jvExcluded.has(key) || fromExcl;
    badge.style.opacity = dim ? '0.35' : '';
    const btn = badge.querySelector('.jv-incl-btn');
    if (btn) {
      const active = !_jvExcluded.has(key) && !fromExcl;
      btn.classList.toggle('excluded', !active);
      btn.title = active ? 'Escludi dal join' : 'Includi nel join';
    }
  });
}

// ── Dialect quoting ───────────────────────────────────────────────────────────

function _jvSyncDialect(val) {
  ['jvDialect', 'jvDialectUnion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
}

function _jvQuote(name) {
  const d = document.getElementById('jvDialect')?.value || 'generic';
  if (d === 'mssql')                        return `[${name}]`;
  if (d === 'postgresql' || d === 'sqlite') return `"${name}"`;
  return name;
}

// ── SQL panel resize ──────────────────────────────────────────────────────────

function _jvStartResizeSql(e, handle, wrapId) {
  e.preventDefault();
  const wrap    = document.getElementById(wrapId);
  const graphId = wrapId === 'jvSQLWrap' ? 'jvGraph' : 'jvUnionGraph';
  const graph   = document.getElementById(graphId);
  const startY  = e.clientY;
  const startH  = wrap.offsetHeight || 180;
  const resizeH = handle.offsetHeight || 20;

  handle.classList.add('dragging');
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'ns-resize';

  function onMove(ev) {
    ev.preventDefault();
    const h = Math.max(60, Math.min(window.innerHeight * 0.75, startH + (startY - ev.clientY)));
    wrap.style.height = h + 'px';
    handle.style.bottom = h + 'px';
    graph.style.paddingBottom = (h + resizeH) + 'px';
  }
  function onUp() {
    handle.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ── BFS ───────────────────────────────────────────────────────────────────────

function _jvBFS(root, depth, excluded = []) {
  const refs   = PROJECT.refs   || [];
  const tables = PROJECT.tables || {};
  const adj    = {};
  for (const r of refs) {
    (adj[r.from_table] = adj[r.from_table] || []).push({ neighbor: r.to_table,   myCol: r.from_col, neighborCol: r.to_col   });
    (adj[r.to_table]   = adj[r.to_table]   || []).push({ neighbor: r.from_table, myCol: r.to_col,   neighborCol: r.from_col });
  }

  const visited = new Map();
  const edges   = [];
  const queue   = [[root, 0]];
  visited.set(root, 0);

  while (queue.length) {
    const [tbl, hop] = queue.shift();
    if (hop >= depth) continue;
    for (const { neighbor, myCol, neighborCol } of (adj[tbl] || [])) {
      if (!tables[neighbor] || visited.has(neighbor)) continue;
      if (excluded.length && (excluded.includes(`${tbl}::${neighbor}`) || excluded.includes(`${neighbor}::${tbl}`))) continue;
      visited.set(neighbor, hop + 1);
      queue.push([neighbor, hop + 1]);
      edges.push({ from: tbl, fromCol: myCol, to: neighbor, toCol: neighborCol, colorIdx: edges.length });
    }
  }

  return { visited, edges };
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderJoinView(resetState = true) {
  const root  = document.getElementById('jvRootSelect').value;
  const depth = Math.max(1, parseInt(document.getElementById('jvDepth').value) || 1);
  const graph = document.getElementById('jvGraph');

  if (resetState) {
    _jvExcluded.clear();
    Object.keys(_jvSelectedCols).forEach(k => delete _jvSelectedCols[k]);
    _jvManualEdges = [];
  }

  if (!root) {
    graph.innerHTML = '<div class="jv-empty">Seleziona una tabella di partenza per esplorare i join</div>';
    document.getElementById('jvSQLWrap').style.display    = 'none';
    document.getElementById('jvSQLResize').style.display  = 'none';
    document.getElementById('jvCopyBtn').style.display    = 'none';
    graph.style.paddingBottom = '';
    return;
  }

  const tables = PROJECT.tables || {};
  const { visited, edges } = _jvBFS(root, depth);

  // join-column highlights: "tbl::col" → colorHex
  const joinColColor = {};
  edges.forEach(e => {
    const c = _jvGroupColor(e.to);
    e.color = c;
    joinColColor[e.from + '::' + e.fromCol] = c;
    joinColColor[e.to   + '::' + e.toCol]   = c;
  });

  // Add manual edge targets to visited and joinColColor
  for (const e of _jvManualEdges) {
    const fromHop = visited.get(e.from) ?? 0;
    if (!visited.has(e.to) && tables[e.to]) visited.set(e.to, fromHop + 1);
    const c = e.color || _jvGroupColor(e.to);
    joinColColor[e.from + '::' + e.fromCol] = c;
    joinColColor[e.to   + '::' + e.toCol]   = c;
  }

  // Group tables by hop
  const byHop  = new Map();
  for (const [tbl, hop] of visited) {
    (byHop.get(hop) || byHop.set(hop, []).get(hop)).push(tbl);
  }
  const maxHop = visited.size > 1 ? Math.max(...visited.values()) : 0;

  let html = '<div class="jv-row"><div class="jv-hops">';
  for (let h = 0; h <= Math.max(maxHop, depth); h++) {
    const tablesAtHop = byHop.get(h) || [];
    if (h > maxHop && h > 0 && tablesAtHop.length === 0) break;

    html += '<div class="jv-hop">';
    for (const tbl of tablesAtHop) {
      html += _jvCard(tbl, tables[tbl], joinColColor, h === 0);
    }
    html += '</div>';

    if (h < depth) {
      const hopEdges = edges.filter(e =>
        (visited.get(e.from) === h && visited.get(e.to) === h + 1) ||
        (visited.get(e.to)   === h && visited.get(e.from) === h + 1)
      );
      html += '<div class="jv-connector">';
      for (const e of hopEdges) {
        const jt       = _jvGetJoinType(e.from, e.to);
        const fromName = tables[e.from]?.name || e.from.split('.').pop();
        const toName   = tables[e.to]?.name   || e.to.split('.').pop();
        html += `<div class="jv-conn-badge" data-from="${e.from}" data-to="${e.to}">
          <div style="display:flex;align-items:center;gap:6px">
            <button class="jv-incl-btn" title="Escludi dal join"
              onclick="_jvToggleEdge('${e.from}','${e.to}',this)"></button>
            <select class="jv-join-select" style="color:${e.color};border-color:${e.color}"
              onchange="_jvSetJoinType('${e.from}','${e.to}',this.value)"
              data-from="${e.from}" data-to="${e.to}">
              <option${jt==='INNER JOIN'?' selected':''}>INNER JOIN</option>
              <option${jt==='LEFT JOIN' ?' selected':''}>LEFT JOIN</option>
              <option${jt==='RIGHT JOIN'?' selected':''}>RIGHT JOIN</option>
              <option${jt==='FULL JOIN' ?' selected':''}>FULL JOIN</option>
            </select>
          </div>
          <span class="jv-conn-cond" style="color:${e.color};border-color:${e.color}">${fromName}.<strong>${e.fromCol}</strong> = ${toName}.<strong>${e.toCol}</strong></span>
        </div>`;
      }
      const manualAtHop = _jvManualEdges.filter(e => (visited.get(e.from) ?? 0) === h);
      for (const e of manualAtHop) {
        const jt       = _jvGetJoinType(e.from, e.to);
        const fromName = tables[e.from]?.name || e.from.split('.').pop();
        const toName   = tables[e.to]?.name   || e.to.split('.').pop();
        html += `<div class="jv-conn-badge jv-conn-badge--manual" data-from="${e.from}" data-to="${e.to}">
          <div style="display:flex;align-items:center;gap:6px">
            <button class="jv-incl-btn" title="Rimuovi join manuale"
              onclick="_jvRemoveManual('${e.from}','${e.to}',this.closest('.jv-conn-badge'))"></button>
            <select class="jv-join-select" style="color:${e.color};border-color:${e.color}"
              onchange="_jvSetJoinType('${e.from}','${e.to}',this.value)"
              data-from="${e.from}" data-to="${e.to}">
              <option${jt==='INNER JOIN'?' selected':''}>INNER JOIN</option>
              <option${jt==='LEFT JOIN' ?' selected':''}>LEFT JOIN</option>
              <option${jt==='RIGHT JOIN'?' selected':''}>RIGHT JOIN</option>
              <option${jt==='FULL JOIN' ?' selected':''}>FULL JOIN</option>
            </select>
          </div>
          <span class="jv-conn-cond jv-conn-cond--manual" style="color:${e.color};border-color:${e.color}">${fromName}.<strong>${e.fromCol}</strong> = ${toName}.<strong>${e.toCol}</strong></span>
        </div>`;
      }
      html += `<button class="jv-add-join-btn" onclick="_jvShowAddJoin(this)">+ Aggiungi join</button>`;
      html += '</div>';
    }
  }
  html += '</div>'; // close jv-hops

  html += `<div style="display:flex;align-items:center;padding:0 10px;align-self:flex-start">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>
    </svg>
  </div>`;
  html += `<div class="jv-hop">
    <div class="jv-card jv-result-card" id="jvResultCard">
      <div class="jv-card-head" style="background:linear-gradient(135deg,#1e293b,#475569)">
        Risultato&nbsp;<span class="jv-root-badge">VIEW</span>
      </div>
      <div id="jvResultBody"></div>
    </div>
  </div>`;
  html += '</div>'; // close jv-row

  graph.innerHTML = html;
  graph.dataset.root    = root;
  graph.dataset.edges   = JSON.stringify(edges.map(e => ({ from: e.from, fromCol: e.fromCol, to: e.to, toCol: e.toCol, color: e.color })));
  graph.dataset.visited = JSON.stringify([...visited]);

  _rebuildJoinSQL();
  const sqlWrap   = document.getElementById('jvSQLWrap');
  const sqlResize = document.getElementById('jvSQLResize');
  const wrapH     = sqlWrap.offsetHeight || 180;
  const resizeH   = 20;
  sqlWrap.style.display   = '';
  sqlResize.style.display = '';
  sqlResize.style.bottom  = wrapH + 'px';
  graph.style.paddingBottom = (wrapH + resizeH) + 'px';
  document.getElementById('jvCopyBtn').style.display     = '';
  document.getElementById('jvSaveViewBtn').style.display = '';
  document.getElementById('jvExportWrap').style.display  = '';
}

function _jvCard(tname, tbl, joinColColor, isRoot) {
  if (!tbl) return '';
  const color = _jvGroupColor(tname);
  let h = `<div class="jv-card" data-tname="${tname}">`;
  h += `<div class="jv-card-head" style="background:${color}">${tbl.name || tname}`;
  if (isRoot) h += `<span class="jv-root-badge">ROOT</span>`;
  h += `</div>`;
  for (const col of tbl.columns) {
    const key       = `${tname}::${col.name}`;
    const cHex      = joinColColor[key];
    const cls       = cHex ? ' jv-join-col' : '';
    const style     = cHex ? `border-color:${cHex};background:${cHex}18` : '';
    const nameStyle = cHex ? `color:${cHex};font-weight:600` : '';
    const sel = (_jvSelectedCols[key] !== false);
    h += `<div class="jv-col-row jv-col-selectable${cls}" style="${style}" data-sel="${sel}"
      data-tname="${tname}" data-cname="${col.name}"
      onclick="_jvToggleCol('${tname}','${col.name}',this)">`;
    h += `<span class="jv-col-check"></span>`;
    h += `<span class="jv-col-name" style="${nameStyle}">`;
    if (col.pk) h += `<span class="nav-col-pk">PK</span>`;
    if (col.fk) h += `<span class="nav-col-fk">FK</span>`;
    h += `${col.name}</span>`;
    h += `<code class="jv-col-type">${col.type}</code>`;
    h += `</div>`;
  }
  h += `</div>`;
  return h;
}

function _jvToggleCol(tname, colname, el) {
  const key = `${tname}::${colname}`;
  const cur = _jvSelectedCols[key] !== false;
  _jvSelectedCols[key] = !cur;
  el.dataset.sel = String(!cur);
  _rebuildJoinSQL();
}

function _rebuildJoinSQL() {
  const graph = document.getElementById('jvGraph');
  const root  = graph.dataset.root;
  if (!root) return;
  const edges   = JSON.parse(graph.dataset.edges   || '[]');
  const visited = new Map(JSON.parse(graph.dataset.visited || '[]'));
  const tables  = PROJECT.tables || {};

  const aliases = {};
  for (const [tbl] of visited) aliases[tbl] = _jvAlias(tbl);
  for (const e of _jvManualEdges) { if (!aliases[e.to]) aliases[e.to] = _jvAlias(e.to); }

  const excl   = _jvGetExcludedTables(edges);
  const sorted = [...visited.entries()].sort((a, b) => a[1] - b[1]);
  const cols   = [];

  for (const [tbl] of sorted) {
    if (excl.has(tbl)) continue;
    const t = tables[tbl]; if (!t) continue;
    const a = aliases[tbl];
    for (const c of t.columns) {
      if (_jvSelectedCols[`${tbl}::${c.name}`] === false) continue;
      cols.push(`  ${a}.${_jvQuote(c.name)}`);
    }
  }
  for (const e of _jvManualEdges) {
    if (visited.has(e.to)) continue;
    const t = tables[e.to]; if (!t) continue;
    const a = aliases[e.to];
    for (const c of t.columns) {
      if (_jvSelectedCols[`${e.to}::${c.name}`] === false) continue;
      cols.push(`  ${a}.${_jvQuote(c.name)}`);
    }
  }

  const rootName = tables[root]?.name || root.split('.').pop();
  const dialect  = document.getElementById('jvDialect')?.value || 'generic';
  let sql = `SELECT\n${cols.join(',\n')}\nFROM ${_jvQuote(rootName)} ${aliases[root]}`;

  const sortedEdges = [...edges].sort((a, b) => (visited.get(a.to) ?? 0) - (visited.get(b.to) ?? 0));
  for (const e of sortedEdges) {
    if (_jvExcluded.has(e.from + '::' + e.to) || excl.has(e.to)) continue;
    let jt      = _jvGetJoinType(e.from, e.to);
    const tName = tables[e.to]?.name || e.to.split('.').pop();
    if (dialect === 'sqlite' && jt === 'FULL JOIN') jt = 'LEFT JOIN /*FULL JOIN non supportato in SQLite*/';
    sql += `\n${jt} ${_jvQuote(tName)} ${aliases[e.to]}`;
    sql += `\n  ON ${aliases[e.from]}.${_jvQuote(e.fromCol)} = ${aliases[e.to]}.${_jvQuote(e.toCol)}`;
  }
  for (const e of _jvManualEdges) {
    let jt      = _jvGetJoinType(e.from, e.to);
    const tName = tables[e.to]?.name || e.to.split('.').pop();
    if (dialect === 'sqlite' && jt === 'FULL JOIN') jt = 'LEFT JOIN /*FULL JOIN non supportato in SQLite*/';
    sql += `\n${jt} ${_jvQuote(tName)} ${aliases[e.to]}`;
    sql += `\n  ON ${aliases[e.from]}.${_jvQuote(e.fromCol)} = ${aliases[e.to]}.${_jvQuote(e.toCol)}`;
  }
  sql += ';';

  document.getElementById('jvSQLCode').textContent = sql;
  _jvUpdateResultCard(aliases, visited, excl, tables);

  document.querySelectorAll('.jv-join-select').forEach(sel => {
    const jt = _jvGetJoinType(sel.dataset.from, sel.dataset.to);
    for (const opt of sel.options) opt.selected = opt.text === jt;
  });
}

function _jvUpdateResultCard(aliases, visited, excl, tables) {
  const body = document.getElementById('jvResultBody');
  if (!body) return;
  const sorted = [...visited.entries()].sort((a, b) => a[1] - b[1]);
  let html = '';
  for (const [tbl] of sorted) {
    if (excl.has(tbl)) continue;
    const t = tables[tbl]; if (!t) continue;
    const color = _jvGroupColor(tbl);
    const alias = aliases[tbl];
    html += `<div class="jv-result-group-label" style="background:${color}">
      ${t.name} <span style="opacity:.65;font-weight:400;font-size:9px">(${alias})</span>
    </div>`;
    for (const c of t.columns) {
      if (_jvSelectedCols[`${tbl}::${c.name}`] === false) continue;
      html += `<div class="jv-col-row">
        <span class="jv-col-name">
          <span style="color:#94a3b8;font-size:10px;margin-right:1px">${alias}.</span>${c.name}
          ${c.pk ? '<span class="nav-col-pk" style="margin-left:3px">PK</span>' : ''}
          ${c.fk ? '<span class="nav-col-fk" style="margin-left:3px">FK</span>' : ''}
        </span>
        <code class="jv-col-type">${c.type}</code>
      </div>`;
    }
  }
  const shownManual = new Set();
  for (const e of _jvManualEdges) {
    if (visited.has(e.to) || shownManual.has(e.to)) continue;
    shownManual.add(e.to);
    const t = tables[e.to]; if (!t) continue;
    const color = _jvGroupColor(e.to);
    const alias = aliases[e.to];
    html += `<div class="jv-result-group-label" style="background:${color}">
      ${t.name} <span style="opacity:.65;font-weight:400;font-size:9px">(${alias}) \u2736</span>
    </div>`;
    for (const c of t.columns) {
      if (_jvSelectedCols[`${e.to}::${c.name}`] === false) continue;
      html += `<div class="jv-col-row">
        <span class="jv-col-name">
          <span style="color:#94a3b8;font-size:10px;margin-right:1px">${alias}.</span>${c.name}
        </span>
        <code class="jv-col-type">${c.type}</code>
      </div>`;
    }
  }
  if (!html) html = '<div class="jv-empty" style="padding:20px;font-size:11px">Nessun join attivo</div>';
  body.innerHTML = html;
}

function copyJoinSQL() {
  const txt = document.getElementById('jvSQLCode').textContent;
  const _flash = () => {
    const btn = document.getElementById('jvCopyBtn');
    btn.textContent = 'Copiato!';
    setTimeout(() => btn.textContent = 'Copia SQL', 1500);
  };
  navigator.clipboard.writeText(txt).then(_flash).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    _flash();
  });
}

function toggleJvExportMenu(btn) {
  const menu = document.getElementById('jvExportMenu');
  const open = menu.style.display === 'none';
  menu.style.display = open ? '' : 'none';
  if (open) {
    const close = e => {
      if (!btn.closest('.jv-export-wrap').contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
}

function _jvBuildExportData() {
  const graph   = document.getElementById('jvGraph');
  const root    = graph.dataset.root;
  const edges   = JSON.parse(graph.dataset.edges   || '[]');
  const visited = new Map(JSON.parse(graph.dataset.visited || '[]'));
  const tables  = PROJECT.tables || {};
  const aliases = {};
  for (const [tbl] of visited) aliases[tbl] = _jvAlias(tbl);
  for (const e of _jvManualEdges) if (!aliases[e.to]) aliases[e.to] = _jvAlias(e.to);
  const excl = _jvGetExcludedTables(edges);

  const cols   = [];
  const sorted = [...visited.entries()].sort((a, b) => a[1] - b[1]);
  for (const [tbl] of sorted) {
    if (excl.has(tbl)) continue;
    const t = tables[tbl]; if (!t) continue;
    const a = aliases[tbl];
    for (const c of t.columns) {
      if (_jvSelectedCols[`${tbl}::${c.name}`] === false) continue;
      cols.push({ alias: a, colname: c.name, type: c.type, tname: t.name });
    }
  }
  for (const e of _jvManualEdges) {
    if (visited.has(e.to)) continue;
    const t = tables[e.to]; if (!t) continue;
    const a = aliases[e.to];
    for (const c of t.columns) {
      if (_jvSelectedCols[`${e.to}::${c.name}`] === false) continue;
      cols.push({ alias: a, colname: c.name, type: c.type, tname: t.name });
    }
  }
  return { root, cols, tables, aliases, visited, edges, excl, sql: document.getElementById('jvSQLCode').textContent };
}

function exportViewSQL() {
  document.getElementById('jvExportMenu').style.display = 'none';
  const { sql } = _jvBuildExportData();
  const name = prompt('Nome della VIEW:', 'v_join');
  if (!name) return;
  const ddl = `CREATE VIEW ${name} AS\n${sql.replace(/;$/, '')};`;
  _jvDownload(name + '.sql', ddl);
}

function exportViewDBML() {
  document.getElementById('jvExportMenu').style.display = 'none';
  const { cols } = _jvBuildExportData();
  const name = prompt('Nome della tabella DBML:', 'v_join');
  if (!name) return;
  const lines = cols.map(c => {
    const colId = c.alias !== c.tname.slice(0, 3).toLowerCase()
      ? `${c.alias}_${c.colname}` : c.colname;
    return `  ${colId} ${c.type} [note: '${c.tname}.${c.colname}']`;
  });
  _jvDownload(name + '.dbml', `Table ${name} {\n${lines.join('\n')}\n}`);
}

function _jvDownload(filename, text) {
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
  a.download = filename;
  a.click();
}
