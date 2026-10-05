/* Fina's board. Plain script, no framework. Everything here enhances HTML that already reads without it.
   Dish data lives in the HTML ([data-dish] elements); the bag carries names so checkout needs no second list. */
(function () {
  'use strict';
  var D = document;
  D.documentElement.classList.remove('no-js');
  D.documentElement.classList.add('js');

  /* ---------- Sample prices (labeled sample on every page) ---------- */
  var PRICES = { classic: { 4: 13.95, 8: 16.95 }, lean: { 4: 14.45, 8: 17.45 } };
  var LADDER = [{ at: 5, off: 0.5 }, { at: 10, off: 1.0 }, { at: 15, off: 1.5 }];
  var FREE_DELIVERY_AT = 15;
  var SAUCE_PRICE = 0.75;
  var FREE_SAUCES = { per: 5, n: 2 };
  var BUNDLES = {
    'weekday-five': { name: 'Weekday Five', ids: ['cowboy-chicken', 'chipotle-chicken-pasta', 'black-garlic-citrus-steak', 'chimichurri-fish', 'greek-chicken'] },
    'family-ten': { name: 'Family Ten', ids: ['cowboy-chicken', 'cowboy-chicken', 'hawaiian-jalapeno-beef', 'hawaiian-jalapeno-beef', 'honey-teriyaki-chicken', 'honey-teriyaki-chicken', 'whole-shabang-shrimp', 'whole-shabang-shrimp', 'korean-beef', 'korean-beef'] }
  };

  function discountFor(count) {
    var off = 0, i;
    for (i = 0; i < LADDER.length; i++) if (count >= LADDER[i].at) off = LADDER[i].off;
    return off;
  }
  function unitPrice(style, size, count) { return PRICES[style][size] - discountFor(count); }
  function money(x) { return '$' + (Math.round(x * 100) / 100).toFixed(2); }

  /* ---------- Dishes from the page ---------- */
  function $(sel, root) { return (root || D).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || D).querySelectorAll(sel)); }
  function text(el, t) { if (el) el.textContent = t; }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  var DISHES = $$('[data-dish]').map(function (el) {
    return { id: el.getAttribute('data-id'), name: el.getAttribute('data-name'), kind: el.getAttribute('data-kind'),
      al: (el.getAttribute('data-al') || '').split(',').filter(Boolean), spicy: el.getAttribute('data-spicy') === '1', macros: null, el: el };
  });
  function dish(id) { for (var i = 0; i < DISHES.length; i++) if (DISHES[i].id === id) return DISHES[i]; return null; }
  var SAUCES = $$('.sauce[data-id]').map(function (el) { return { id: el.getAttribute('data-id'), name: el.getAttribute('data-name') }; });
  function sauce(id) { for (var i = 0; i < SAUCES.length; i++) if (SAUCES[i].id === id) return SAUCES[i]; return null; }

  /* ---------- Clock: America/Los_Angeles, Friday drop, Thursday 11:59 PM close, Sunday fulfillment ---------- */
  var TZ = 'America/Los_Angeles';
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function laParts(date) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    var o = {}, parts = f.formatToParts(date), i;
    for (i = 0; i < parts.length; i++) o[parts[i].type] = parts[i].value;
    return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second, dow: DOW.indexOf(o.weekday) };
  }
  function laOffsetMs(date) {
    var p = laParts(date);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
  }
  /* Wall clock in LA to an epoch; offset taken at the target instant, two passes to cross DST edges. */
  function laWallToEpoch(y, m, d, h, mi, s) {
    var wall = Date.UTC(y, m - 1, d, h, mi, s);
    var guess = wall - laOffsetMs(new Date(wall));
    guess = wall - laOffsetMs(new Date(guess));
    return guess;
  }
  function cycle(now) {
    var p = laParts(now), toThu = (4 - p.dow + 7) % 7;
    var base = Date.UTC(p.y, p.m - 1, p.d) + toThu * 864e5, cd = new Date(base);
    var close = laWallToEpoch(cd.getUTCFullYear(), cd.getUTCMonth() + 1, cd.getUTCDate(), 23, 59, 59);
    if (close < now.getTime()) {
      base += 7 * 864e5; cd = new Date(base);
      close = laWallToEpoch(cd.getUTCFullYear(), cd.getUTCMonth() + 1, cd.getUTCDate(), 23, 59, 59);
    }
    var sd = new Date(base + 3 * 864e5);
    var sun = { y: sd.getUTCFullYear(), m: sd.getUTCMonth() + 1, d: sd.getUTCDate() };
    var fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });
    var fmtShort = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' });
    return {
      close: close,
      sunday: sun,
      sundayLong: fmt.format(sd),
      sundayShort: fmtShort.format(sd),
      thursdayShort: fmtShort.format(new Date(base)),
      pickupStart: laWallToEpoch(sun.y, sun.m, sun.d, 17, 30, 0),
      pickupEnd: laWallToEpoch(sun.y, sun.m, sun.d, 20, 30, 0),
      deliveryEnd: laWallToEpoch(sun.y, sun.m, sun.d, 21, 0, 0),
      notThisWeekend: (p.dow === 5 || p.dow === 6 || p.dow === 0),
      isoDate: sun.y + '-' + pad2(sun.m) + '-' + pad2(sun.d)
    };
  }
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countdownText(ms) {
    if (ms <= 0) return 'closed, the next board opens Friday';
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), mi = Math.floor((s % 3600) / 60), sec = s % 60;
    var out = [];
    if (d) out.push(d + (d === 1 ? ' day' : ' days'));
    out.push(h + ' hr');
    out.push(mi + ' min');
    if (!REDUCED) out.push(pad2(sec) + ' s');
    return 'in ' + out.join(' ');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function icsStamp(epoch) {
    var d = new Date(epoch);
    return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + 'T' + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + 'Z';
  }
  function icsHref(cy, mode, slot, number) {
    var start = cy.pickupStart, end = mode === 'delivery' ? cy.deliveryEnd : cy.pickupEnd;
    if (mode === 'pickup' && slot) {
      var hm = slot.split(':');
      start = laWallToEpoch(cy.sunday.y, cy.sunday.m, cy.sunday.d, +hm[0], +hm[1], 0);
      end = start + 30 * 60000;
    }
    var title = mode === 'delivery' ? "Fina's delivery window (preview)" : "Fina's pickup in Downey (preview)";
    var desc = 'Sample order preview. ' + (number ? 'Confirmation ' + number + '. ' : '') + (mode === 'delivery' ? 'Delivery arrives Sunday between 5:30 and 9:00 PM (sample window).' : 'Pickup in Downey, Sunday between 5:30 and 8:30 PM (sample window); address coming from Fina.') + ' Cancel before Thursday 11:59 PM.';
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:Finas preview board', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + (number || 'finas') + '-' + cy.isoDate + '@finas.preview', 'DTSTAMP:' + icsStamp(Date.now()), 'DTSTART:' + icsStamp(start), 'DTEND:' + icsStamp(end),
      'SUMMARY:' + title, 'DESCRIPTION:' + desc, 'END:VEVENT', 'END:VCALENDAR'];
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
  }

  /* ---------- ZIP bands (sample table) ---------- */
  var OC_906 = ['90620', '90621', '90623', '90630', '90631', '90680', '90720', '90740'];
  function zipBand(z) {
    z = String(z || '').trim();
    if (!/^\d{5}$/.test(z)) return null;
    var p3 = z.slice(0, 3);
    if (p3 === '908' || p3 === '902') return { fee: 4, label: 'Downey, Bell Gardens and Long Beach area' };
    if (OC_906.indexOf(z) >= 0 || p3 === '926' || p3 === '927' || p3 === '928') return { fee: 9, label: 'Orange County' };
    if (/^9(0\d|1[0-8])$/.test(p3)) return { fee: 7, label: 'wider Los Angeles' };
    return { fee: null, label: 'outside the delivery area' };
  }
  function zipAnswer(z, count) {
    var b = zipBand(z);
    if (!b) return 'Enter a five digit ZIP.';
    if (b.fee === null) return z + ' is outside the Sunday delivery area. Pickup only, in Downey.';
    if (count >= FREE_DELIVERY_AT) return 'We deliver to ' + z + ' on Sunday. Delivery is free at ' + FREE_DELIVERY_AT + ' meals.';
    return 'We deliver to ' + z + ' on Sunday, ' + money(b.fee) + ' (' + b.label + ', sample fee).';
  }

  /* ---------- State ---------- */
  var KEY = 'finas.state.v2', KEY_USUAL = 'finas.usual.v2', KEY_LAST = 'finas.lastOrder.v2';
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage may be blocked; the page still works */ } }
  var S = load(KEY) || {};
  S.size = S.size === 8 ? 8 : 4;
  S.style = S.style === 'lean' ? 'lean' : 'classic';
  S.bag = S.bag || {};        /* id: {q, name, kind} */
  S.sauces = S.sauces || {};  /* id: {q, name} */
  S.zip = S.zip || '';
  S.mode = S.mode || '';
  S.slot = S.slot || '';
  function persist() { save(KEY, S); }
  function bagCount() { var n = 0, k; for (k in S.bag) n += S.bag[k].q; return n; }
  function sauceCount() { var n = 0, k; for (k in S.sauces) n += S.sauces[k].q; return n; }
  function calc() {
    var count = bagCount(), unit = unitPrice(S.style, S.size, count), off = discountFor(count);
    var sub = count * unit, freeS = Math.floor(count / FREE_SAUCES.per) * FREE_SAUCES.n, sc = sauceCount();
    var paidS = Math.max(0, sc - freeS), sauceTotal = paidS * SAUCE_PRICE;
    var band = zipBand(S.zip), fee = 0, feeLabel = 'By ZIP';
    if (S.mode === 'pickup') { fee = 0; feeLabel = 'Pickup, no fee'; }
    else if (count >= FREE_DELIVERY_AT && band && band.fee !== null) { fee = 0; feeLabel = 'Free at ' + FREE_DELIVERY_AT; }
    else if (band && band.fee !== null) { fee = band.fee; feeLabel = money(band.fee); }
    else if (band && band.fee === null) { fee = 0; feeLabel = 'Pickup only'; }
    return { count: count, unit: unit, off: off, saved: off * count, sub: sub, freeS: freeS, sc: sc, paidS: paidS, sauceTotal: sauceTotal, fee: fee, feeLabel: feeLabel, total: sub + sauceTotal + fee, band: band };
  }
  function nextBreak(count) {
    for (var i = 0; i < LADDER.length; i++) if (count < LADDER[i].at) return LADDER[i];
    return null;
  }
  var liveEl = $('#live');
  function announce(t) { if (liveEl) { liveEl.textContent = ''; setTimeout(function () { liveEl.textContent = t; }, 30); } }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  /* ---------- Shared: clock strip on any page ---------- */
  var CY = cycle(new Date());
  function renderClock() {
    CY = cycle(new Date());
    $$('[data-sunday]').forEach(function (el) { el.textContent = CY.sundayLong; });
    $$('[data-sunday-short]').forEach(function (el) { el.textContent = CY.sundayShort; });
    $$('[data-thursday]').forEach(function (el) { el.textContent = CY.thursdayShort; });
    $$('[data-countdown]').forEach(function (el) { el.textContent = countdownText(CY.close - Date.now()); });
    $$('[data-not-this-weekend]').forEach(function (el) { el.hidden = !CY.notThisWeekend; });
  }
  renderClock();
  setInterval(renderClock, REDUCED ? 60000 : 1000);

  /* Hero video obeys reduced motion; a missing file leaves the poster or the color block */
  $$('video[autoplay]').forEach(function (v) {
    if (REDUCED) { v.removeAttribute('autoplay'); v.pause(); }
    on(v, 'error', function () { v.hidden = true; });
    var src = v.querySelector('source');
    on(src, 'error', function () { if (!v.getAttribute('poster')) v.hidden = true; });
  });

  var page = D.body.getAttribute('data-page');

  /* ---------- Tape (board and checkout) ---------- */
  function renderTapeInto(root) {
    var c = calc(), lines = $('.lines', root), html = '', q, k;
    if (!lines) return c;
    for (k in S.bag) {
      q = S.bag[k].q; if (!q) continue;
      html += '<li data-key="' + esc(k) + '"><span class="q">' + q + '</span><span class="n">' + esc(S.bag[k].name) + '<small>' + S.size + ' oz ' + (S.style === 'lean' ? 'Lean' : 'Classic') + ', ' + money(c.unit) + ' each</small></span><span class="a">' + money(q * c.unit) + '</span></li>';
    }
    for (k in S.sauces) {
      q = S.sauces[k].q; if (!q) continue;
      html += '<li data-key="s:' + esc(k) + '"><span class="q">' + q + '</span><span class="n">' + esc(S.sauces[k].name) + '<small>sauce</small></span><span class="a"></span></li>';
    }
    if (c.sc) {
      html += '<li data-key="sauce-total" class="free"><span class="q"></span><span class="n">' + Math.min(c.sc, c.freeS) + ' of ' + c.freeS + ' free sauces used' + (c.paidS ? ', ' + c.paidS + ' extra at ' + money(SAUCE_PRICE) : '') + '</span><span class="a">' + (c.paidS ? money(c.sauceTotal) : 'Free') + '</span></li>';
    }
    if (!html) html = '<li class="empty"><strong>The tape is blank.</strong> Tap + on any dish and it prints here. Five meals is where every price first drops.</li>';
    var prev = {};
    $$('li', lines).forEach(function (li) { prev[li.getAttribute('data-key')] = li.textContent; });
    lines.innerHTML = html;
    $$('li', lines).forEach(function (li) {
      var key = li.getAttribute('data-key');
      if (key && prev[key] !== li.textContent) li.classList.add('print');
    });
    var fill = $('.therm .fill', root);
    if (fill) fill.style.width = (Math.min(c.count, 15) / 15 * 100) + '%';
    var nb = nextBreak(c.count), nextEl = $('.ladder .next', root), savedEl = $('.ladder .saved', root);
    if (nextEl) {
      if (c.count === 0) nextEl.innerHTML = 'Every meal is <strong>' + money(c.unit) + '</strong>. At 5 meals each one drops 50 cents, at 10 a dollar, at 15 a dollar fifty and delivery is free.';
      else if (nb) nextEl.innerHTML = '<strong>' + (nb.at - c.count) + ' more ' + (nb.at - c.count === 1 ? 'meal' : 'meals') + '</strong> and every meal drops to <strong>' + money(PRICES[S.style][S.size] - nb.off) + '</strong>' + (nb.at === FREE_DELIVERY_AT ? ', with free delivery' : '') + '.';
      else nextEl.innerHTML = 'Top of the ladder: every meal is <strong>' + money(c.unit) + '</strong> and delivery is free.';
    }
    if (savedEl) savedEl.textContent = c.saved > 0 ? 'You save ' + money(c.saved) + ' at ' + c.count + ' meals' : 'No ladder savings yet';
    text($('[data-sub]', root), money(c.sub + c.sauceTotal));
    text($('[data-fee]', root), c.feeLabel);
    text($('[data-total]', root), money(c.total));
    text($('[data-count]', root), c.count + (c.count === 1 ? ' meal' : ' meals'));
    return c;
  }

  function renderTiles() {
    var c = calc();
    $$('.tile[data-id]').forEach(function (t) {
      var id = t.getAttribute('data-id'), q = S.bag[id] ? S.bag[id].q : 0;
      t.setAttribute('data-qty', q);
      text($('.qty', t), q);
      text($('.price', t), money(c.unit));
    });
    $$('.sauce[data-id]').forEach(function (t) {
      var id = t.getAttribute('data-id'), q = S.sauces[id] ? S.sauces[id].q : 0;
      t.setAttribute('data-qty', q);
      text($('.qty', t), q);
    });
    $$('.price-grid .v').forEach(function (v) {
      v.setAttribute('data-active', String(v.getAttribute('data-style') === S.style && +v.getAttribute('data-size') === S.size));
    });
    $$('.seg [data-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-size') === S.size)); });
    $$('.seg [data-style]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-style') === S.style)); });
    var pl = $('.price-line');
    if (pl) pl.innerHTML = (S.style === 'lean' ? 'Lean' : 'Classic') + ' ' + S.size + ' oz: <strong>' + money(PRICES[S.style][S.size]) + '</strong> a meal. Five or more ' + money(PRICES[S.style][S.size] - 0.5) + ', ten ' + money(PRICES[S.style][S.size] - 1) + ', fifteen ' + money(PRICES[S.style][S.size] - 1.5) + ' with free delivery.';
  }

  function renderTally(c) {
    text($('.tally .meals'), c.count + (c.count === 1 ? ' meal' : ' meals'));
    text($('.tally .amt'), money(c.total));
    $$('[data-act="load-usual"]').forEach(function (b) { b.setAttribute('aria-disabled', String(!load(KEY_USUAL))); });
    $$('[data-act="repeat"]').forEach(function (b) { b.setAttribute('aria-disabled', String(!load(KEY_LAST))); });
  }

  function renderBoard(reason) {
    renderTiles();
    var c = renderTapeInto($('.tape'));
    renderTally(c);
    var za = $('.zip-answer');
    if (za && S.zip) za.textContent = zipAnswer(S.zip, c.count);
    persist();
    if (reason) announce(reason + '. ' + c.count + (c.count === 1 ? ' meal' : ' meals') + ', ' + money(c.total) + '.');
  }

  function setQty(id, q) {
    var d = dish(id); if (!d) return;
    var was = S.bag[id] ? S.bag[id].q : 0;
    q = Math.max(0, Math.min(40, q));
    if (q) S.bag[id] = { q: q, name: d.name, kind: d.kind }; else delete S.bag[id];
    renderBoard((q > was ? 'Added ' : 'Removed ') + d.name);
    var qty = $('.tile[data-id="' + id + '"] .qty');
    if (qty) { qty.classList.remove('stamp'); void qty.offsetWidth; qty.classList.add('stamp'); }
  }

  function loadBag(bag, label) {
    S.bag = {};
    var k;
    for (k in bag) { var d = dish(k); if (d && bag[k].q > 0) S.bag[k] = { q: bag[k].q, name: d.name, kind: d.kind }; }
    renderBoard(label + ' loaded');
  }

  function planWeek(form) {
    var rule = function (n) { var el = form.querySelector('[name="' + n + '"]'); return !!(el && el.checked && !el.disabled); };
    var noShell = rule('no-shellfish'), noFish = rule('no-fish'), noDairy = rule('no-dairy'), noWheat = rule('no-wheat'), mild = rule('mild');
    var under = rule('under-500'), hiPro = rule('high-protein');
    var n = +form.querySelector('[name="plan-count"]').value || 5, note = $('.plan-note', form);
    var cands = DISHES.filter(function (d) {
      if (!d.el.classList.contains('tile')) return false;
      if (noShell && d.al.indexOf('shellfish') >= 0) return false;
      if (noFish && d.al.indexOf('fish') >= 0) return false;
      if (noDairy && d.al.indexOf('dairy') >= 0) return false;
      if (noWheat && d.al.indexOf('wheat') >= 0) return false;
      if (mild && d.spicy) return false;
      if (under && d.macros && d.macros.cal >= 500) return false;   /* ready for Fina's macros */
      return true;
    });
    if (hiPro) cands = cands.slice().sort(function (a, b) { return ((b.macros && b.macros.p) || 0) - ((a.macros && a.macros.p) || 0); });
    if (!cands.length) { text(note, 'No dish on this board fits those rules. Loosen one.'); return; }
    var top = cands.slice(0, Math.min(5, cands.length)), bag = {}, i;
    for (i = 0; i < n; i++) { var id = top[i % top.length].id; bag[id] = { q: (bag[id] ? bag[id].q : 0) + 1 }; }
    loadBag(bag, 'Plan');
    text(note, n + ' meals across ' + top.length + ' dishes: ' + top.map(function (d) { return d.name; }).join(', ') + '.');
  }

  if (page === 'board') {
    D.body.classList.add('has-tally');
    on(D, 'click', function (e) {
      var b = e.target.closest('button, a');
      if (!b) return;
      var act = b.getAttribute('data-act'), id;
      if (b.classList.contains('plus') || b.classList.contains('minus')) {
        var host = b.closest('[data-id]'); id = host.getAttribute('data-id');
        var delta = b.classList.contains('plus') ? 1 : -1;
        if (host.classList.contains('sauce')) {
          var q = Math.max(0, (S.sauces[id] ? S.sauces[id].q : 0) + delta);
          if (q) S.sauces[id] = { q: q, name: sauce(id).name }; else delete S.sauces[id];
          renderBoard((delta > 0 ? 'Added ' : 'Removed ') + sauce(id).name);
        } else {
          setQty(id, (S.bag[id] ? S.bag[id].q : 0) + delta);
        }
        return;
      }
      if (b.hasAttribute('data-size')) { S.size = +b.getAttribute('data-size'); renderBoard(S.size + ' ounce'); return; }
      if (b.hasAttribute('data-style')) { S.style = b.getAttribute('data-style'); renderBoard(S.style === 'lean' ? 'Lean' : 'Classic'); return; }
      if (act === 'bundle') {
        var bu = BUNDLES[b.getAttribute('data-bundle')], bag = {};
        bu.ids.forEach(function (i) { if (dish(i)) bag[i] = { q: (bag[i] ? bag[i].q : 0) + 1 }; });
        loadBag(bag, bu.name); text($('.tape-msg'), bu.name + ' is on the tape.'); return;
      }
      if (act === 'repeat') {
        var last = load(KEY_LAST);
        if (!last) { text($('.tape-msg'), 'No order on this device yet. Place a preview order and it will be here next week.'); return; }
        S.size = last.size; S.style = last.style; S.sauces = last.sauces || {};
        loadBag(last.bag, 'Last order'); text($('.tape-msg'), 'Last order ' + last.number + ' is back on the tape.'); return;
      }
      if (act === 'save-usual') { save(KEY_USUAL, { bag: S.bag, size: S.size, style: S.style, sauces: S.sauces }); renderTally(calc()); text($('.tape-msg'), 'Saved on this device as your usual.'); announce('Saved as your usual'); return; }
      if (act === 'load-usual') {
        var u = load(KEY_USUAL);
        if (!u) { text($('.tape-msg'), 'Nothing saved yet. Build a bag, then press Save my usual.'); return; }
        S.size = u.size; S.style = u.style; S.sauces = u.sauces || {};
        loadBag(u.bag, 'Your usual'); text($('.tape-msg'), 'Your usual is on the tape.'); return;
      }
      if (act === 'clear') { S.bag = {}; S.sauces = {}; renderBoard('Bag cleared'); return; }
      if (act === 'toggle-tape') {
        var open = D.body.classList.toggle('tape-open');
        b.setAttribute('aria-expanded', String(open));
        b.textContent = open ? 'Close' : 'Bag';
        return;
      }
    });
    on($('.zip-form'), 'submit', function (e) {
      e.preventDefault();
      S.zip = $('input', e.target).value.trim();
      var c = calc();
      text($('.zip-answer'), zipAnswer(S.zip, c.count));
      renderBoard();
      announce(zipAnswer(S.zip, c.count));
    });
    on($('.plan form'), 'submit', function (e) { e.preventDefault(); planWeek(e.target); });
    var zi = $('.zip-form input'); if (zi && S.zip) zi.value = S.zip;
    renderBoard();
  }

  /* ---------- Checkout page ---------- */
  if (page === 'checkout') {
    var form = $('#co-form'), confirmEl = $('#confirm'), icsLink = $('[data-ics]');
    var lastOrder = load(KEY_LAST);
    function syncMode() {
      var mode = (form.querySelector('[name="mode"]:checked') || {}).value || '';
      S.mode = mode;
      $('#pickup-block').hidden = mode !== 'pickup';
      $('#delivery-block').hidden = mode !== 'delivery';
      var c = renderTapeInto($('.co-side .tape'));
      renderTally(c);
      if (icsLink) icsLink.href = icsHref(CY, mode || 'pickup', S.slot, null);
      persist();
      return c;
    }
    if (!S.mode) {
      var b0 = zipBand(S.zip);
      S.mode = (b0 && b0.fee !== null) ? 'delivery' : 'pickup';
    }
    var r = form.querySelector('[name="mode"][value="' + S.mode + '"]'); if (r) r.checked = true;
    var zf = $('#co-zip'); if (zf && S.zip) zf.value = S.zip;
    if (S.slot) { var sr = form.querySelector('[name="slot"][value="' + S.slot + '"]'); if (sr) sr.checked = true; }
    function zipLine() { var c = calc(); text($('#co-zip-answer'), S.zip ? zipAnswer(S.zip, c.count) : 'Enter your ZIP to see the Sunday delivery fee before anything else.'); }
    on(form, 'change', function (e) {
      if (e.target.name === 'mode') syncMode();
      if (e.target.name === 'slot') { S.slot = e.target.value; syncMode(); }
    });
    on(zf, 'input', function () { S.zip = zf.value.trim(); zipLine(); syncMode(); });
    on($('#co-zip-check'), 'click', function () { S.zip = zf.value.trim(); zipLine(); syncMode(); announce($('#co-zip-answer').textContent); });
    zipLine();
    syncMode();
    $('#empty-bag').hidden = bagCount() > 0;

    function slotLabel(v) { var hm = v.split(':'), h = +hm[0]; return (h > 12 ? h - 12 : h) + ':' + hm[1] + ' PM'; }
    function showConfirm(order) {
      form.hidden = true;
      confirmEl.hidden = false;
      text($('[data-order-number]', confirmEl), order.number);
      text($('[data-order-sunday]', confirmEl), order.sundayLong);
      text($('[data-order-mode]', confirmEl), order.mode === 'delivery' ? 'Delivery, Sunday 5:30 to 9:00 PM (sample window)' + (order.zip ? ', ZIP ' + order.zip : '') : 'Pickup in Downey, Sunday ' + (order.slot ? 'around ' + slotLabel(order.slot) : '5:30 to 8:30 PM (sample window)') + '. Address coming from Fina.');
      text($('[data-order-total]', confirmEl), money(order.total) + ' for ' + order.count + (order.count === 1 ? ' meal' : ' meals'));
      var cl = $('[data-ics-confirm]', confirmEl); if (cl) cl.href = icsHref(CY, order.mode, order.slot, order.number);
      var cancelBtn = $('[data-act="cancel-order"]', confirmEl), st = $('[data-order-status]', confirmEl);
      var cy2 = cycle(new Date());
      if (order.status === 'canceled') { text(st, 'Canceled. Nothing was charged; this was a preview.'); cancelBtn.hidden = true; }
      else if (Date.now() > order.close) { text(st, 'The Thursday close for this order has passed, so it can no longer be canceled here.'); cancelBtn.hidden = true; }
      else { text(st, 'You can cancel until Thursday ' + cy2.thursdayShort + ' at 11:59 PM.'); cancelBtn.hidden = false; }
      window.scrollTo(0, 0);
    }
    on(form, 'submit', function (e) {
      e.preventDefault();
      var c = calc();
      if (!c.count) { text($('#co-msg'), 'Your bag is empty. Add meals on the board first.'); $('#empty-bag').hidden = false; return; }
      var now = new Date(), p = laParts(now);
      var number = 'P' + String(p.y).slice(2) + pad2(p.m) + pad2(p.d) + '-' + String(1000 + Math.floor(Math.random() * 9000));
      var order = { number: number, placed: now.getTime(), size: S.size, style: S.style, bag: S.bag, sauces: S.sauces, zip: S.zip, mode: S.mode || 'pickup', slot: S.slot, count: c.count, total: c.total, sundayLong: CY.sundayLong, isoDate: CY.isoDate, close: CY.close, status: 'placed' };
      save(KEY_LAST, order);
      S.bag = {}; S.sauces = {}; persist();
      showConfirm(order);
      announce('Preview order ' + number + ' recorded on this device.');
    });
    on(confirmEl, 'click', function (e) {
      var b = e.target.closest('[data-act="cancel-order"]'); if (!b) return;
      var o = load(KEY_LAST); if (!o) return;
      o.status = 'canceled'; save(KEY_LAST, o); showConfirm(o); announce('Order canceled.');
    });
    if (location.hash === '#confirmation' && lastOrder) showConfirm(lastOrder);
  }

  /* ---------- Menu page: search and filters over 57 dishes ---------- */
  if (page === 'menu') {
    var mf = $('#menu-controls');
    function applyMenu() {
      var q = ($('[name="q"]', mf).value || '').trim().toLowerCase();
      var ex = $$('[name="exclude"]:checked', mf).map(function (i) { return i.value; });
      var mild = $('[name="mild"]', mf).checked, boardOnly = $('[name="board"]', mf).checked;
      var kinds = $$('[name="kind"]:checked', mf).map(function (i) { return i.value; });
      var shown = 0, total = 0;
      $$('.menu-item').forEach(function (li) {
        var d = dish(li.getAttribute('data-id')), hide = false; total++;
        if (q && d.name.toLowerCase().indexOf(q) < 0) hide = true;
        if (kinds.length && kinds.indexOf(d.kind) < 0) hide = true;
        ex.forEach(function (a) { if (d.al.indexOf(a) >= 0) hide = true; });
        if (mild && d.spicy) hide = true;
        if (boardOnly && li.getAttribute('data-board') !== '1') hide = true;
        li.hidden = hide; if (!hide) shown++;
      });
      $$('.menu-group').forEach(function (g) {
        var vis = $$('.menu-item', g).filter(function (li) { return !li.hidden; }).length;
        g.hidden = vis === 0;
        text($('.gc', g), vis);
      });
      $('.menu-empty').hidden = shown > 0;
      text($('#menu-count'), shown + ' of ' + total + ' dishes');
    }
    on(mf, 'change', applyMenu);
    on(mf, 'input', applyMenu);
    on(mf, 'submit', function (e) { e.preventDefault(); applyMenu(); });
    applyMenu();
  }

  /* Expose a tiny read-only surface for QA scripts. */
  window.FINAS = { DISHES: DISHES, PRICES: PRICES, unitPrice: unitPrice, zipBand: zipBand, cycle: cycle, calc: calc, state: S };
})();
