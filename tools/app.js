// ---- dash shim (static) ----
(function () {
  const store = {};
  Object.keys(window.DATA).forEach((k) => { store[k] = { status: 'ok', data: window.DATA[k].rows, columns: window.DATA[k].columns }; });
  const reg = {}; let ready = false;
  const run = (name) => (reg[name] || []).forEach((fn) => document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => { try { fn(el); } catch (e) { console.error(name, e); } }));
  window.dash = {
    colors: ['#2a7ab0', '#e08a2c', '#4f9a5c', '#a05aa8', '#c2554f'],
    data: (id) => store[id] || { status: 'missing' },
    draw: (name, fn) => { if (fn) { (reg[name] = reg[name] || []).push(fn); if (ready) run(name); } else run(name); },
    calc: (name, cfg) => { try { store[name] = { status: 'ok', data: cfg.fn(...cfg.inputs.map((i) => store[i] ? store[i].data : [])) }; } catch (e) { store[name] = { status: 'error' }; } },
    _start: () => { ready = true; Object.keys(reg).forEach(run); },
    _charts: () => Object.keys(reg).filter((n) => /chart/.test(n)).forEach(run),
  };
})();

// spread mini cards
(function () {
  const groups = [
    ['통안·국고 커브', [['s1', '통안1/2'], ['s2', '통안2/3'], ['s3', '국고1/3'], ['s4', '국고2/3'], ['s7', '국고3/5'], ['s8', '국고3/10'], ['s9', '국고5/10'], ['s17', '국고10/20'], ['s10', '국고5/30'], ['s11', '국고3/30'], ['s12', '국고10/30'], ['s13', '국고3/5/10'], ['s14', '국고3/10/30']]],
    ['본드스왑·국민주택', [['s5', '본드스왑 1년'], ['s6', '본드스왑 2년'], ['s16', '국주1종'], ['s28', '은행채 본드스왑 1Y']]],
    ['은행채·카드', [['s15', '은행채 1년'], ['s18', '은행채 1.5년'], ['s19', '은행채 2년'], ['s20', '은행채 3년'], ['s21', '카드 1년'], ['s22', '카드 1.5년'], ['s23', '카드 2년']]],
    ['은행 vs 카드 스프레드', [['s25', '은행VS카드 1년'], ['s26', '은행VS카드 1.5년'], ['s27', '은행VS카드 2년']]],
  ];
  const box = document.getElementById('spread-minis');
  groups.forEach(([g, items]) => {
    const h = document.createElement('h3'); h.className = 'ds-subh'; h.textContent = g; box.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'ds-grid3';
    items.forEach(([sid, name]) => {
      const c = document.createElement('div'); c.className = 'ds-card ds-mini';
      c.innerHTML = `<div class="ds-mini-h"><span></span><b data-draw="spread_cur" data-sid="${sid}">—</b></div><table class="ds-mtbl" data-draw="spread_mini"></table><div class="ds-chart ds-chart-sm" data-draw="spread_chart" data-sid="${sid}"></div>`;
      c.querySelector('span').textContent = name; grid.appendChild(c);
    });
    box.appendChild(grid);
  });
  box.style.display = 'contents';
})();

