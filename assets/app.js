/* ==========================================================================
   Onboarding data room
   --------------------------------------------------------------------------
   One room, two faces. Financial Connect staff get the board and the controls;
   everybody else gets their own work and nothing else. Which face you see is
   decided by who signed in, not by a separate application.

   Same architecture as the developer portal: plain ES5, classic script tags,
   no build step, runs from file:// or any static host. State lives in
   localStorage under the dataroom: prefix, because there is no backend and this
   is a demonstration of the workflow rather than a system of record.
   ========================================================================== */

/* ── Where the integration guide lives ─────────────────────────────────────
   The integration guide is a separate application. This room indexes it and
   links out; it does not contain it.

   `base` is empty here and should stay empty in the repository, because a
   clone has no companion application to point at. Unset, the integration
   page shows its index and explains the arrangement rather than opening a
   dead tab.

   To wire it up on your own machine, do it from the console rather than by
   editing this line:

       setPortal('../your-docs-app/index.html')

   That keeps the setting in localStorage, where it survives a reload, stays
   out of git, and cannot be committed by accident. `setPortal(null)` clears
   it. Editing `base` directly works too, but it leaves this file dirty and
   one absent-minded `git add -A` publishes a dead link.

   `param` and `token` tell the guide the reader already signed in here, so
   they are not asked twice for one journey. It is a demonstration seam, not
   an authentication boundary: see docs/INTEGRATION-POINTS.md.
   ────────────────────────────────────────────────────────────────────────── */
var PORTAL = {
  base:  '',
  param: 'from',
  token: 'dataroom'
};

/* Resolved on every call rather than at load, so the helpers below take
   effect without a reload. The stored value wins over the committed one. */
function portalBase() {
  var local = recall('portalBase', null);
  return (local === null || local === '') ? PORTAL.base : local;
}

/* Only a relative path. Refusing a scheme or a protocol-relative path keeps
   ?portal= from being a way to aim the button at an arbitrary origin, which
   matters because the parameter is shareable and the room is public. */
function portalAllowed(base) {
  var b = String(base);
  if (/^[a-z][a-z0-9+.-]*:/i.test(b)) return false;
  if (b.indexOf('//') === 0) return false;
  return true;
}

function setPortal(base) {
  if (base === null || base === '' || base === undefined) { forget('portalBase'); }
  else if (!portalAllowed(base)) {
    return 'refused: give a path relative to this page, not a full URL';
  } else {
    store('portalBase', String(base));
  }
  if (state.page === 'integration') go('integration', true);
  return portalBase() || '(not configured)';
}

/* ?portal=../some/path on the URL does the same thing, so wiring up a local
   copy is a link to click rather than a trip into the console. The value is
   stored and the parameter stripped, so it does not linger in the address
   bar or get copied into a share. */
