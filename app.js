(function(){
  var root = document.getElementById('root');
  var STORE = 'family-budget-v1';
  var state = null, storageOk = true, message = '';
  try { state = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { storageOk = false; }
  if (!state || !state.months) state = {version:1, debtStart:15000, months:{}};

  function uid(){ return Math.random().toString(36).slice(2, 9); }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function keyOf(dt){ return dt.getFullYear() + '-' + pad(dt.getMonth() + 1); }
  function shiftKey(k, delta){ var p = k.split('-'); return keyOf(new Date(+p[0], +p[1] - 1 + delta, 1)); }
  function labelOf(k){ var p = k.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleString('en-US', {month:'long', year:'numeric'}); }
  function todayISO(){ var t = new Date(); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); }
  function money(n){ n = Math.round(n || 0); return (n < 0 ? '−' : '') + '₪' + Math.abs(n).toLocaleString('en-US'); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function numVal(v){ v = String(v).trim(); if (v === '') return null; var n = parseFloat(v.replace(/[^\d.\-]/g, '')); return isNaN(n) ? null : Math.round(n); }
  function sum(arr, f){ return arr.reduce(function(a, x){ return a + (f(x) || 0); }, 0); }
  function valAttr(n){ return n == null ? '' : n; }

  function defaultMonth(){
    return {
      income: [{id:uid(), name:'Combined salaries', planned:24000, actual:null}],
      bills: [
        {id:uid(), name:'Mortgage', planned:8500, actual:null, paid:false},
        {id:uid(), name:'Daycare', planned:6300, actual:null, paid:false},
        {id:uid(), name:'Water & electric', planned:1000, actual:null, paid:false, note:'Estimate until the first bill arrives'},
        {id:uid(), name:'Therapy', planned:900, actual:null, paid:false, note:'Twice a month'},
        {id:uid(), name:'ארנונה', planned:750, actual:null, paid:false, note:'Billed 1,500 every two months'},
        {id:uid(), name:'Health insurance', planned:450, actual:null, paid:false},
        {id:uid(), name:'Car insurance', planned:450, actual:null, paid:false},
        {id:uid(), name:'וועד בית', planned:340, actual:null, paid:false},
        {id:uid(), name:'TV (yes)', planned:160, actual:null, paid:false, note:'Estimate'},
        {id:uid(), name:'Internet', planned:120, actual:null, paid:false},
        {id:uid(), name:'Netflix', planned:55, actual:null, paid:false},
        {id:uid(), name:'Disney+', planned:40, actual:null, paid:false}
      ],
      spending: [
        {id:uid(), name:'Groceries', planned:1000},
        {id:uid(), name:'Fuel', planned:800},
        {id:uid(), name:'Phones', planned:150},
        {id:uid(), name:'Kids & household', planned:300},
        {id:uid(), name:'Other', planned:250}
      ],
      debt: {planned:2000, paid:null},
      savings: {planned:0, paid:null},
      balance: null,
      card: {bill:null, paid:false},
      log: []
    };
  }
  function nextMonthFrom(m){
    var c = JSON.parse(JSON.stringify(m));
    c.income.forEach(function(r){ r.actual = null; });
    c.bills.forEach(function(r){ r.actual = null; r.paid = false; });
    c.debt.paid = null; c.savings.paid = null; c.balance = null; c.log = []; c.card = {bill:null, paid:false};
    return c;
  }

  var keys = function(){ return Object.keys(state.months).sort(); };
  var cur = keyOf(new Date());
  if (!keys().length) state.months[cur] = defaultMonth();
  if (!state.months[cur]) cur = keys()[keys().length - 1];

  function latestBalance(){
    var ks = keys(), b = null;
    ks.forEach(function(k){ if (k <= cur && state.months[k].balance != null) b = state.months[k].balance; });
    return b == null ? state.debtStart : b;
  }

  function touch(){
    message = '';
    state.editedAt = Date.now();
    try { localStorage.setItem(STORE, JSON.stringify(state)); storageOk = true; }
    catch (e) { storageOk = false; }
  }

  function billActual(r){ return r.paid ? (r.actual == null ? r.planned : r.actual) : 0; }
  function catSpent(m, id){ return sum(m.log.filter(function(l){ return l.cat === id; }), function(l){ return l.amount; }); }

  function render(){
    var m = state.months[cur];
    if (!m.card) m.card = {bill:null, paid:false};
    var ks = keys();
    var plannedIncome = sum(m.income, function(r){ return r.planned; });
    var plannedBills = sum(m.bills, function(r){ return r.planned; });
    var plannedSpend = sum(m.spending, function(r){ return r.planned; });
    var plannedOut = plannedBills + plannedSpend + (m.debt.planned || 0) + (m.savings.planned || 0);
    var leftPlanned = plannedIncome - plannedOut;
    var spentSoFar = sum(m.bills, billActual) + sum(m.log, function(l){ return l.amount; }) + (m.debt.paid || 0) + (m.savings.paid || 0);
    var actualIncome = sum(m.income, function(r){ return r.actual; });

    var bal = latestBalance();
    var paidOff = Math.max(0, Math.min(100, (1 - bal / state.debtStart) * 100));
    var prevKey = shiftKey(cur, -1), nextKey = shiftKey(cur, 1);
    var hasPrev = !!state.months[prevKey], hasNext = !!state.months[nextKey];

    var h = '<div class="wrap">';
    h += '<header><h1>Our monthly budget</h1><div class="monthnav">' +
      '<button class="iconbtn" data-act="prev" aria-label="Previous month" ' + (hasPrev ? '' : 'disabled') + '>‹</button>' +
      '<span class="label">' + labelOf(cur) + '</span>' +
      (hasNext ? '<button class="iconbtn" data-act="next" aria-label="Next month">›</button>'
               : '<button class="textbtn" data-act="newmonth">Start ' + labelOf(nextKey).split(' ')[0] + '</button>') +
      '</div></header>';

    h += '<div class="debt"><div class="top"><div><div class="big">' + money(bal) + '</div>' +
      '<div class="sub">' + (bal <= 0 ? 'The overdraft is cleared. Time to start saving.' : 'left on the overdraft, out of ' + money(state.debtStart)) + '</div></div>' +
      '<label>Balance at the end of ' + labelOf(cur).split(' ')[0] +
      '<input type="number" inputmode="numeric" id="bal" data-f="balance" placeholder="Enter amount" value="' + valAttr(m.balance) + '"></label></div>' +
      '<div class="bar" role="progressbar" aria-label="Overdraft paid off" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(paidOff) + '"><span style="width:' + paidOff + '%"></span></div>' +
      '<div class="ends"><span>' + Math.round(paidOff) + '% paid off</span><span>Goal: ₪0</span></div></div>';

    h += '<div class="summary">' +
      '<div><small>Income planned</small><b>' + money(plannedIncome) + '</b></div>' +
      '<div><small>Spending planned</small><b>' + money(plannedOut) + '</b></div>' +
      '<div><small>Left over planned</small><b class="' + (leftPlanned < 0 ? 'neg' : 'pos') + '">' + money(leftPlanned) + '</b></div>' +
      '<div><small>Spent so far</small><b>' + money(spentSoFar) + '</b></div></div>';

    // Income
    h += '<section><div class="sechead"><h2>Income</h2><p>Fill in “Actual” when pay arrives</p></div>' +
      '<div class="row noncheck head"><span>Source</span><span class="num">Planned</span><span class="num">Actual</span><span></span></div>';
    m.income.forEach(function(r){
      h += '<div class="row noncheck">' +
        '<input type="text" id="income-' + r.id + '-name" data-f="row" data-list="income" data-id="' + r.id + '" data-k="name" value="' + esc(r.name) + '" aria-label="Income source">' +
        '<input type="number" inputmode="numeric" id="income-' + r.id + '-planned" data-f="row" data-list="income" data-id="' + r.id + '" data-k="planned" value="' + valAttr(r.planned) + '" aria-label="Planned">' +
        '<input type="number" inputmode="numeric" id="income-' + r.id + '-actual" data-f="row" data-list="income" data-id="' + r.id + '" data-k="actual" value="' + valAttr(r.actual) + '" aria-label="Actual">' +
        '<button class="del" data-act="delrow" data-list="income" data-id="' + r.id + '" aria-label="Remove ' + esc(r.name) + '">×</button></div>';
    });
    h += '<div class="foot"><button class="textbtn" data-act="addrow" data-list="income">Add income</button><span>' + money(actualIncome) + ' received</span></div></section>';

    // Bills
    var billsPaid = m.bills.filter(function(r){ return r.paid; }).length;
    h += '<section><div class="sechead"><h2>Fixed bills</h2><p>' + billsPaid + ' of ' + m.bills.length + ' paid</p></div>' +
      '<div class="row head"><span></span><span>Bill</span><span class="num">Planned</span><span class="num">Paid</span><span></span></div>';
    m.bills.forEach(function(r){
      h += '<div class="row">' +
        '<input type="checkbox" id="bills-' + r.id + '-paid" data-f="row" data-list="bills" data-id="' + r.id + '" data-k="paid" ' + (r.paid ? 'checked' : '') + ' aria-label="Mark ' + esc(r.name) + ' paid">' +
        '<div><input type="text" id="bills-' + r.id + '-name" data-f="row" data-list="bills" data-id="' + r.id + '" data-k="name" value="' + esc(r.name) + '" aria-label="Bill name">' +
        (r.note ? '<span class="note">' + esc(r.note) + '</span>' : '') +
        '<label class="oncard"><input type="checkbox" id="bills-' + r.id + '-card" data-f="row" data-list="bills" data-id="' + r.id + '" data-k="card" ' + (r.card ? 'checked' : '') + '>Charged to credit card</label></div>' +
        '<input type="number" inputmode="numeric" id="bills-' + r.id + '-planned" data-f="row" data-list="bills" data-id="' + r.id + '" data-k="planned" value="' + valAttr(r.planned) + '" aria-label="Planned">' +
        '<input type="number" inputmode="numeric" id="bills-' + r.id + '-actual" data-f="row" data-list="bills" data-id="' + r.id + '" data-k="actual" value="' + (r.paid ? valAttr(r.actual == null ? r.planned : r.actual) : valAttr(r.actual)) + '" placeholder="—" aria-label="Amount paid">' +
        '<button class="del" data-act="delrow" data-list="bills" data-id="' + r.id + '" aria-label="Remove ' + esc(r.name) + '">×</button></div>';
    });
    h += '<div class="foot"><button class="textbtn" data-act="addrow" data-list="bills">Add bill</button><span>' + money(sum(m.bills, billActual)) + ' of ' + money(plannedBills) + '</span></div></section>';

    // Everyday spending
    h += '<section><div class="sechead"><h2>Everyday spending</h2><p>Log each purchase to see what’s left</p></div>';
    m.spending.forEach(function(r){
      var spent = catSpent(m, r.id), plan = r.planned || 0;
      var pct = plan > 0 ? Math.min(100, spent / plan * 100) : (spent > 0 ? 100 : 0);
      var cls = spent > plan ? 'over' : (pct >= 80 ? 'warn' : '');
      var left = plan - spent;
      h += '<div class="cat"><div class="line1">' +
        '<input type="text" id="spending-' + r.id + '-name" data-f="row" data-list="spending" data-id="' + r.id + '" data-k="name" value="' + esc(r.name) + '" aria-label="Category name">' +
        '<input type="number" inputmode="numeric" id="spending-' + r.id + '-planned" data-f="row" data-list="spending" data-id="' + r.id + '" data-k="planned" value="' + valAttr(r.planned) + '" aria-label="Budget for ' + esc(r.name) + '">' +
        '<button class="del" data-act="delrow" data-list="spending" data-id="' + r.id + '" aria-label="Remove ' + esc(r.name) + '">×</button></div>' +
        '<div class="meter"><span class="' + cls + '" style="width:' + pct + '%"></span></div>' +
        '<div class="line2"><span>' + money(spent) + ' spent</span><span class="' + (left < 0 ? 'over' : '') + '">' + (left < 0 ? money(-left) + ' over' : money(left) + ' left') + '</span></div></div>';
    });
    h += '<div class="foot"><button class="textbtn" data-act="addrow" data-list="spending">Add category</button><span>' + money(sum(m.log, function(l){ return l.amount; })) + ' of ' + money(plannedSpend) + '</span></div>';

    h += '<div class="quick">' +
      '<label>Category<select id="q-cat">' + m.spending.map(function(r){ return '<option value="' + r.id + '">' + esc(r.name) + '</option>'; }).join('') + '</select></label>' +
      '<label>Amount<input type="number" inputmode="decimal" id="q-amt" placeholder="₪"></label>' +
      '<label class="wide">Note<input type="text" id="q-note" placeholder="Shufersal, fuel, etc."></label>' +
      '<label>Date<input type="date" id="q-date" value="' + todayISO() + '"></label>' +
      '<label>Paid with<select id="q-method"><option value="bank">Bank / cash</option><option value="card">Credit card</option></select></label>' +
      '<button class="primary" data-act="addlog">Add</button></div>';

    var log = m.log.slice().sort(function(a, b){ return a.date < b.date ? 1 : -1; });
    if (!log.length) h += '<p class="empty">No purchases logged yet. Add the first one above.</p>';
    else {
      h += '<ul class="log">';
      log.forEach(function(l){
        var c = m.spending.filter(function(s){ return s.id === l.cat; })[0];
        var dd = l.date ? new Date(l.date + 'T00:00:00').toLocaleString('en-US', {day:'numeric', month:'short'}) : '';
        h += '<li><span class="d">' + dd + '</span><span>' + (l.note ? esc(l.note) + ' ' : '') + '<span class="c">' + esc(c ? c.name : 'Removed category') + '</span>' + (l.method === 'card' ? '<span class="tag">Card</span>' : '') + '</span>' +
          '<span class="num">' + money(l.amount) + '</span><button class="del" data-act="dellog" data-id="' + l.id + '" aria-label="Remove purchase">×</button></li>';
      });
      h += '</ul>';
    }
    h += '</section>';

    // Credit card
    var cardBuys = sum(m.log.filter(function(l){ return l.method === 'card'; }), function(l){ return l.amount; });
    var cardBills = sum(m.bills.filter(function(r){ return r.card; }), function(r){ return r.paid ? billActual(r) : r.planned; });
    var expected = cardBuys + cardBills;
    h += '<section><div class="sechead"><h2>Credit card</h2><p>Already counted in your spending above</p></div>' +
      '<div class="cardgrid"><span>Purchases logged on the card</span><span>' + money(cardBuys) + '</span>' +
      '<span>Bills charged to the card</span><span>' + money(cardBills) + '</span>' +
      '<span class="total">Expected card bill</span><span class="total">' + money(expected) + '</span></div>' +
      '<div class="cardbill"><label>Actual card bill <input type="number" inputmode="numeric" id="card-bill" data-f="card" data-k="bill" value="' + valAttr(m.card.bill) + '" placeholder="From statement"></label>' +
      '<label class="chk"><input type="checkbox" id="card-paid" data-f="card" data-k="paid" ' + (m.card.paid ? 'checked' : '') + '>Bill paid</label></div>';
    if (m.card.bill != null) {
      var diff = m.card.bill - expected;
      h += '<p class="diff' + (Math.abs(diff) >= 1 ? ' warn' : '') + '">' + (Math.abs(diff) < 1 ? 'The statement matches what you logged.' : diff > 0 ? money(diff) + ' on the statement isn’t logged here yet. Check for missing purchases.' : 'The statement is ' + money(-diff) + ' less than what you logged.') + '</p>';
    }
    h += '</section>';

    // Debt & savings
    h += '<section><div class="sechead"><h2>Debt and savings</h2><p>Savings starts once the overdraft is gone</p></div>' +
      '<div class="row noncheck head"><span></span><span class="num">Planned</span><span class="num">Done</span><span></span></div>' +
      '<div class="row noncheck"><span>Overdraft payment</span>' +
      '<input type="number" inputmode="numeric" id="debt-planned" data-f="debt" data-k="planned" value="' + valAttr(m.debt.planned) + '" aria-label="Planned overdraft payment">' +
      '<input type="number" inputmode="numeric" id="debt-paid" data-f="debt" data-k="paid" value="' + valAttr(m.debt.paid) + '" placeholder="—" aria-label="Overdraft payment made"><span></span></div>' +
      '<div class="row noncheck"><span>Savings</span>' +
      '<input type="number" inputmode="numeric" id="savings-planned" data-f="savings" data-k="planned" value="' + valAttr(m.savings.planned) + '" aria-label="Planned savings">' +
      '<input type="number" inputmode="numeric" id="savings-paid" data-f="savings" data-k="paid" value="' + valAttr(m.savings.paid) + '" placeholder="—" aria-label="Savings made"><span></span></div>' +
      '<div class="foot"><span>Starting overdraft</span><input type="number" inputmode="numeric" id="debtstart" data-f="debtstart" value="' + valAttr(state.debtStart) + '" style="width:7.5em" aria-label="Starting overdraft"></div></section>';

    h += '</div><div class="savebar"><div class="in" id="savebar"></div></div>';
    root.innerHTML = h;
    renderBar();
  }

  function renderBar(){
    var el = document.getElementById('savebar');
    if (!el) return;
    var txt = message || (storageOk ? 'Changes save automatically in this browser' : 'This browser is blocking storage, so changes will be lost when you close the page');
    el.innerHTML = '<span class="msg' + (message || !storageOk ? ' strong' : '') + '">' + esc(txt) + '</span>' +
      '<span class="barbtns"><button class="textbtn" data-act="export">Download backup</button>' +
      '<button class="textbtn" data-act="import">Restore backup</button></span>';
  }

  function rerender(){
    setTimeout(function(){
      var a = document.activeElement, id = a && a.id;
      render();
      if (id) { var n = document.getElementById(id); if (n) n.focus(); }
    }, 0);
  }

  root.addEventListener('change', function(e){
    var t = e.target, f = t.dataset.f; if (!f) return;
    var m = state.months[cur];
    if (f === 'row') {
      var r = m[t.dataset.list].filter(function(x){ return x.id === t.dataset.id; })[0]; if (!r) return;
      var k = t.dataset.k;
      if (k === 'name') r.name = t.value;
      else if (k === 'card') r.card = t.checked;
      else if (k === 'paid') { r.paid = t.checked; if (t.checked && r.actual == null) r.actual = r.planned; }
      else { r[k] = numVal(t.value); if (t.dataset.list === 'bills' && k === 'actual') r.paid = r.actual != null; }
    } else if (f === 'debt' || f === 'savings') m[f][t.dataset.k] = numVal(t.value);
    else if (f === 'balance') m.balance = numVal(t.value);
    else if (f === 'card') { if (!m.card) m.card = {bill:null, paid:false}; if (t.dataset.k === 'paid') m.card.paid = t.checked; else m.card.bill = numVal(t.value); }
    else if (f === 'debtstart') { var v = numVal(t.value); if (v && v > 0) state.debtStart = v; }
    touch(); rerender();
  });

  root.addEventListener('click', function(e){
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.dataset.act, m = state.months[cur];
    if (act === 'prev') { cur = shiftKey(cur, -1); render(); }
    else if (act === 'next') { cur = shiftKey(cur, 1); render(); }
    else if (act === 'newmonth') { var nk = shiftKey(cur, 1); state.months[nk] = nextMonthFrom(m); cur = nk; touch(); render(); }
    else if (act === 'addrow') {
      var list = b.dataset.list, row = {id:uid(), name:'', planned:null};
      if (list === 'income') row.actual = null;
      if (list === 'bills') { row.actual = null; row.paid = false; }
      m[list].push(row); touch(); render();
      var n = document.getElementById(list + '-' + row.id + '-name'); if (n) n.focus();
    }
    else if (act === 'delrow') {
      var lst = m[b.dataset.list], it = lst.filter(function(x){ return x.id === b.dataset.id; })[0];
      if (it && confirm('Remove “' + (it.name || 'this row') + '” from ' + labelOf(cur) + '?')) {
        m[b.dataset.list] = lst.filter(function(x){ return x.id !== b.dataset.id; }); touch(); render();
      }
    }
    else if (act === 'addlog') {
      var amt = numVal(document.getElementById('q-amt').value);
      var cat = document.getElementById('q-cat').value;
      if (!amt || !cat) { document.getElementById('q-amt').focus(); return; }
      var method = document.getElementById('q-method').value;
      m.log.push({id:uid(), cat:cat, amount:amt, note:document.getElementById('q-note').value.trim(), date:document.getElementById('q-date').value || todayISO(), method:method});
      touch(); render();
      var sel = document.getElementById('q-cat'); if (sel) sel.value = cat;
      var qm = document.getElementById('q-method'); if (qm) qm.value = method;
      var qa = document.getElementById('q-amt'); if (qa) qa.focus();
    }
    else if (act === 'dellog') { m.log = m.log.filter(function(l){ return l.id !== b.dataset.id; }); touch(); render(); }
    else if (act === 'export') exportBackup();
    else if (act === 'import') fileInput.click();
  });

  root.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && (e.target.id === 'q-amt' || e.target.id === 'q-note')) {
      e.preventDefault(); var b = root.querySelector('[data-act="addlog"]'); if (b) b.click();
    }
  });

  function exportBackup(){
    var blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'budget-backup-' + todayISO() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    message = 'Backup downloaded'; renderBar();
  }

  var fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'application/json,.json'; fileInput.hidden = true;
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', function(){
    var f = fileInput.files && fileInput.files[0]; if (!f) return;
    var reader = new FileReader();
    reader.onload = function(){
      try {
        var data = JSON.parse(reader.result);
        if (!data || !data.months || typeof data.months !== 'object') throw new Error('bad');
        if (!confirm('Replace everything in this tracker with the backup from ' + f.name + '?')) return;
        state = data;
        var ks = keys(); cur = state.months[keyOf(new Date())] ? keyOf(new Date()) : ks[ks.length - 1];
        if (!cur) { cur = keyOf(new Date()); state.months[cur] = defaultMonth(); }
        touch(); message = 'Backup restored'; render();
      } catch (e) { message = 'That file isn’t a budget backup. Choose a file made with Download backup.'; renderBar(); }
      fileInput.value = '';
    };
    reader.readAsText(f);
  });

  render();
})();