// shared helpers
(function () {
  const H = {};
  H.num = (v) => (v === null || v === undefined || v === '' ? null : +v);
  H.f0 = d3.format(',.0f');
  H.f1 = d3.format(',.1f');
  H.f2 = d3.format(',.2f');
  H.pct3 = (v) => (v == null ? '' : d3.format('.3f')(v * 100) + '%');
  H.pct2 = (v) => (v == null ? '' : d3.format('.2f')(v * 100) + '%');
  H.sgn = (v) => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'dn' : '');
  H.date = (s) => (s ? s.replace(/^\d\d(\d\d)-(\d\d)-(\d\d)$/, '$1.$2.$3') : '');
  H.td = (tr, text, cls) => { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.appendChild(td); return td; };
  H.rows = (el, id, colspan) => {
    const s = dash.data(id);
    if (s.status === 'ok') return s.data;
    if (el.tagName === 'TBODY') {
      el.replaceChildren(); const tr = document.createElement('tr'); const td = H.td(tr, '불러오지 못했습니다', 'l muted'); td.colSpan = colspan || 8; el.appendChild(tr);
    } else el.textContent = '불러오지 못함';
    return null;
  };
  H.range = {};
  H.lineChart = (el, cfg) => {
    const s = dash.data(cfg.source);
    if (s.status !== 'ok') { el.replaceChildren(); const p = document.createElement('div'); p.className = 'ds-fail'; p.textContent = '불러오지 못했습니다'; el.appendChild(p); return; }
    if (!el.clientWidth) return;
    const parse = d3.utcParse('%Y-%m-%d');
    let rows = s.data.map((r) => { const o = { t: parse(r[cfg.x]) }; cfg.series.forEach((k) => { o[k.key] = H.num(r[k.key]); }); return o; }).filter((r) => r.t);
    rows.sort((a, b) => a.t - b.t);
    const yrs = H.range[cfg.name] ?? cfg.defaultRange;
    if (yrs && rows.length) { const end = rows[rows.length - 1].t; const start = d3.utcYear.offset(end, -yrs); rows = rows.filter((r) => r.t >= start); }
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth), Hh = 240;
    const svg = d3.select(el).append('svg').attr('width', W).attr('height', Hh).attr('role', 'img').attr('aria-label', cfg.label);
    const left = cfg.series.filter((k) => !k.right), right = cfg.series.filter((k) => k.right);
    const ext = (ks) => { const v = []; rows.forEach((r) => ks.forEach((k) => { if (r[k.key] != null) v.push(r[k.key]); })); return d3.extent(v); };
    const yL = d3.scaleLinear().domain(ext(left)).nice();
    const yR = right.length ? d3.scaleLinear().domain(ext(right)).nice() : null;
    const fmtL = cfg.fmtL || H.f0, fmtR = cfg.fmtR || H.f2;
    const meas = svg.append('g');
    const wOf = (ticks, f) => d3.max(ticks.map((t) => meas.append('text').text(f(t)).node().getComputedTextLength())) || 30;
    const ml = wOf(yL.ticks(5), fmtL) + 10, mr = yR ? wOf(yR.ticks(5), fmtR) + 10 : 12;
    meas.remove();
    const m = { t: 8, r: mr, b: 24, l: ml };
    const x = d3.scaleUtc().domain(d3.extent(rows, (r) => r.t)).range([m.l, W - m.r]);
    yL.range([Hh - m.b, m.t]); if (yR) yR.range([Hh - m.b, m.t]);
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(yL).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(fmtL)).call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('x', -6));
    if (yR) svg.append('g').attr('transform', `translate(${W - m.r},0)`).call(d3.axisRight(yR).ticks(5).tickSize(0).tickFormat(fmtR)).call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('x', 6));
    const nT = Math.max(2, Math.floor((W - m.l - m.r) / 80));
    svg.append('g').attr('transform', `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(nT).tickSizeOuter(0).tickFormat(d3.utcFormat(yrs && yrs <= 3 ? '%y.%m' : '%Y')));
    cfg.series.forEach((k) => {
      const y = k.right ? yR : yL;
      const line = d3.line().defined((r) => r[k.key] != null).x((r) => x(r.t)).y((r) => y(r[k.key]));
      svg.append('path').datum(rows).attr('fill', 'none').attr('stroke-width', k.dash ? 1.3 : 1.8).attr('stroke-dasharray', k.dash ? '5,4' : null).attr('d', line).style('stroke', dash.colors[k.c]);
    });
    if (cfg.zero && yL.domain()[0] < 0 && yL.domain()[1] > 0) svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', yL(0)).attr('y2', yL(0)).style('stroke', 'var(--cds-chart-reference)');
    const tip = document.createElement('div'); tip.className = 'ds-tip'; tip.hidden = true; el.appendChild(tip);
    const vline = svg.append('line').attr('y1', m.t).attr('y2', Hh - m.b).style('stroke', 'var(--cds-chart-reference)').attr('opacity', 0);
    const bis = d3.bisector((r) => r.t).center;
    const show = (ev) => {
      const [px] = d3.pointer(ev, svg.node()); const r = rows[bis(rows, x.invert(px))]; if (!r) return;
      vline.attr('x1', x(r.t)).attr('x2', x(r.t)).attr('opacity', 1);
      tip.replaceChildren(); const b = document.createElement('b'); b.textContent = d3.utcFormat('%Y-%m-%d')(r.t); tip.appendChild(b);
      cfg.series.forEach((k) => { if (r[k.key] == null) return; const d = document.createElement('div'); d.textContent = `${k.label}: ${(k.right ? fmtR : fmtL)(r[k.key])}`; tip.appendChild(d); });
      tip.hidden = false; const tx = x(r.t); tip.style.top = '8px';
      const tw = tip.offsetWidth; tip.style.left = (tx + 12 + tw > W ? tx - 12 - tw : tx + 12) + 'px';
    };
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', Hh - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', show).on('pointerdown', show).on('pointerleave', () => { tip.hidden = true; vline.attr('opacity', 0); });
  };
  window.DS = H;
})();

document.querySelectorAll('[data-range-for]').forEach((grp) => {
  const name = grp.getAttribute('data-range-for');
  grp.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    grp.querySelectorAll('button').forEach((o) => o.setAttribute('aria-pressed', o === b ? 'true' : 'false'));
    DS.range[name] = +b.getAttribute('data-range');
    dash.draw(name);
  }));
});
document.querySelectorAll('[data-otc]').forEach((b) => b.addEventListener('click', () => {
  const k = b.getAttribute('data-otc');
  document.querySelectorAll('[data-otc]').forEach((o) => o.setAttribute('aria-pressed', o === b ? 'true' : 'false'));
  document.querySelectorAll('[data-otc-panel]').forEach((p) => { p.hidden = p.getAttribute('data-otc-panel') !== k; });
}));
document.querySelectorAll('.ds').forEach((root) => { root.style.setProperty('--dash-c0', dash.colors[0]); root.style.setProperty('--dash-c1', dash.colors[1]); root.style.setProperty('--dash-c2', dash.colors[2]); });
document.querySelectorAll('details').forEach((d) => d.addEventListener('toggle', () => { if (d.open) dash._charts(); }));

[['asof', '기준일'], ['asof_prev', '전일'], ['asof_week', '전주'], ['asof_month', '전월']].forEach(([n, f]) => dash.draw(n, (el) => { const r = DS.rows(el, 'asof'); if (r && r[0]) el.textContent = DS.date(r[0][f]); }));
['otc_period', 'otc_period_end'].forEach((n, i) => dash.draw(n, (el) => { const r = DS.rows(el, 'asof'); if (r && r[0]) el.textContent = r[0][i ? '주간끝' : '주간시작']; }));

dash.draw('deposit_rows', (tb) => {
  const rows = DS.rows(tb, 'deposit', 8); if (!rows) return;
  const h = dash.data('deposit_hist'); const hist = h.status === 'ok' ? h.data : [];
  tb.replaceChildren(); let prev = null;
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    if (r['구분'] !== prev && prev !== null) tr.className = 'grp';
    DS.td(tr, r['구분'] !== prev ? r['구분'] : '', 'l'); prev = r['구분'];
    DS.td(tr, r['항목'], 'l');
    DS.td(tr, DS.date(r['기준일']), 'muted');
    DS.td(tr, DS.f0(+r['잔액']));
    ['전일비', '전주비', '전월비'].forEach((k) => { const v = DS.num(r[k]); DS.td(tr, v == null ? '—' : d3.format('+,.0f')(v), v == null ? 'muted' : DS.sgn(v)); });
    const td = DS.td(tr, '', 'l'); const wrap = document.createElement('span'); wrap.className = 'ds-months';
    hist.filter((x) => x['항목'] === r['항목']).sort((a, b) => +a['순서'] - +b['순서']).forEach((x) => {
      const sp = document.createElement('span'); const sm = document.createElement('small'); sm.textContent = x['월'];
      const v = document.createElement('span'); v.textContent = DS.f0(+x['잔액']);
      sp.append(sm, v); wrap.appendChild(sp);
    });
    td.appendChild(wrap); tb.appendChild(tr);
  });
});
dash.draw('mmf_chart', (el) => DS.lineChart(el, { name: 'mmf_chart', source: 'mmf', x: '일자', defaultRange: 3, label: 'MMF 잔고 추이 (조원)', fmtL: DS.f0, series: [{ key: 'MMF', label: 'MMF', c: 0 }] }));

const invRows = (prod) => (tb) => {
  const rows = DS.rows(tb, 'ktbf_inv', 8); if (!rows) return;
  tb.replaceChildren();
  rows.filter((r) => r['상품'] === prod).forEach((r) => {
    const tr = document.createElement('tr');
    DS.td(tr, r['투자자'], 'l');
    ['순매수', '누적순매수', '5d', '10d', '20d', '6M_Max', '6M_Min'].forEach((k) => { const v = DS.num(r[k]); DS.td(tr, v == null ? '' : DS.f0(v), DS.sgn(v)); });
    tb.appendChild(tr);
  });
};
dash.draw('ktbf_rows', invRows('KTBF'));
dash.draw('lktbf_rows', invRows('LKTBF'));
dash.draw('cum3_chart', (el) => DS.lineChart(el, { name: 'cum3_chart', source: 'ktbf_cum', x: '일자', defaultRange: 1, zero: true, label: '외국인 3년 국채선물 누적순매수 (계약)', series: [{ key: '3선_누적', label: '누적순매수', c: 0 }, { key: '3선_20년AVG', label: '20년~ 평균', c: 1, dash: true }, { key: '3선_23년AVG', label: '23년~ 평균', c: 2, dash: true }] }));
dash.draw('cum10_chart', (el) => DS.lineChart(el, { name: 'cum10_chart', source: 'ktbf_cum', x: '일자', defaultRange: 1, zero: true, label: '외국인 10년 국채선물 누적순매수 (계약)', series: [{ key: '10선_누적', label: '누적순매수', c: 0 }, { key: '10선_20년AVG', label: '20년~ 평균', c: 1, dash: true }, { key: '10선_23년AVG', label: '23년~ 평균', c: 2, dash: true }] }));

const otcRows = (id) => (tb) => {
  const rows = DS.rows(tb, id, 9); if (!rows) return;
  tb.replaceChildren(); let prev = null;
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    const cls = []; if (r['종류'] === '합계') cls.push('sum'); if (r['투자자'] !== prev && prev !== null) cls.push('grp'); tr.className = cls.join(' ');
    DS.td(tr, r['투자자'] !== prev ? r['투자자'] : '', 'l'); prev = r['투자자'];
    DS.td(tr, r['종류'], 'l');
    ['1Y이하', '2Y이하', '3Y이하', '5Y이하', '10Y이하', '10Y초과', '전체'].forEach((k) => { const v = DS.num(r[k]); DS.td(tr, v == null ? '' : DS.f0(v), v ? DS.sgn(v) : 'muted'); });
    tb.appendChild(tr);
  });
};
dash.draw('otc_daily_rows', otcRows('otc_daily'));
dash.draw('otc_weekly_rows', otcRows('otc_weekly'));
dash.draw('otcfx_d_date', (el) => { const r = DS.rows(el, 'asof'); if (r && r[0]) el.textContent = DS.date(r[0]['기준일']); });
dash.draw('otcfx_w_s', (el) => { const r = DS.rows(el, 'asof'); if (r && r[0]) el.textContent = r[0]['주간시작']; });
dash.draw('otcfx_w_e', (el) => { const r = DS.rows(el, 'asof'); if (r && r[0]) el.textContent = r[0]['주간끝']; });
dash.draw('otcfx_total', (el) => {
  const id = el.getAttribute('data-src'); const rows = DS.rows(el, id); if (!rows) return;
  const x = rows.find((r) => r['투자자'] === '외국인' && r['종류'] === '합계');
  const v = x ? DS.num(x['전체']) : null;
  el.textContent = v == null ? '—' : d3.format('+,.0f')(v) + '억';
  el.className = 'ds-big ' + DS.sgn(v);
});
dash.draw('otcfx_tbl', (tbl) => {
  const id = tbl.getAttribute('data-src'); const s = dash.data(id); tbl.replaceChildren();
  if (s.status !== 'ok') return;
  const cols = ['1Y이하', '2Y이하', '3Y이하', '5Y이하', '10Y이하', '10Y초과', '전체'];
  const thead = document.createElement('thead'); const hr = document.createElement('tr');
  const th0 = document.createElement('th'); th0.className = 'l'; th0.textContent = '종류'; hr.appendChild(th0);
  cols.forEach((c) => { const th = document.createElement('th'); th.textContent = c.replace('이하', '').replace('초과', '+'); hr.appendChild(th); });
  thead.appendChild(hr);
  const tbody = document.createElement('tbody');
  s.data.filter((r) => r['투자자'] === '외국인').forEach((r) => {
    const tr = document.createElement('tr'); if (r['종류'] === '합계') tr.className = 'sum';
    DS.td(tr, r['종류'], 'l');
    cols.forEach((c) => { const v = DS.num(r[c]); DS.td(tr, v == null ? '' : v === 0 ? '·' : d3.format('+,.0f')(v), v ? DS.sgn(v) : 'muted'); });
    tbody.appendChild(tr);
  });
  tbl.append(thead, tbody);
});

dash.draw('fx_chart', (el) => DS.lineChart(el, { name: 'fx_chart', source: 'fx_bond', x: '일자', defaultRange: 3, label: '외국인 원화채 보유잔고(조원)와 듀레이션(년)', fmtL: DS.f0, fmtR: DS.f1, series: [{ key: '잔고', label: '잔고(조원)', c: 0 }, { key: '듀레이션', label: '듀레이션', c: 1, right: true }] }));
dash.draw('fx_snap_rows', (tb) => {
  const rows = DS.rows(tb, 'fx_snap', 2); if (!rows) return;
  tb.replaceChildren();
  rows.forEach((r) => { const tr = document.createElement('tr'); DS.td(tr, DS.date(r['일자']), 'l'); DS.td(tr, DS.f1(+r['잔고'])); tb.appendChild(tr); });
});
dash.draw('lend_card', (el) => {
  const name = el.getAttribute('data-name'); const s = dash.data('lending'); el.replaceChildren();
  if (s.status !== 'ok') { el.textContent = '불러오지 못함'; return; }
  const r = s.data.find((x) => x['종목'] === name);
  if (!r) { el.textContent = '데이터 없음'; return; }
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const top = mk('div', 'lv'); top.append(mk('span', null, DS.f0(+r['잔량'])), mk('small', null, ' 잔량'));
  el.appendChild(top);
  const p = mk('div', 'lr'); p.append(mk('span', 'k', '상장잔액 대비'), mk('span', null, DS.pct2(DS.num(r['상장잔액대비'])))); el.appendChild(p);
  ['전일비', '전주비', '전월비'].forEach((f) => {
    const v = DS.num(r[f]); const row = mk('div', 'lr');
    row.append(mk('span', 'k', f), mk('span', v ? DS.sgn(v) : 'muted', v == null ? '' : v ? d3.format('+,.0f')(v) : '0'));
    el.appendChild(row);
  });
});
dash.draw('lending_rows', (tb) => {
  const rows = DS.rows(tb, 'lending', 8); if (!rows) return;
  tb.replaceChildren();
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    DS.td(tr, r['종목'], 'l');
    ['거래', '상환', '잔량'].forEach((k) => { const v = DS.num(r[k]); DS.td(tr, v == null ? '' : DS.f0(v), v ? '' : 'muted'); });
    DS.td(tr, DS.pct2(DS.num(r['상장잔액대비'])));
    ['전일비', '전주비', '전월비'].forEach((k) => { const v = DS.num(r[k]); DS.td(tr, v == null ? '' : v ? d3.format('+,.0f')(v) : '0', v ? DS.sgn(v) : 'muted'); });
    tb.appendChild(tr);
  });
});

[['', '기본'], ['2', '내부']].forEach(([p, basis]) => {
  const pick = (el) => { const r = DS.rows(el, 'rates'); return r ? r.find((x) => x['기준'] === basis) : null; };
  dash.draw(`r${p}_days`, (el) => { const r = pick(el); if (r) el.textContent = DS.f0(+r['잔존일']); });
  dash.draw(`r${p}_call`, (el) => { const r = pick(el); if (r) el.textContent = DS.pct3(+r['Call']); });
  dash.draw(`r${p}_cd`, (el) => { const r = pick(el); if (r) el.textContent = DS.pct3(+r['CD91d']); });
  dash.draw(`r${p}_msb`, (el) => { const r = pick(el); if (r) el.textContent = DS.pct3(+r['MSB1Y']); });
});
const tick = (v) => (v == null ? '' : d3.format('+.1f')(v) + '틱');
const futRows = (basis) => (tb) => {
  const rows = DS.rows(tb, 'fut', 8); if (!rows) return;
  tb.replaceChildren();
  rows.filter((r) => r['기준'] === basis).forEach((r) => {
    const tr = document.createElement('tr');
    DS.td(tr, r['구분'], 'l');
    DS.td(tr, DS.f2(+r['시장가'])); DS.td(tr, DS.pct3(+r['Implied'])); DS.td(tr, d3.format('.4f')(+r['PVBP']));
    DS.td(tr, d3.format('.3f')(+r['현물가'])); DS.td(tr, tick(DS.num(r['현물Basis'])), DS.sgn(DS.num(r['현물Basis'])));
    DS.td(tr, d3.format('.3f')(+r['이론가'])); DS.td(tr, tick(DS.num(r['이론Basis'])), DS.sgn(DS.num(r['이론Basis'])));
    tb.appendChild(tr);
  });
};
dash.draw('fut_rows', futRows('기본'));
dash.draw('fut2_rows', futRows('내부'));
dash.draw('basket_rows', (tb) => {
  const rows = DS.rows(tb, 'basket', 8); if (!rows) return;
  tb.replaceChildren(); let prev = null;
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    if (r['구분'] !== prev && prev !== null) tr.className = 'grp';
    DS.td(tr, r['구분'] !== prev ? r['구분'] : '', 'l'); prev = r['구분'];
    DS.td(tr, r['종목'], 'l');
    DS.td(tr, DS.pct3(+r['Spot'])); DS.td(tr, DS.pct3(+r['Forward']));
    const fs = DS.num(r['F_S']); DS.td(tr, d3.format('+.1f')(fs) + 'bp', DS.sgn(fs));
    DS.td(tr, d3.format('.4f')(+r['PVBP'])); DS.td(tr, DS.pct2(+r['대차비율'])); DS.td(tr, DS.pct2(+r['외국인비율']));
    tb.appendChild(tr);
  });
});

// 은행채
(function () {
  const pct1 = (v) => (v == null ? '' : d3.format('.1f')(v * 100) + '%');
  dash.draw('bank_plan_tbl', (tbl) => {
    const s = dash.data('bank_plan'); tbl.replaceChildren();
    if (s.status !== 'ok') return;
    const rows = s.data;
    const mk = (tag, text, cls) => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; };
    const thead = document.createElement('thead'); const hr = document.createElement('tr');
    hr.appendChild(mk('th', '은행', 'l'));
    rows.forEach((r) => hr.appendChild(mk('th', r['은행'])));
    thead.appendChild(hr);
    const tbody = document.createElement('tbody');
    [['기간', '기간'], ['발행예정금액', '발행예정금액']].forEach(([label, f]) => {
      const tr = document.createElement('tr'); tr.appendChild(mk('td', label, 'l muted'));
      rows.forEach((r) => { const td = mk('td', r[f]); if (f === '발행예정금액') td.style.fontWeight = 'var(--cds-font-weight-medium)'; tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    tbl.append(thead, tbody);
  });
  dash.draw('bank_asof', (el) => { const r = DS.rows(el, 'bank_asof'); if (r && r[0]) el.textContent = DS.date(r[0]['기준일']); });
  dash.draw('bank_msheet', (el) => { const r = DS.rows(el, 'bank_asof'); if (r && r[0]) el.textContent = r[0]['월시트']; });
  dash.draw('bank_ysheet', (el) => { const r = DS.rows(el, 'bank_asof'); if (r && r[0]) el.textContent = r[0]['연도시트']; });
  [['t', '특은'], ['s', '시은']].forEach(([k, g]) => {
    const pick = (el) => { const r = DS.rows(el, 'bank_month_group'); return r ? r.find((x) => x['구분'] === g) : null; };
    dash.draw(`bg_${k}_m`, (el) => { const r = pick(el); if (r) el.textContent = DS.f0(+r['만기도래액']); });
    dash.draw(`bg_${k}_i`, (el) => { const r = pick(el); if (r) el.textContent = DS.f0(+r['누적발행액']); });
    dash.draw(`bg_${k}_p`, (el) => { const r = pick(el); if (r) el.textContent = pct1(DS.num(r['발행진도율'])); });
  });
  dash.draw('bank_sum_rows', (tb) => {
    const rows = DS.rows(tb, 'bank_month_sum', 4); if (!rows) return;
    tb.replaceChildren();
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      if (r['은행'] === '합산') tr.className = 'sum';
      DS.td(tr, r['은행'], 'l');
      const m = DS.num(r['만기도래액']), i = DS.num(r['누적발행액']), p = DS.num(r['발행진도율']);
      DS.td(tr, m == null ? '' : DS.f0(m), m ? '' : 'muted'); DS.td(tr, i == null ? '' : DS.f0(i), i ? '' : 'muted');
      DS.td(tr, p == null ? '—' : pct1(p), p == null ? 'muted' : p >= 1 ? 'up' : '');
      tb.appendChild(tr);
    });
  });
  const bankCols = (id, skip) => (dash.data(id).columns || []).filter((c) => !skip.includes(c));
  dash.draw('bank_daily_rows', (tb) => {
    const rows = DS.rows(tb, 'bank_month_daily', 19); if (!rows) return;
    const cols = bankCols('bank_month_daily', ['일자']);
    tb.replaceChildren();
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      DS.td(tr, DS.date(r['일자']), 'l');
      cols.forEach((c) => { const v = DS.num(r[c]); const td = DS.td(tr, v ? DS.f0(v) : '·', v ? '' : 'muted'); if (c === '합산') td.style.fontWeight = 'var(--cds-font-weight-medium)'; });
      tb.appendChild(tr);
    });
  });
  dash.draw('bank_year_rows', (tb) => {
    const rows = DS.rows(tb, 'bank_year', 22); if (!rows) return;
    const cols = bankCols('bank_year', ['월', '구분']);
    tb.replaceChildren(); let prev = null;
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      const cls = []; if (r['월'] === '합산') cls.push('sum'); if (r['월'] !== prev && prev !== null) cls.push('grp'); tr.className = cls.join(' ');
      DS.td(tr, r['월'] !== prev ? r['월'] : '', 'l'); prev = r['월'];
      DS.td(tr, r['구분'], 'l');
      const net = r['구분'] === '순발행';
      cols.forEach((c) => {
        const v = DS.num(r[c]);
        const td = DS.td(tr, v == null ? '' : v === 0 ? '·' : net ? d3.format('+,.0f')(v) : DS.f0(v), v === 0 || v == null ? 'muted' : net ? DS.sgn(v) : '');
        if (c === '특은합' || c === '시은합' || c === '합산') td.style.fontWeight = 'var(--cds-font-weight-medium)';
      });
      tb.appendChild(tr);
    });
  });
  const bars = (el, cfg) => {
    if (!el.clientWidth) return;
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth), Hh = 240;
    const svg = d3.select(el).append('svg').attr('width', W).attr('height', Hh).attr('role', 'img').attr('aria-label', cfg.label);
    const vals = []; cfg.data.forEach((d) => cfg.series.forEach((s) => vals.push(d[s.key]))); if (cfg.line) cfg.data.forEach((d) => vals.push(d[cfg.line.key]));
    const y = d3.scaleLinear().domain([Math.min(0, d3.min(vals)), Math.max(0, d3.max(vals))]).nice();
    const meas = svg.append('g'); const ml = (d3.max(y.ticks(5).map((t) => meas.append('text').text(DS.f0(t)).node().getComputedTextLength())) || 30) + 10; meas.remove();
    const m = { t: 8, r: 8, b: 24, l: ml };
    const x = d3.scaleBand().domain(cfg.data.map((d) => d.cat)).range([m.l, W - m.r]).padding(0.2);
    const xi = d3.scaleBand().domain(cfg.series.map((s) => s.key)).range([0, x.bandwidth()]).padding(0.05);
    y.range([Hh - m.b, m.t]);
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(DS.f0)).call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('x', -6));
    const every = Math.ceil(cfg.data.length / Math.max(2, Math.floor((W - m.l - m.r) / 34)));
    svg.append('g').attr('transform', `translate(0,${y(0)})`).call(d3.axisBottom(x).tickSizeOuter(0).tickFormat((c, i) => (i % every === 0 ? cfg.tick(c) : ''))).call((g) => g.selectAll('text').attr('transform', `translate(0,${Hh - m.b - y(0)})`));
    cfg.data.forEach((d) => cfg.series.forEach((s) => {
      const v = d[s.key]; if (v == null) return;
      svg.append('rect').attr('x', x(d.cat) + xi(s.key)).attr('width', xi.bandwidth()).attr('y', y(Math.max(0, v))).attr('height', Math.abs(y(v) - y(0))).style('fill', dash.colors[s.c]).attr('opacity', cfg.dim && cfg.dim(d) ? 0.35 : 1);
    }));
    if (cfg.line) {
      const pts = cfg.data.filter((d) => d[cfg.line.key] != null);
      svg.append('path').datum(pts).attr('fill', 'none').attr('stroke-width', 1.5).style('stroke', 'var(--color-fg)').attr('d', d3.line().x((d) => x(d.cat) + x.bandwidth() / 2).y((d) => y(d[cfg.line.key])));
      pts.forEach((d) => svg.append('circle').attr('cx', x(d.cat) + x.bandwidth() / 2).attr('cy', y(d[cfg.line.key])).attr('r', 3).style('fill', 'var(--color-fg)'));
    }
    const tip = document.createElement('div'); tip.className = 'ds-tip'; tip.hidden = true; el.appendChild(tip);
    const show = (ev) => {
      const [px] = d3.pointer(ev, svg.node()); const step = x.step(); const idx = Math.floor((px - m.l - x.paddingOuter() * step) / step); const d = cfg.data[Math.max(0, Math.min(cfg.data.length - 1, idx))]; if (!d) return;
      tip.replaceChildren(); const b = document.createElement('b'); b.textContent = cfg.tipTitle(d.cat); tip.appendChild(b);
      [...cfg.series, ...(cfg.line ? [cfg.line] : [])].forEach((s) => { if (d[s.key] == null) return; const r = document.createElement('div'); r.textContent = `${s.label}: ${DS.f0(d[s.key])}`; tip.appendChild(r); });
      tip.hidden = false; tip.style.top = '8px'; const tx = x(d.cat) + x.bandwidth() / 2; const tw = tip.offsetWidth; tip.style.left = (tx + 12 + tw > W ? tx - 12 - tw : tx + 12) + 'px';
    };
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', Hh - m.t - m.b).attr('fill', 'transparent').on('pointermove', show).on('pointerdown', show).on('pointerleave', () => { tip.hidden = true; });
  };
  dash.draw('bank_daily_chart', (el) => {
    const s = dash.data('bank_month_daily'); if (s.status !== 'ok') return;
    const a = dash.data('bank_asof'); const asof = a.status === 'ok' && a.data[0] ? a.data[0]['기준일'] : null;
    const data = s.data.map((r) => ({ cat: r['일자'], 합산: DS.num(r['합산']) }));
    bars(el, { data, label: '당월 일별 은행채 만기도래액 합산(억원)', series: [{ key: '합산', label: '만기도래액', c: 0 }], tick: (c) => String(+c.slice(8)), tipTitle: (c) => DS.date(c) + (asof && c > asof ? ' (예정)' : ''), dim: (d) => asof && d.cat > asof });
  });
  dash.draw('bank_year_chart', (el) => {
    const s = dash.data('bank_year'); if (s.status !== 'ok') return;
    const months = []; const by = {};
    s.data.forEach((r) => { if (r['월'] === '합산') return; if (!by[r['월']]) { by[r['월']] = { cat: r['월'] }; months.push(by[r['월']]); } by[r['월']][r['구분']] = DS.num(r['합산']); });
    bars(el, { data: months, label: '월별 은행채 발행·만기·순발행 합산(억원)', series: [{ key: '발행', label: '발행', c: 0 }, { key: '만기', label: '만기', c: 1 }], line: { key: '순발행', label: '순발행' }, tick: (c) => c.replace('월', ''), tipTitle: (c) => c });
  });
})();

// 스프레드
(function () {
  const f1 = d3.format(',.1f');
  dash.draw('spread_asof', (el) => { const r = DS.rows(el, 'spread_asof'); if (r && r[0]) el.textContent = DS.date(r[0]['기준일']); });
  dash.draw('spread_band', (el) => {
    const s = dash.data('spread_tbl'); el.replaceChildren();
    if (s.status !== 'ok') { el.textContent = '불러오지 못했습니다'; return; }
    let prev = null;
    s.data.forEach((r) => {
      if (r['구분'] !== prev) { const g = document.createElement('div'); g.className = 'bd-grp'; g.textContent = r['구분']; el.appendChild(g); prev = r['구분']; }
      const cur = DS.num(r['현재']), m = DS.num(r['평균6M']), u = DS.num(r['평균+2STD']), d = DS.num(r['평균-2STD']);
      const row = document.createElement('div'); row.className = 'bd-row';
      const nm = document.createElement('span'); nm.className = 'bd-name'; nm.textContent = r['스프레드']; nm.title = r['스프레드'];
      const out = cur != null && u != null && d != null ? (cur > u ? 'up' : cur < d ? 'dn' : '') : '';
      const val = document.createElement('span'); val.className = 'bd-val ' + out; val.textContent = cur == null ? '—' : f1(cur);
      const tr = document.createElement('div'); tr.className = 'bd-track';
      if (cur != null && m != null && u != null && d != null) {
        let half = Math.max(u - m, m - d) * 1.5; half = Math.max(half, Math.abs(cur - m) * 1.08, 0.01);
        const lo = m - half; const pos = (x) => Math.max(0, Math.min(100, ((x - lo) / (2 * half)) * 100));
        const band = document.createElement('div'); band.className = 'bd-band'; band.style.left = pos(d) + '%'; band.style.width = (pos(u) - pos(d)) + '%';
        const mean = document.createElement('div'); mean.className = 'bd-mean'; mean.style.left = pos(m) + '%';
        const dot = document.createElement('div'); dot.className = 'bd-dot ' + out; dot.style.left = pos(cur) + '%';
        tr.title = `현재 ${f1(cur)} · 평균 ${f1(m)} · 밴드 ${f1(d)} ~ ${f1(u)}`;
        tr.append(band, mean, dot);
      }
      row.append(nm, val, tr); el.appendChild(row);
    });
  });
  dash.draw('spread_rows', (tb) => {
    const rows = DS.rows(tb, 'spread_tbl', 9); if (!rows) return;
    tb.replaceChildren(); let prev = null;
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      if (r['구분'] !== prev && prev !== null) tr.className = 'grp';
      DS.td(tr, r['구분'] !== prev ? r['구분'] : '', 'l'); prev = r['구분'];
      DS.td(tr, r['스프레드'], 'l');
      const cur = DS.num(r['현재']), up = DS.num(r['평균+2STD']), dn = DS.num(r['평균-2STD']);
      const out = cur != null && up != null && dn != null && (cur > up || cur < dn);
      DS.td(tr, cur == null ? '' : f1(cur), out ? 'out ' + (cur > up ? 'up' : 'dn') : '');
      DS.td(tr, DS.num(r['평균6M']) == null ? '' : f1(+r['평균6M']));
      const df = DS.num(r['대비']); DS.td(tr, df == null ? '' : d3.format('+,.1f')(df), DS.sgn(df));
      ['표준편차6M', '평균+2STD', '평균-2STD', '표준편차60D'].forEach((k) => { const v = DS.num(r[k]); DS.td(tr, v == null ? '' : f1(v), 'muted'); });
      tb.appendChild(tr);
    });
  });
  const lastOf = (sid) => { const d = dash.data('spread_ts').data || []; for (let i = d.length - 1; i >= 0; i--) if (DS.num(d[i][sid]) != null) return d[i]; return null; };
  dash.draw('spread_cur', (el) => {
    const sid = el.getAttribute('data-sid'); const last = lastOf(sid);
    if (!last) { el.textContent = '—'; return; }
    const v = +last[sid], u = DS.num(last[sid + '_u']), d = DS.num(last[sid + '_d']);
    el.textContent = f1(v);
    el.className = u != null && d != null && (v > u || v < d) ? (v > u ? 'up' : 'dn') : '';
  });
  dash.draw('spread_chart', (el) => {
    const sid = el.getAttribute('data-sid');
    const s = dash.data('spread_ts'); if (s.status !== 'ok' || !el.clientWidth) return;
    const parse = d3.utcParse('%Y-%m-%d');
    const rows = s.data.map((r) => ({ t: parse(r['일자']), v: DS.num(r[sid]), m: DS.num(r[sid + '_m']), u: DS.num(r[sid + '_u']), d: DS.num(r[sid + '_d']) })).filter((r) => r.t).sort((a, b) => a.t - b.t);
    el.replaceChildren();
    const W = Math.max(220, el.clientWidth), Hh = 160;
    const title = el.parentElement ? el.parentElement.querySelector('.ds-mini-h span') : null;
    const svg = d3.select(el).append('svg').attr('width', W).attr('height', Hh).attr('role', 'img').attr('aria-label', (title ? title.textContent : sid) + ' 스프레드 추이(bp)와 6개월 평균 ±2STD 밴드');
    const vals = []; rows.forEach((r) => ['v', 'u', 'd'].forEach((k) => { if (r[k] != null) vals.push(r[k]); }));
    const y = d3.scaleLinear().domain(d3.extent(vals)).nice();
    const meas = svg.append('g'); const ml = (d3.max(y.ticks(4).map((t) => meas.append('text').text(d3.format(',.0f')(t)).node().getComputedTextLength())) || 24) + 8; meas.remove();
    const m = { t: 6, r: 6, b: 20, l: ml };
    const x = d3.scaleUtc().domain(d3.extent(rows, (r) => r.t)).range([m.l, W - m.r]);
    y.range([Hh - m.b, m.t]);
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(d3.format(',.0f'))).call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('x', -4));
    svg.append('g').attr('transform', `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((W - m.l) / 70))).tickSizeOuter(0).tickFormat(d3.utcFormat('%y.%m')));
    const band = rows.filter((r) => r.u != null && r.d != null);
    if (band.length) svg.append('path').datum(band).attr('d', d3.area().x((r) => x(r.t)).y0((r) => y(r.d)).y1((r) => y(r.u))).style('fill', dash.colors[0]).attr('opacity', 0.12);
    if (rows.some((r) => r.m != null)) svg.append('path').datum(rows).attr('fill', 'none').attr('stroke-width', 1).attr('stroke-dasharray', '4,3').style('stroke', 'var(--color-fg-muted)').attr('d', d3.line().defined((r) => r.m != null).x((r) => x(r.t)).y((r) => y(r.m)));
    svg.append('path').datum(rows).attr('fill', 'none').attr('stroke-width', 1.6).style('stroke', dash.colors[0]).attr('d', d3.line().defined((r) => r.v != null).x((r) => x(r.t)).y((r) => y(r.v)));
    const tip = document.createElement('div'); tip.className = 'ds-tip'; tip.hidden = true; el.appendChild(tip);
    const vline = svg.append('line').attr('y1', m.t).attr('y2', Hh - m.b).style('stroke', 'var(--cds-chart-reference)').attr('opacity', 0);
    const bis = d3.bisector((r) => r.t).center;
    const show = (ev) => {
      const [px] = d3.pointer(ev, svg.node()); const r = rows[bis(rows, x.invert(px))]; if (!r) return;
      vline.attr('x1', x(r.t)).attr('x2', x(r.t)).attr('opacity', 1);
      tip.replaceChildren(); const b = document.createElement('b'); b.textContent = d3.utcFormat('%Y-%m-%d')(r.t); tip.appendChild(b);
      [['스프레드', r.v], ['6M 평균', r.m], ['+2STD', r.u], ['-2STD', r.d]].forEach(([l, v]) => { if (v == null) return; const dv = document.createElement('div'); dv.textContent = `${l}: ${f1(v)}`; tip.appendChild(dv); });
      tip.hidden = false; tip.style.top = '4px'; const tx = x(r.t); const tw = tip.offsetWidth; tip.style.left = (tx + 10 + tw > W ? tx - 10 - tw : tx + 10) + 'px';
    };
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', Hh - m.t - m.b).attr('fill', 'transparent').on('pointermove', show).on('pointerdown', show).on('pointerleave', () => { tip.hidden = true; vline.attr('opacity', 0); });
  });
  dash.draw('spread_mini', (tb) => {
    const chart = tb.nextElementSibling; const sid = chart ? chart.getAttribute('data-sid') : null;
    tb.replaceChildren(); if (!sid) return;
    const last = lastOf(sid); if (!last) return;
    const v = DS.num(last[sid]), mm = DS.num(last[sid + '_m']), u = DS.num(last[sid + '_u']), d = DS.num(last[sid + '_d']);
    const cols = [['현재', v], ['6M 평균', mm], ['+2STD', u], ['-2STD', d]].filter((c) => c[1] != null);
    const thead = document.createElement('thead'); const hr = document.createElement('tr');
    cols.forEach((c) => { const th = document.createElement('th'); th.textContent = c[0]; hr.appendChild(th); });
    thead.appendChild(hr);
    const tbody = document.createElement('tbody'); const tr = document.createElement('tr');
    cols.forEach((c, i) => {
      const td = document.createElement('td'); td.textContent = f1(c[1]);
      if (i === 0 && u != null && d != null && (v > u || v < d)) td.className = 'out ' + (v > u ? 'up' : 'dn');
      if (i > 0) td.style.color = 'var(--color-fg-muted)';
      tr.appendChild(td);
    });
    tbody.appendChild(tr); tb.append(thead, tbody);
  });
})();

