/**
 * @file joinview/union.js — UNION builder (depends on join.js for _jvGroupColor)
 */

// ═══════════════════════════════════════════════════════════════════════════════
//  UNION BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

let _jvUnionType = 'UNION ALL';

function selectUnionType(btn) {
  document.querySelectorAll('.jv-utype-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _jvUnionType = btn.dataset.utype;
  renderUnionView();
}

function renderUnionView() {
  const tA   = document.getElementById('jvUnionA').value;
  const tB   = document.getElementById('jvUnionB').value;
  const area = document.getElementById('jvUnionGraph');

  if (!tA || !tB) {
    area.innerHTML = '<div class="jv-empty">Seleziona due tabelle per confrontarle con UNION</div>';
    document.getElementById('jvUnionSQLWrap').style.display   = 'none';
    document.getElementById('jvUnionSQLResize').style.display = 'none';
    document.getElementById('jvUnionCopyBtn').style.display   = 'none';
    area.style.paddingBottom = '';
    return;
  }
  if (tA === tB) {
    area.innerHTML = '<div class="jv-empty">Seleziona due tabelle diverse</div>';
    return;
  }

  const tables = PROJECT.tables || {};
  const tblA   = tables[tA], tblB = tables[tB];
  if (!tblA || !tblB) return;

  const colsA    = tblA.columns, colsB = tblB.columns;
  const matchedB = new Set();
  const matches  = colsA.map(ca => {
    const cb = colsB.find(c => c.name.toLowerCase() === ca.name.toLowerCase());
    if (cb) matchedB.add(cb.name.toLowerCase());
    return { ca, cb: cb || null };
  });
  const onlyB  = colsB.filter(c => !matchedB.has(c.name.toLowerCase()));
  const colorA = _jvGroupColor(tA), colorB = _jvGroupColor(tB);

  let hA = `<div class="jv-union-card"><div class="jv-union-head" style="background:${colorA}">${tblA.name || tA}</div>`;
  for (const { ca, cb } of matches) {
    hA += `<div class="jv-union-col ${cb ? 'jv-match' : ''}"><span>${ca.name}</span><code class="jv-col-type">${ca.type}</code></div>`;
  }
  for (const _ of onlyB) {
    hA += `<div class="jv-union-col jv-nomatch"><span>\u2014</span><code class="jv-col-type"></code></div>`;
  }
  hA += `</div>`;

  const hC = `<div class="jv-union-center">
    <div style="font-size:13px;font-weight:700;color:#3b82f6;letter-spacing:.05em">${_jvUnionType}</div>
    <div style="font-size:10px;color:#94a3b8">${matches.filter(m=>m.cb).length} colonne in comune</div>
  </div>`;

  let hB = `<div class="jv-union-card"><div class="jv-union-head" style="background:${colorB}">${tblB.name || tB}</div>`;
  for (const { ca, cb } of matches) {
    hB += `<div class="jv-union-col ${cb ? 'jv-match' : 'jv-nomatch'}"><span>${cb ? cb.name : '\u2014'}</span><code class="jv-col-type">${cb ? cb.type : ''}</code></div>`;
  }
  for (const c of onlyB) {
    hB += `<div class="jv-union-col jv-match"><span>${c.name}</span><code class="jv-col-type">${c.type}</code></div>`;
  }
  hB += `</div>`;

  area.innerHTML = `<div class="jv-union-wrap">${hA}${hC}${hB}</div>`;

  const allColNames = [...matches.map(m => m.ca.name), ...onlyB.map(c => c.name)];
  const selA = allColNames.map(n => {
    const col = colsA.find(c => c.name.toLowerCase() === n.toLowerCase());
    return col ? `  ${_jvQuote(col.name)}` : `  NULL AS ${_jvQuote(n)}`;
  });
  const selB = allColNames.map(n => {
    const col = colsB.find(c => c.name.toLowerCase() === n.toLowerCase());
    return col ? `  ${_jvQuote(col.name)}` : `  NULL AS ${_jvQuote(n)}`;
  });

  const nameA = tblA.name || tA.split('.').pop();
  const nameB = tblB.name || tB.split('.').pop();
  const sql   = `SELECT\n${selA.join(',\n')}\nFROM ${_jvQuote(nameA)}\n${_jvUnionType}\nSELECT\n${selB.join(',\n')}\nFROM ${_jvQuote(nameB)};`;

  const uWrap    = document.getElementById('jvUnionSQLWrap');
  const uResize  = document.getElementById('jvUnionSQLResize');
  const uSavedH  = parseInt(localStorage.getItem('jv_union_sql_h')) || 0;
  if (uSavedH) uWrap.style.height = uSavedH + 'px';
  const uWrapH   = parseInt(uWrap.style.height) || uWrap.offsetHeight || 180;
  const uResizeH = 20;
  uWrap.style.display   = '';
  uResize.style.display = '';
  uResize.style.bottom  = uWrapH + 'px';
  area.style.paddingBottom = (uWrapH + uResizeH) + 'px';
  _jvSetSQL('jvUnionSQLCode', sql);
  document.getElementById('jvUnionCopyBtn').style.display   = '';
}

function copyUnionSQL() {
  const txt = document.getElementById('jvUnionSQLCode').textContent;
  const _flash = () => {
    const btn = document.getElementById('jvUnionCopyBtn');
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