function portalFromUrl() {
  var m = /[?&]portal=([^&#]*)/.exec(location.search);
  if (!m) return;
  var want = decodeURIComponent(m[1]);
  if (want && portalAllowed(want)) store('portalBase', want);
  else if (!want) forget('portalBase');
  if (history.replaceState) {
    var clean = location.search.replace(/([?&])portal=[^&#]*&?/, '$1').replace(/[?&]$/, '');
    history.replaceState({}, '', location.pathname + clean + location.hash);
  }
}

function portalLinked() { return !!portalBase(); }

function portalUrl(page) {
  if (!portalLinked()) return '';
  return portalBase() + '?' + PORTAL.param + '=' + PORTAL.token + (page ? '#' + page : '');
}

/* ── Storage ───────────────────────────────────────────────────────────────
   Everything the room remembers is namespaced, so clearing it is one pass
   and it cannot collide with anything else served from the same origin.
   ────────────────────────────────────────────────────────────────────────── */
var NS = 'dataroom:';

function store(k, v) {
  try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {}
}
function recall(k, fallback) {
  try {
    var v = localStorage.getItem(NS + k);
    return v === null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
function forget(k) { try { localStorage.removeItem(NS + k); } catch (e) {} }

/* Back to the seeded day 11 state. Exposed because a demonstration that
   cannot be reset is a demonstration you get one run at. */
function resetRoom() {
  var keys = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(NS) === 0) keys.push(k);
    }
    keys.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) {}
  location.reload();
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

var state = { user: null, page: null, pending: null };

/* ── People helpers ──────────────────────────────────────────────────────── */
function personById(id) {
  for (var i = 0; i < PEOPLE.length; i++) if (PEOPLE[i].id === id) return PEOPLE[i];
  return null;
}
function personByEmail(email) {
  var e = String(email || '').trim().toLowerCase();
  for (var i = 0; i < PEOPLE.length; i++) if (PEOPLE[i].email.toLowerCase() === e) return PEOPLE[i];
  return null;
}
function initials(name) {
  return String(name).split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
}
function isStaff() { return !!(state.user && state.user.side === 'staff'); }

/* ══════════════════════════════════════════════════════════════════════════
   SIGN IN
   --------------------------------------------------------------------------
   Email, then a six digit code. No password, nothing to create, no sign-up
   form. The code is checked on shape rather than value because there is no
   mail server behind this; everything else about the flow is what the real
   one would do, including the expiry and the resend cooldown.
   ══════════════════════════════════════════════════════════════════════════ */
var authTimers = { expiry: null, resend: null };

function authPoints() {
  return [
    { ic: '✓', t: 'One checklist, both sides',
      d: 'What is done, what is waiting and who owns it.' },
    { ic: '▤', t: 'Documents with their history',
      d: 'Every version and approval, kept in one place.' },
    { ic: '→', t: 'The integration guide alongside',
      d: 'The same documentation your engineers keep after go-live.' }
  ];
}

function renderAuthAside() {
  document.getElementById('auth-points').innerHTML = authPoints().map(function (p) {
    return '<li><span class="ic">' + p.ic + '</span><div><b>' + esc(p.t) + '</b>' +
      '<p>' + esc(p.d) + '</p></div></li>';
  }).join('');
}

/* A handful of the people in the room, so the demonstration can be driven
   without anyone having to know the invented addresses. */
function renderDemoList() {
  var show = ['alicia', 'dana', 'priya', 'marcus', 'lena'];
  document.getElementById('demo-list').innerHTML = show.map(function (id) {
    var p = personById(id);
    var where = p.org === 'fc' ? 'Financial Connect'
              : p.org === 'thirdparty' ? ROOM.thirdParty.name
              : ROOM.short;
    return '<button class="demo-row ' + p.org + '" type="button" onclick="demoAs(\'' + p.id + '\')">' +
      '<span class="demo-ini">' + esc(initials(p.name)) + '</span>' +
      '<span style="min-width:0"><span class="demo-nm">' + esc(p.name) + '</span>' +
      '<span class="demo-rl">' + esc(p.role) + ' · ' + esc(where) + '</span></span>' +
    '</button>';
  }).join('');
}

function demoAs(id) {
  var p = personById(id);
  if (!p) return;
  document.getElementById('email').value = p.email;
  sendCode();
}

function authError(which, msg) {
  var el = document.getElementById(which + '-err');
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = msg;
}

function sendCode() {
  var email = document.getElementById('email').value.trim();
  if (!email) { authError('email', 'Enter the email address your invitation was sent to.'); return; }
  if (email.indexOf('@') < 1 || email.indexOf('.', email.indexOf('@')) < 0) {
    authError('email', 'That does not look like an email address.'); return;
  }

  var p = personByEmail(email);
  if (!p) {
    /* A real one would send nothing and say the same thing either way, so
       the form cannot be used to find out who is in the room. */
    authError('email', 'If that address is on this onboarding, a code is on its way. ' +
      'It is not one we recognise, so check with your Financial Connect contact.');
    return;
  }

  authError('email', '');
  state.pending = p.id;
  document.getElementById('code-to').textContent = p.email;
  document.getElementById('step-email').hidden = true;
  document.getElementById('step-code').hidden = false;
  buildCodeBoxes();
  startExpiry();
  startResend();
  var first = document.querySelector('#code-boxes input');
  if (first) first.focus();
}

function buildCodeBoxes() {
  var host = document.getElementById('code-boxes');
  var html = '';
  for (var i = 0; i < AUTH.codeLength; i++) {
    /* Not maxlength 1: the browser would drop the extra characters before
       the input handler could spread them across the boxes. The handler
       trims to a single digit itself. */
    html += '<input type="text" inputmode="numeric" maxlength="' + AUTH.codeLength +
            '" autocomplete="one-time-code" ' +
            'aria-label="Digit ' + (i + 1) + '">';
  }
  host.innerHTML = html;

  var boxes = host.querySelectorAll('input');

  /* Spread a run of digits across the boxes starting at `from`. Everything
     that puts more than one character into a box lands here: a paste, a
     password manager filling the field, and ordinary fast typing, which
     outruns the focus change and would otherwise lose every digit after
     the first. */
  function spread(from, text) {
    var t = String(text).replace(/\D/g, '');
    if (!t) return;
    for (var k = 0; k < t.length && from + k < boxes.length; k++) {
      boxes[from + k].value = t.charAt(k);
    }
    var land = Math.min(from + t.length, boxes.length - 1);
    boxes[land].focus();
    if (codeValue().length === AUTH.codeLength) verify();
  }

  Array.prototype.forEach.call(boxes, function (b, i) {
    b.addEventListener('input', function () {
      var v = b.value.replace(/\D/g, '');
      if (v.length > 1) { b.value = ''; spread(i, v); return; }
      b.value = v;
      if (v && i < boxes.length - 1) boxes[i + 1].focus();
      if (codeValue().length === AUTH.codeLength) verify();
    });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus();
      if (e.key === 'Enter') verify();
    });
    b.addEventListener('paste', function (e) {
      var t = (e.clipboardData || window.clipboardData).getData('text');
      if (!t) return;
      e.preventDefault();
      spread(i, t);
    });
  });
}

function codeValue() {
  return Array.prototype.map.call(
    document.querySelectorAll('#code-boxes input'),
    function (b) { return b.value; }
  ).join('');
}

function startExpiry() {
  clearInterval(authTimers.expiry);
  var left = AUTH.codeMinutes * 60;
  var el = document.getElementById('code-expiry');
  function paint() {
    if (left <= 0) {
      clearInterval(authTimers.expiry);
      el.textContent = 'That code has expired.';
      authError('code', 'Your code has expired. Send a new one.');
      return;
    }
    el.textContent = 'Expires in ' + Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2);
    left--;
  }
  paint();
  authTimers.expiry = setInterval(paint, 1000);
}

function startResend() {
  clearInterval(authTimers.resend);
  var left = AUTH.resendSeconds;
  var btn = document.getElementById('resend');
  function paint() {
    if (left <= 0) {
      clearInterval(authTimers.resend);
      btn.textContent = 'Send a new code';
      btn.disabled = false;
      return;
    }
    btn.textContent = 'Send a new code in ' + left + 's';
    btn.disabled = true;
    left--;
  }
  paint();
  authTimers.resend = setInterval(paint, 1000);
}

function resendCode() {
  authError('code', '');
  buildCodeBoxes();
  startExpiry();
  startResend();
  var first = document.querySelector('#code-boxes input');
  if (first) first.focus();
}

function verify() {
  var code = codeValue();
  if (code.length < AUTH.codeLength) {
    authError('code', 'Enter all ' + AUTH.codeLength + ' digits.');
    return;
  }
  authError('code', '');
  signIn(state.pending);
}

function backToEmail() {
  clearInterval(authTimers.expiry);
  clearInterval(authTimers.resend);
  state.pending = null;
  authError('code', '');
  document.getElementById('step-code').hidden = true;
  document.getElementById('step-email').hidden = false;
  document.getElementById('email').focus();
}

function signIn(personId) {
  clearInterval(authTimers.expiry);
  clearInterval(authTimers.resend);
  store('session', { who: personId, at: Date.now() });
  openRoom(personId);
}

function signOut() {
  forget('session');
  state.user = null;
  state.page = null;
  document.getElementById('app').hidden = true;
  document.getElementById('auth').hidden = false;
  backToEmail();
  document.getElementById('email').value = '';
  if (history.replaceState) history.replaceState({}, '', location.pathname);
}

/* A session older than its limit is not a session. */
function liveSession() {
  var s = recall('session', null);
  if (!s || !s.who) return null;
  if (Date.now() - s.at > AUTH.sessionHours * 3600e3) { forget('session'); return null; }
  return personById(s.who);
}

function openRoom(personId) {
  state.user = personById(personId);
  if (!state.user) { signOut(); return; }

  document.getElementById('auth').hidden = true;
  document.getElementById('app').hidden = false;

  document.getElementById('brand-room').textContent = ROOM.merchant;
  document.getElementById('whoami').innerHTML =
    '<b>' + esc(state.user.name) + '</b><span>' + esc(state.user.role) + '</span>';

  buildNav();
  var initial = (location.hash || '').replace('#', '');
  go(initial && routeExists(initial) ? initial : (isStaff() ? 'board' : 'home'));
}

/* ══════════════════════════════════════════════════════════════════════════
   CHECKLIST STATE
   --------------------------------------------------------------------------
   Items carry their seeded status in data.js. Anything a user changes is an
   override stored here, so the demonstration can be reset to its starting
   state without editing the data.
   ══════════════════════════════════════════════════════════════════════════ */
function overrides() { return recall('items', {}) || {}; }

function itemById(id) {
  for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i];
  return null;
}