// 시장 지표
(function () {
  const pick = (el) => (dash.data('market').data || []).find((r) => r['지표'] === el.getAttribute('data-name')) || null;
  dash.draw('mkt_val', (el) => {
    const r = pick(el); if (!r) { el.textContent = '—'; return; }
    const v = +r['값'], name = r['지표'];
    el.textContent = name === '코스피' ? d3.format(',.0f')(v) : (name === 'WTI' || name.startsWith('CD') || r['단위'] === '틱') ? d3.format('.2f')(v) : d3.format('.3f')(v);
  });
  dash.draw('mkt_chg', (el) => {
    const r = pick(el); if (!r) { el.textContent = '—'; return; }
    if (r['휴장'] === 'Y') { el.textContent = '휴장'; el.className = 't-chg closed'; return; }
    const c = +r['변화'], u = r['단위'];
    el.textContent = u === '틱' ? d3.format('+.0f')(c) + '틱' : u === 'bp' ? d3.format('+.1f')(c) + 'bp' : d3.format('+.2f')(c) + '%';
    el.className = 't-chg ' + (c > 0 ? 'up' : c < 0 ? 'dn' : 'flat');
  });
})();

// 핵심 요약
dash.calc('spread_out', {
  inputs: ['spread_tbl'],
  fn: (spread_tbl) => spread_tbl
    .filter((r) => r['현재'] !== '' && r['평균+2STD'] !== '' && r['평균-2STD'] !== '')
    .filter((r) => +r['현재'] > +r['평균+2STD'] || +r['현재'] < +r['평균-2STD'])
    .map((r) => ({ 스프레드: r['스프레드'], 방향: +r['현재'] > +r['평균+2STD'] ? '상단' : '하단' })),
});
dash.calc('fx_since', {
  inputs: ['ktbf_cum'],
  fn: (ktbf_cum) => {
    const start = '2026-10-06';
    const rows = ktbf_cum.filter((r) => r['일자']).slice().sort((a, b) => (a['일자'] < b['일자'] ? -1 : 1));
    const base = rows.filter((r) => r['일자'] < start).pop();
    const last = rows[rows.length - 1];
    if (!base || !last) return [];
    return [
      { 상품: 'KTBF', 순매수합계: +last['3선_누적'] - +base['3선_누적'] },
      { 상품: 'LKTBF', 순매수합계: +last['10선_누적'] - +base['10선_누적'] },
    ];
  },
});
(function () {
  const inv = (p) => (rows) => rows.find((r) => r['상품'] === p && r['투자자'] === '외국인');
  const signed = d3.format('+,.0f');
  [['kpi_k', 'KTBF', '순매수'], ['kpi_l', 'LKTBF', '순매수'], ['kpi_k_cum', 'KTBF', '누적순매수'], ['kpi_l_cum', 'LKTBF', '누적순매수']].forEach(([n, p, f]) => dash.draw(n, (el) => {
    const r = DS.rows(el, 'ktbf_inv'); if (!r) return; const x = inv(p)(r); if (!x) { el.textContent = '—'; return; }
    const v = +x[f]; el.textContent = f === '순매수' ? signed(v) : DS.f0(v); el.className = f === '순매수' ? DS.sgn(v) : '';
  }));
  [['kpi_k_since', 'KTBF'], ['kpi_l_since', 'LKTBF']].forEach(([n, p]) => dash.draw(n, (el) => {
    const x = (dash.data('fx_since').data || []).find((r) => r['상품'] === p);
    if (!x) { el.textContent = '—'; return; }
    const v = +x['순매수합계']; el.textContent = signed(v); el.className = DS.sgn(v);
  }));
  dash.draw('kpi_fx', (el) => { const r = DS.rows(el, 'fx_snap'); if (!r || !r.length) return; el.textContent = DS.f1(+r[r.length - 1]['잔고']); });
  dash.draw('kpi_dur', (el) => { const r = DS.rows(el, 'fx_bond'); if (!r || !r.length) return; let last = r[r.length - 1]; r.forEach((x) => { if (x['일자'] > last['일자']) last = x; }); el.textContent = d3.format('.2f')(+last['듀레이션']); });
  dash.draw('kpi_mmf', (el) => { const r = DS.rows(el, 'deposit'); if (!r) return; const x = r.find((y) => y['항목'] === 'MMF'); el.textContent = x ? DS.f0(+x['잔액']) : '—'; });
  dash.draw('kpi_mmf_d', (el) => { const r = DS.rows(el, 'deposit'); if (!r) return; const x = r.find((y) => y['항목'] === 'MMF'); const v = x ? DS.num(x['전일비']) : null; el.textContent = v == null ? '—' : signed(v); el.className = DS.sgn(v); });
  [['kpi_bank_t', '특은'], ['kpi_bank_s', '시은']].forEach(([n, g]) => dash.draw(n, (el) => { const r = DS.rows(el, 'bank_month_group'); if (!r) return; const x = r.find((y) => y['구분'] === g); const v = x ? DS.num(x['발행진도율']) : null; el.textContent = v == null ? '—' : d3.format('.1f')(v * 100) + '%'; }));
  dash.draw('kpi_out_n', (el) => { el.textContent = String((dash.data('spread_out').data || []).length); });
  dash.draw('kpi_out_list', (el) => {
    const list = dash.data('spread_out').data || []; el.replaceChildren();
    if (!list.length) { el.textContent = '모두 밴드 안'; return; }
    list.forEach((r, i) => {
      if (i) el.appendChild(document.createTextNode(', '));
      const sp = document.createElement('span'); sp.textContent = r['스프레드']; sp.className = r['방향'] === '상단' ? 'up' : 'dn';
      el.appendChild(sp);
    });
  });
})();

dash._start();
let _rw = window.innerWidth;
window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - _rw) < 10) return; _rw = window.innerWidth; clearTimeout(window._rt); window._rt = setTimeout(dash._charts, 200); });