/* The item as it stands now: seed plus whatever has been changed. */
function itemNow(id) {
  var base = itemById(id);
  if (!base) return null;
  var o = overrides()[id];
  if (!o) return base;
  var merged = {};
  for (var k in base) if (base.hasOwnProperty(k)) merged[k] = base[k];
  for (var j in o) if (o.hasOwnProperty(j)) merged[j] = o[j];
  return merged;
}

function allItems() { return ITEMS.map(function (i) { return itemNow(i.id); }); }

function setItem(id, patch) {
  var all = overrides();
  var cur = all[id] || {};
  for (var k in patch) if (patch.hasOwnProperty(k)) cur[k] = patch[k];
  all[id] = cur;
  store('items', all);
}

function toggleItem(id) {
  var it = itemNow(id);
  if (!it) return;
  if (it.status === 'done') {
    setItem(id, { status: it.ws === 'technical' || it.who === state.user.id ? 'active' : 'waiting',
                  at: null, elapsed: it.elapsed || 'just reopened' });
  } else {
    setItem(id, { status: 'done', at: nowStamp(), elapsed: it.elapsed || 'just now',
                  doneBy: state.user.id });
  }
  buildNav();
  go(state.page, true);
}

function nowStamp() {
  var d = new Date();
  var h = d.getHours(), m = ('0' + d.getMinutes()).slice(-2);
  var ap = h >= 12 ? 'pm' : 'am';
  h = h % 12; if (!h) h = 12;
  return d.getDate() + ' ' + ['January','February','March','April','May','June','July',
    'August','September','October','November','December'][d.getMonth()] + ', ' + h + ':' + m + ap;
}

function counts() {
  var c = { done: 0, active: 0, waiting: 0, idle: 0, total: ITEMS.length };
  allItems().forEach(function (i) { c[i.status]++; });
  return c;
}

/* Items this person is responsible for. Staff see everything; everybody else
   sees their own workstreams, because somebody from finance has no business
   reading the integration build. */
function myItems() {
  if (isStaff()) return allItems();
  var ws = state.user.workstreams || [];
  return allItems().filter(function (i) {
    return i.who === state.user.id || ws.indexOf(i.ws) !== -1;
  });
}

function myOpen() {
  return myItems().filter(function (i) {
    return i.status !== 'done' && (i.who === state.user.id || isStaff());
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   CONTACTS AND THE GATE
   --------------------------------------------------------------------------
   Every workstream needs an owner at Financial Connect and at least one person
   at the merchant. Until all four are satisfied, nothing merchant-facing
   opens. The rule is enforced here rather than described, so removing a
   contact really does close the room.
   ══════════════════════════════════════════════════════════════════════════ */
function removedContacts() { return recall('removed', {}) || {}; }

function contactsFor(wsId, org) {
  var gone = removedContacts();
  return PEOPLE.filter(function (p) {
    if (gone[p.id]) return false;
    if (p.org !== org) return false;
    return (p.workstreams || []).indexOf(wsId) !== -1;
  });
}

function wsSatisfied(wsId) {
  return contactsFor(wsId, 'fc').length > 0 && contactsFor(wsId, 'merchant').length > 0;
}

function gateOpen() {
  for (var i = 0; i < WORKSTREAMS.length; i++) if (!wsSatisfied(WORKSTREAMS[i].id)) return false;
  return true;
}

function gapWorkstreams() {
  return WORKSTREAMS.filter(function (w) { return !wsSatisfied(w.id); });
}

function removeContact(id) {
  var g = removedContacts(); g[id] = 1; store('removed', g);
  buildNav(); go('contacts', true);
}
function restoreContact(id) {
  var g = removedContacts(); delete g[id]; store('removed', g);
  buildNav(); go('contacts', true);
}

/* ══════════════════════════════════════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════════════════════════════════════ */
function navModel() {
  var open = myOpen().length;
  if (isStaff()) {
    return [
      { label: 'Onboarding', items: [
        { id: 'board',    nm: 'Status board' },
        { id: 'contacts', nm: 'Contacts', warn: gapWorkstreams().length },
        { id: 'account',  nm: 'Merchant account' }
      ]},
      { label: 'Documents', items: [
        { id: 'terms',     nm: 'Terms and conditions' },
        { id: 'marketing', nm: 'Marketing guidelines' }
      ]},
      { label: 'Technical', items: [
        { id: 'integration', nm: 'Integration' }
      ]},
      { label: 'Closing', items: [
        { id: 'close', nm: 'Close the onboarding' }
      ]}
    ];
  }

  var sections = [
    { label: 'Your onboarding', items: [
      { id: 'home', nm: 'What you need to do', count: open }
    ]}
  ];
  var ws = state.user.workstreams || [];
  var docs = [];
  if (ws.indexOf('legal') !== -1)     docs.push({ id: 'terms',     nm: 'Terms and conditions' });
  if (ws.indexOf('marketing') !== -1) docs.push({ id: 'marketing', nm: 'Marketing guidelines' });
  if (docs.length) sections.push({ label: 'Documents', items: docs });
  if (ws.indexOf('technical') !== -1) {
    sections.push({ label: 'Technical', items: [{ id: 'integration', nm: 'Integration guide' }] });
  }
  sections.push({ label: 'The room', items: [{ id: 'contacts', nm: 'Who is working on this' }] });
  return sections;
}

function routeExists(route) {
  if (route.indexOf('item:') === 0) return !!itemById(route.slice(5));
  var found = false;
  navModel().forEach(function (s) {
    s.items.forEach(function (i) { if (i.id === route) found = true; });
  });
  return found;
}

function buildNav() {
  if (!state.user) return;
  document.getElementById('nav').innerHTML = navModel().map(function (sec) {
    return '<div class="nav-label">' + esc(sec.label) + '</div>' +
      sec.items.map(function (i) {
        var badge = '';
        if (i.warn)  badge = '<span class="nav-count wait">' + i.warn + '</span>';
        else if (i.count) badge = '<span class="nav-count">' + i.count + '</span>';
        return '<div class="nav-item' + (state.page === i.id ? ' on' : '') +
          '" onclick="go(\'' + i.id + '\')"><span class="nm">' + esc(i.nm) + '</span>' + badge + '</div>';
      }).join('');
  }).join('');
}

function toggleNav(force) {
  var nav = document.getElementById('sidenav');
  var scrim = document.getElementById('nav-scrim');
  var want = force === undefined ? !nav.classList.contains('open') : force;
  nav.classList.toggle('open', want);
  scrim.classList.toggle('on', want);
  document.getElementById('nav-toggle').setAttribute('aria-expanded', want ? 'true' : 'false');
}

/* ══════════════════════════════════════════════════════════════════════════
   ROUTER
   ══════════════════════════════════════════════════════════════════════════ */
var VIEWS = {};

function go(route, repaint) {
  if (!route) route = isStaff() ? 'board' : 'home';
  var view, arg = null;
  if (route.indexOf('item:') === 0) { view = VIEWS.item; arg = route.slice(5); }
  else view = VIEWS[route];
  if (!view) { go(isStaff() ? 'board' : 'home'); return; }

  state.page = route;
  if (repaint) { if (history.replaceState) history.replaceState({ r: route }, '', '#' + route); }
  else if (history.pushState) history.pushState({ r: route }, '', '#' + route);

  document.getElementById('page-host').innerHTML = view(arg);
  buildNav();
  toggleNav(false);
  window.scrollTo(0, 0);
}

window.addEventListener('popstate', function (e) {
  if (!state.user) return;
  var r = (e.state && e.state.r) || (location.hash || '').replace('#', '');
  if (r && routeExists(r)) { state.page = r; go(r, true); }
});

/* ── Shared page pieces ──────────────────────────────────────────────────── */
function crumbs(parts) {
  return '<div class="crumbs">' + parts.map(function (p, i) {
    if (i === parts.length - 1) return '<span>' + esc(p.t) + '</span>';
    return '<span><a href="#' + p.r + '" onclick="go(\'' + p.r + '\');return false;">' +
      esc(p.t) + '</a></span>';
  }).join('') + '</div>';
}

function head(title, sub, tag) {
  return '<div class="p-head"><div><h1>' + esc(title) + '</h1>' +
    (sub ? '<p>' + sub + '</p>' : '') + '</div><div class="p-spacer"></div>' +
    (tag || '') + '</div>';
}

function statusTag(st) {
  if (st === 'done')    return '<span class="tag done">Complete</span>';
  if (st === 'active')  return '<span class="tag live">In progress</span>';
  if (st === 'waiting') return '<span class="tag wait">Waiting on ' + esc(ROOM.short) + '</span>';
  return '<span class="tag">Not started</span>';
}

function itemRow(it, opts) {
  opts = opts || {};
  var p = personById(it.doneBy || it.who);
  var side = it.status === 'done'
    ? esc((it.byName || (p ? p.name : '')) + (it.elapsed ? ' · ' + it.elapsed : ''))
    : (it.elapsed ? esc(p ? p.name : '') + ' · ' + esc(it.elapsed) : esc(p ? p.name : ''));
  return '<div class="item' + (it.status === 'done' ? ' is-done' : '') +
    (opts.flat ? ' flat' : '') + '"' +
    (opts.flat ? '' : ' onclick="go(\'item:' + it.id + '\')"') + '>' +
    '<span class="box ' + it.status + '"></span>' +
    '<span class="lab"><span class="t">' + esc(it.title) + '</span>' +
      (opts.showWs ? '<span class="m">' + esc(wsName(it.ws)) + '</span>' : '') +
    '</span>' +
    '<span class="side">' + side + '</span>' +
  '</div>';
}

function wsName(id) {
  for (var i = 0; i < WORKSTREAMS.length; i++) if (WORKSTREAMS[i].id === id) return WORKSTREAMS[i].name;
  return id;
}

function note(kind, icon, body) {
  return '<div class="note ' + kind + '"><span class="ic">' + icon + '</span><div>' + body + '</div></div>';
}

function gateBanner() {
  var gaps = gapWorkstreams();
  if (!gaps.length) return '';
  var names = gaps.map(function (g) { return g.name.toLowerCase(); });
  var list = names.length === 1 ? names[0]
    : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  return note('warn', '⚠',
    '<b>' + (gaps.length === 1 ? 'One workstream has nobody named at ' + esc(ROOM.short) + '.'
                               : gaps.length + ' workstreams have nobody named at ' + esc(ROOM.short) + '.') +
    '</b> Nothing merchant-facing opens until ' + esc(list) + ' ' +
    (gaps.length === 1 ? 'has' : 'have') + ' somebody on their side. ' +
    '<a href="#contacts" onclick="go(\'contacts\');return false;">Name them</a>.');
}

/* ══════════════════════════════════════════════════════════════════════════
   VIEWS, MERCHANT SIDE
   ══════════════════════════════════════════════════════════════════════════ */
VIEWS.home = function () {
  var mine = myItems();
  var open = mine.filter(function (i) { return i.status !== 'done'; });
  var yours = open.filter(function (i) { return i.who === state.user.id; });
  var done = mine.filter(function (i) { return i.status === 'done'; });
  var c = counts();

  var html = head(ROOM.merchant,
    'Day ' + ROOM.dayNow + ' of ' + ROOM.targetDays + ' · your contact is ' + esc(ROOM.owner),
    '<span class="tag day">Day ' + ROOM.dayNow + ' of ' + ROOM.targetDays + '</span>');

  html += '<div class="card"><div class="grid2" style="align-items:center">' +
    '<div class="stat"><div class="n">' + c.done + ' <small>of ' + c.total + ' complete</small></div>' +
      '<div class="l">Across everyone working on this launch</div></div>' +
    '<div><div style="font-size:13px;color:var(--text-dim);margin-bottom:8px">' +
      (yours.length ? yours.length + ' item' + (yours.length === 1 ? '' : 's') + ' waiting on you'
                    : 'Nothing is waiting on you') + '</div>' +
      '<div class="bar"><i style="width:' + Math.max(2, Math.round(c.done / c.total * 100)) + '%"></i></div></div>' +
  '</div></div>';

  if (yours.length) {
    html += '<h2 style="font-size:15px;margin:22px 0 11px">Yours to do</h2>' +
      yours.map(function (i) { return itemRow(i, { showWs: true }); }).join('');
  } else {
    html += note('ok', '✓', '<b>Nothing is waiting on you right now.</b> ' +
      'You will get an email if that changes.');
  }

  var others = open.filter(function (i) { return i.who !== state.user.id; });
  if (others.length) {
    html += '<h2 style="font-size:15px;margin:26px 0 11px">Also open, in your area</h2>' +
      '<div class="card" style="padding:4px 18px">' +
      others.map(function (i) { return itemRow(i, { flat: true, showWs: true }); }).join('') +
      '</div>';
  }

  if (done.length) {
    html += '<h2 style="font-size:15px;margin:26px 0 11px">Already done</h2>' +
      '<div class="card" style="padding:4px 18px">' +
      done.map(function (i) { return itemRow(i, { flat: true, showWs: true }); }).join('') +
      '</div>';
  }

  return html;
};

VIEWS.item = function (id) {
  var it = itemNow(id);
  if (!it) return head('Not found', 'That item is not part of this onboarding.');

  var owner = personById(it.doneBy || it.who);
  var watcher = it.watcher ? personById(it.watcher) : null;
  var mine = it.who === state.user.id;

  var html = crumbs([
    { r: isStaff() ? 'board' : 'home', t: ROOM.merchant },
    { t: it.title }
  ]);

  html += head(it.title,
    'Assigned to ' + esc(owner ? owner.name : 'nobody yet') +
    (watcher ? ' · watched by ' + esc(watcher.name) + ', ' + esc(watcher.role) : ''),
    statusTag(it.status));

  html += '<div class="card">' +
    '<div class="field"><div class="k">What we need</div><div class="v">' + esc(it.what) + '</div></div>' +
    '<div class="field"><div class="k">How it gets done</div><div class="v">' + esc(it.how) + '</div></div>' +
    (it.status === 'done' && it.at
      ? '<div class="field"><div class="k">Completed</div><div class="v">' +
        esc((it.byName || (owner ? owner.name : '')) + ' · ' + it.at +
            (it.elapsed ? ' · took ' + it.elapsed : '')) + '</div></div>'
      : it.elapsed && it.elapsed !== 'ongoing'
        ? '<div class="field"><div class="k">Open for</div><div class="v">' + esc(it.elapsed) +
          ' of working time</div></div>'
        : '') +
  '</div>';

  if (it.page) {
    var label = it.page === 'integration' ? 'Open the integration pages'
              : it.page === 'terms' ? 'Open the terms'
              : it.page === 'marketing' ? 'Open the guidelines'
              : it.page === 'contacts' ? 'Open contacts' : 'Open';
    html += '<div class="btn-row" style="margin-bottom:16px">' +
      '<button class="btn" onclick="go(\'' + it.page + '\')">' + esc(label) + ' →</button></div>';
  }

  if (mine || isStaff()) {
    html += '<div class="card"><h2>Mark it off</h2>' +
      '<div class="btn-row">' +
      '<button class="btn ' + (it.status === 'done' ? '' : 'go') + '" onclick="toggleItem(\'' + it.id + '\')">' +
        (it.status === 'done' ? 'Reopen this item' : 'Mark complete') + '</button>' +
      '<span class="hint">' + (it.status === 'done'
        ? 'Reopening restarts the clock and tells ' + esc(ROOM.owner) + '.'
        : 'Nobody has to chase you for an update once this is ticked.') + '</span>' +
      '</div></div>';
  } else {
    html += note('info', 'ℹ', 'This one belongs to ' + esc(owner ? owner.name : 'somebody else') +
      '. You can see where it stands, which is usually the question.');
  }

  if (it.note) html += note('info', 'ℹ', esc(it.note));
  return html;
};

/* ══════════════════════════════════════════════════════════════════════════
   DOCUMENTS
   ══════════════════════════════════════════════════════════════════════════ */
VIEWS.terms = function () {
  var d = DOCS.terms;
  var html = crumbs([{ r: isStaff() ? 'board' : 'home', t: ROOM.merchant }, { t: 'Terms and conditions' }]);
  html += head(d.title, esc(d.sub), '<span class="tag done">' + esc(d.status) + '</span>');

  html += '<div class="card"><h2>Version history</h2>' +
    d.versions.map(function (v) {
      return '<div class="ver"><span class="vn">' + esc(v.v) + '</span>' +
        '<span class="vf">' + esc(v.file) + '</span>' +
        '<span class="vw">' + esc(v.by) + ' · ' + esc(v.on) + '</span></div>';
    }).join('') + '</div>';

  html += '<div class="card"><h2>Approval</h2>' +
    '<div class="item flat"><span class="box done"></span><span class="lab">' +
      '<span class="t">Approved by ' + esc(d.approval.by) + ', ' + esc(d.approval.role) + '</span>' +
      '<span class="m">' + esc(d.approval.at) + '</span></span></div></div>';

  html += note('info', 'ℹ', '<b>Published to the Financial Connect portal.</b> ' +
    esc(d.published.replace('Published to the Financial Connect portal. ', '')));
  return html;
};

VIEWS.marketing = function () {
  var d = DOCS.marketing;
  var html = crumbs([{ r: isStaff() ? 'board' : 'home', t: ROOM.merchant }, { t: 'Marketing guidelines' }]);
  html += head(d.title, esc(d.sub), '<span class="tag wait">' + esc(d.status) + '</span>');

  html += '<div class="card"><h2>What publishers may and may not say about ' + esc(ROOM.short) + '</h2>' +
    '<div class="ver"><span class="vn">' + esc(d.current.v) + '</span>' +
      '<span class="vf">' + esc(d.current.file) +
        '<div class="r">' + esc(d.current.note) + '</div></span>' +
      '<button class="btn">Download</button></div></div>';

  html += '<div class="card"><h2>' + esc(ROOM.short) + '’s response</h2>' +
    d.responses.map(function (v) {
      return '<div class="ver"><span class="vn">' + esc(v.v) + '</span>' +
        '<span class="vf">' + esc(v.file) + '</span>' +
        '<span class="vw">' + esc(v.by) + ' · ' + esc(v.on) + '</span></div>';
    }).join('') +
    '<div class="quote">' + esc(d.comment) + '</div></div>';

  html += note('info', 'ℹ', '<b>This is the one document we do not hold ourselves.</b> ' +
    'The guidelines live where our marketing team writes them, so what you see is always current. ' +
    'Everything you send back is stored here with its history.');
  return html;
};

/* ══════════════════════════════════════════════════════════════════════════
   INTEGRATION
   --------------------------------------------------------------------------
   Deliberately an index rather than a copy. One source, two front doors: the
   same pages the knowledge base serves after go-live, so there is nothing to
   keep in step and no access to withdraw later.
   ══════════════════════════════════════════════════════════════════════════ */
VIEWS.integration = function () {
  var q = (recall('ixq', '') || '').toLowerCase();
  var hits = INTEGRATION_INDEX.filter(function (r) {
    if (!q) return true;
    return (r.title + ' ' + r.blurb).toLowerCase().indexOf(q) !== -1;
  });

  var tp = contactsFor('technical', 'thirdparty');
  var introItem = itemNow('third-party-intro');

  var html = crumbs([{ r: isStaff() ? 'board' : 'home', t: ROOM.merchant }, { t: 'Technical integration' }]);
  html += head('Technical integration',
    'Supported by ' + esc(personById('tom').name) + ', ' + esc(personById('tom').role));

  html += '<div class="ix-search"><span style="color:var(--text-dim)">Search</span>' +
    '<input id="ixq" type="search" value="' + esc(recall('ixq', '')) +
    '" placeholder="conversion postback, cross domain, batch file…" ' +
    'oninput="ixSearch(this.value)" autocomplete="off"></div>';

  html += '<div class="card" style="padding:4px 20px">' +
    (hits.length
      ? hits.map(function (r) {
          /* Without somewhere to send them these are not links, so they
             must not look like links. `inert` drops the accent colour and
             the hover underline as well as the pointer. */
          return '<div class="result' + (portalLinked() ? '' : ' inert') + '"' +
            (portalLinked() ? ' onclick="openPortal(\'' + r.page + '\')"' : '') +
            '><div class="rt">' + esc(r.title) + '</div>' +
            '<div class="rs">' + esc(r.blurb) + '</div></div>';
        }).join('')
      : '<div class="ix-empty">Nothing here matches that. The full guide has a search of its own ' +
        'that covers every page.</div>') +
  '</div>';

  if (tp.length) {
    html += '<div class="card"><h2>Third party provider ' +
      '<span class="sub">' + esc(ROOM.thirdParty.name) + ' ' + esc(ROOM.thirdParty.does) + '</span></h2>' +
      '<div class="item flat"><span class="box ' + introItem.status + '"></span><span class="lab">' +
        '<span class="t">Introduce Financial Connect to ' + esc(tp[0].name) + '</span>' +
        '<span class="m">' + (introItem.status === 'done'
          ? esc(personById('tom').name) + ' · 12 March' : 'Not yet done') + '</span></span></div>' +
      '<div class="lk" style="margin-top:11px">' + esc(SUPPORT.partners) + '</div></div>';
  }

  html += '<div class="linkrow">' +
    '<span class="lk">Method guides, worked examples and the recommendation wizard</span>' +
    (portalLinked()
      ? '<button class="btn primary" onclick="openPortal(\'choose\')">Open the integration guide</button>'
      : '<button class="btn" disabled title="Set PORTAL.base in assets/app.js">' +
        'Open the integration guide</button>') +
  '</div>';

  html += '<div style="height:16px"></div>' +
    (portalLinked()
      ? note('info', 'ℹ', '<b>One source, two front doors.</b> This is the same content ' +
          esc(ROOM.short) + ' will read in the knowledge base after go-live, so there is nothing to keep ' +
          'in step and no access to withdraw later.')
      : note('info', 'ℹ', '<b>The integration guide is a separate application.</b> ' +
          'This room indexes it and links out rather than holding a second copy, which is the point: ' +
          'one source, two front doors, nothing to keep in step. Point <code>PORTAL.base</code> in ' +
          '<code>assets/app.js</code> at wherever you serve it and these links come alive.'));
  return html;
};

function ixSearch(v) {
  store('ixq', v);
  var host = document.getElementById('page-host');
  var sel = document.getElementById('ixq');
  var caret = sel ? sel.selectionStart : null;
  host.innerHTML = VIEWS.integration();
  var again = document.getElementById('ixq');
  if (again) { again.focus(); if (caret !== null) again.setSelectionRange(caret, caret); }
}

function openPortal(page) {
  if (!portalLinked()) return;
  window.open(portalUrl(page), '_blank', 'noopener');
}

/* ══════════════════════════════════════════════════════════════════════════
   CONTACTS
   ══════════════════════════════════════════════════════════════════════════ */
VIEWS.contacts = function () {
  var staff = isStaff();
  var html = crumbs([{ r: staff ? 'board' : 'home', t: ROOM.merchant }, { t: 'Contacts' }]);

  html += head('Who is working on what',
    'One owner at Financial Connect and at least one person at ' + esc(ROOM.short) +
    ', for each workstream',
    gateOpen() ? '<span class="tag done">Complete</span>' : '<span class="tag wait">Blocked</span>');

  if (staff) html += gateBanner();

  html += '<div class="card">' + WORKSTREAMS.map(function (w) {
    var ok = wsSatisfied(w.id);
    var fc = contactsFor(w.id, 'fc');
    var me = contactsFor(w.id, 'merchant');
    var tp = contactsFor(w.id, 'thirdparty');

    function people(list, emptyMsg) {
      if (!list.length) return '<div class="missing">' + esc(emptyMsg) + '</div>';
      return list.map(function (p) {
        return '<div class="person">' + esc(p.name) +
          (staff ? ' <button class="auth-link" style="font-size:11.5px" ' +
                   'onclick="removeContact(\'' + p.id + '\')">remove</button>' : '') +
          '<div class="r">' + esc(p.role) + (p.watcherOnly ? ' · watching only' : '') + '</div></div>';
      }).join('');
    }

    var gone = PEOPLE.filter(function (p) {
      return removedContacts()[p.id] && (p.workstreams || []).indexOf(w.id) !== -1;
    });

    return '<div class="role' + (ok ? '' : ' gap') + '">' +
      '<div class="role-name"><span class="box' + (ok ? ' done' : '') + '"></span>' + esc(w.name) + '</div>' +
      '<div class="role-covers">' + esc(w.covers) + '</div>' +
      '<div class="party"><div class="p-l">Financial Connect</div><div>' +
        people(fc, 'Nobody named yet') + '</div></div>' +
      '<div class="party"><div class="p-l">' + esc(ROOM.short) + '</div><div>' +
        people(me, 'Nobody named yet') +
        (staff && gone.length
          ? gone.filter(function (p) { return p.org === 'merchant'; }).map(function (p) {
              return '<button class="add" onclick="restoreContact(\'' + p.id + '\')">' +
                'Add ' + esc(p.name) + ' back</button>';
            }).join('')
          : '') +
        (staff && !gone.filter(function (p) { return p.org === 'merchant'; }).length
          ? '<button class="add' + (me.length ? '' : ' urgent') + '">' +
            (me.length ? 'Add another' : 'Add a ' + esc(w.name.toLowerCase()) + ' contact') + '</button>'
          : '') +
      '</div></div>' +
      (tp.length
        ? '<div class="party"><div class="p-l">Third party<div class="sm">' +
          esc(ROOM.thirdParty.name) + '</div></div><div>' + people(tp, '') + '</div></div>'
        : '') +
    '</div>';
  }).join('') + '</div>';

  if (staff) {
    html += '<div class="btn-row">' +
      '<button class="btn primary" ' + (gateOpen() ? '' : 'disabled') + '>' +
        'Open the data room to ' + esc(ROOM.short) + '</button>' +
      '<span class="hint">' + (gateOpen()
        ? 'Everyone named here gets their own sign-in link.'
        : 'Four checklist items are waiting on this.') + '</span></div>';
    html += '<div style="height:14px"></div>' +
      note('info', 'ℹ', '<b>Try it.</b> Remove the only ' + esc(ROOM.short) +
        ' contact from any workstream and the room closes: the button above goes dead and a warning ' +
        'appears on the board. The rule is enforced, not described.');
  } else {
    html += note('info', 'ℹ', 'Everyone here can see this list. If somebody is missing, ' +
      'tell ' + esc(ROOM.owner) + ' and they will add them.');
  }
  return html;
};

/* ══════════════════════════════════════════════════════════════════════════
   VIEWS, STAFF SIDE
   ══════════════════════════════════════════════════════════════════════════ */
VIEWS.board = function () {
  var c = counts();
  var all = allItems();
  var done = all.filter(function (i) { return i.status === 'done'; });
  var open = all.filter(function (i) { return i.status !== 'done'; });

  var html = head(ROOM.merchant,
    'Day ' + ROOM.dayNow + ' of ' + ROOM.targetDays + ' · owner ' + esc(ROOM.owner),
    c.waiting ? '<span class="tag wait">' + c.waiting + ' waiting on ' + esc(ROOM.short) + '</span>'
              : '<span class="tag day">On track</span>');

  html += gateBanner();

  html += '<div class="strip">' +
    '<div><div class="n go">' + c.done + '</div><div class="l">Complete</div></div>' +
    '<div><div class="n">' + c.active + '</div><div class="l">In progress</div></div>' +
    '<div><div class="n wait">' + c.waiting + '</div><div class="l">Waiting on ' + esc(ROOM.short) + '</div></div>' +
    '<div><div class="n">' + c.idle + '</div><div class="l">Not started yet</div></div>' +
  '</div>';

  html += '<div class="card"><div class="grid2" style="gap:28px">' +
    '<div><div class="col-head">Complete</div>' +
      done.map(function (i) { return itemRow(i, { flat: true }); }).join('') + '</div>' +
    '<div><div class="col-head">Open</div>' +
      open.map(function (i) { return itemRow(i, { flat: true }); }).join('') +
      '<div class="key">' +
        '<span><i class="box done" style="display:block"></i>Done</span>' +
        '<span><i class="box active" style="display:block"></i>In progress</span>' +
        '<span><i class="box waiting" style="display:block"></i>Waiting on ' + esc(ROOM.short) + '</span>' +
        '<span><i class="box" style="display:block"></i>Not started</span>' +
      '</div></div>' +
  '</div></div>';

  var stale = open.filter(function (i) {
    return i.status === 'waiting' && /^\d+d/.test(String(i.elapsed)) && parseInt(i.elapsed, 10) >= 5;
  });
  if (stale.length) {
    html += note('warn', '⚠', '<b>' + stale.length + ' item' + (stale.length === 1 ? ' has' : 's have') +
      ' been sitting with ' + esc(ROOM.short) + ' for five days or more.</b> ' +
      'Nobody had to notice that in a meeting. The clock counts working hours from the moment ' +
      'each item was assigned.');
  }
  return html;
};

VIEWS.account = function () {
  var c = counts();
  var html = crumbs([{ r: 'board', t: ROOM.merchant }, { t: 'Merchant account' }]);
  html += head(ROOM.merchant,
    'Signed ' + esc(ROOM.signedOn) + ' · commercial owner ' + esc(ROOM.commercialOwner) +
    ' · target live ' + esc(ROOM.targetLive),
    '<span class="tag done">Closed won</span>');

  html += '<div class="card"><h2>Onboarding data room ' +
    '<span class="sub">created the moment the deal closed</span></h2>' +
    '<div class="grid2" style="align-items:center">' +
      '<div class="stat"><div class="n">' + ROOM.dayNow +
        ' <small>of ' + ROOM.targetDays + ' business days</small></div>' +
        '<div class="l">Clock started ' + esc(ROOM.signedOn) + ', 9:00am Pacific</div></div>' +
      '<div><div style="font-size:13px;color:var(--text-dim);margin-bottom:8px">' +
        c.done + ' of ' + c.total + ' checklist items complete</div>' +
        '<div class="bar"><i style="width:' + Math.round(c.done / c.total * 100) + '%"></i></div></div>' +
    '</div></div>';

  html += '<div class="card"><h2>The link <span class="sub">pasted onto the merchant account</span></h2>' +
    '<div class="lk" style="margin-bottom:11px">' + esc(ROOM.link) + '</div>' +
    '<div style="font-size:11.5px;color:var(--text-dim)">Pasted by ' + esc(ROOM.owner) +
      ' · ' + esc(ROOM.signedOn) + ', 10:12am</div></div>';

  html += note('info', 'ℹ', '<b>Two of these three steps run themselves.</b> ' +
    'The room is created and the link is sent to ' + esc(SUPPORT.mailbox) +
    ' without anyone asking. Copying it onto the merchant account is one paste, for now, ' +
    'until the portal can accept the link over an API.');
  return html;
};

VIEWS.close = function () {
  var c = counts();
  var ready = c.done === c.total;
  var closed = recall('closed', null);

  var html = crumbs([{ r: 'board', t: ROOM.merchant }, { t: 'Closure' }]);

  if (closed) {
    html += head(ROOM.merchant + ' is live',
      'Closed by ' + esc(ROOM.owner) + ' · ' + esc(closed.at),
      '<span class="tag done">' + closed.days + ' of ' + ROOM.targetDays + ' days</span>');
    html += '<div class="card"><div class="grid2" style="align-items:center">' +
      '<div><div style="font-size:13px;color:var(--text-dim);margin-bottom:8px">' +
        c.total + ' of ' + c.total + ' checklist items complete</div>' +
        '<div class="bar ok"><i style="width:100%"></i></div></div>' +
      '<div class="stat"><div class="n">' + closed.days + ' <small>business days</small></div>' +
        '<div class="l">Against a ' + ROOM.targetDays + ' day target</div></div>' +
    '</div></div>';
    html += '<div class="card frozen"><h2>What happened to the record</h2>' +
      CLOSURE.map(function (s) {
        return '<div class="item flat"><span class="box done"></span><span class="lab">' +
          '<span class="t">' + esc(s.t) + '</span><span class="m">' + esc(s.d) + '</span></span></div>';
      }).join('') + '</div>';
    html += note('ok', '✓', '<b>Back to where we started.</b> A deal closed, a room appeared, ' +
      'and ' + closed.days + ' days later there is one durable record of how it went, ' +
      'without anyone assembling it.');
    html += '<div class="btn-row"><button class="btn" onclick="reopenRoom()">Reopen for the demonstration</button>' +
      '<span class="hint">Nothing in a real closure is reversible from here.</span></div>';
    return html;
  }

  html += head('Close the onboarding',
    ready ? 'Everything is complete. This is the last step.'
          : c.total - c.done + ' item' + (c.total - c.done === 1 ? '' : 's') + ' still open',
    ready ? '<span class="tag done">Ready</span>' : '<span class="tag">Not yet</span>');

  html += '<div class="card"><div class="grid2" style="align-items:center">' +
    '<div><div style="font-size:13px;color:var(--text-dim);margin-bottom:8px">' +
      c.done + ' of ' + c.total + ' checklist items complete</div>' +
      '<div class="bar' + (ready ? ' ok' : '') + '"><i style="width:' +
        Math.round(c.done / c.total * 100) + '%"></i></div></div>' +
    '<div class="stat"><div class="n">' + ROOM.dayNow + ' <small>business days so far</small></div>' +
      '<div class="l">Against a ' + ROOM.targetDays + ' day target</div></div>' +
  '</div></div>';

  html += '<div class="card"><h2>What closing does</h2>' +
    CLOSURE.map(function (s) {
      return '<div class="item flat"><span class="box"></span><span class="lab">' +
        '<span class="t">' + esc(s.t) + '</span><span class="m">' + esc(s.d) + '</span></span></div>';
    }).join('') + '</div>';

  html += '<div class="btn-row">' +
    '<button class="btn go" ' + (ready ? '' : 'disabled') + ' onclick="closeRoom()">' +
      'Close the onboarding</button>' +
    '<span class="hint">' + (ready
      ? esc(ROOM.short) + '’s contacts lose access this afternoon.'
      : 'Every item has to be complete first.') + '</span></div>';

  if (!ready) {
    html += '<div style="height:14px"></div>' +
      note('info', 'ℹ', 'Open items are listed on the ' +
        '<a href="#board" onclick="go(\'board\');return false;">status board</a>. ' +
        'Tick the last one and this button comes alive.');
  }
  return html;
};

function closeRoom() {
  store('closed', { at: nowStamp(), days: ROOM.dayNow });
  go('close', true);
}
function reopenRoom() {
  forget('closed');
  go('close', true);
}

/* ══════════════════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  portalFromUrl();
  renderAuthAside();
  renderDemoList();

  document.getElementById('send-code').addEventListener('click', sendCode);
  document.getElementById('verify').addEventListener('click', verify);
  document.getElementById('resend').addEventListener('click', resendCode);
  document.getElementById('back-to-email').addEventListener('click', backToEmail);
  document.getElementById('email').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendCode();
  });

  var who = liveSession();
  if (who) openRoom(who.id);
  else document.getElementById('email').focus();
});
