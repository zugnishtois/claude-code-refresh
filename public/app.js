// --- i18n ---
const T = {
  en: {
    title: 'Claude Code Refresh',
    subtitle: 'Rate limit window pre-warmer',
    lastPing: 'Last Ping',
    nextPingIn: 'Next Ping In',
    status: 'Status',
    pingNow: 'Ping Now',
    pause: 'Pause',
    resume: 'Resume',
    settings: 'Settings',
    mode: 'Mode',
    everyInterval: 'Every interval',
    specificTimes: 'Specific times',
    hours: 'Hours',
    minutes: 'Minutes',
    scheduledTimes: 'Scheduled Times',
    timezone: 'Timezone',
    saveSettings: 'Save Settings',
    history: 'History',
    clear: 'Clear',
    time: 'Time',
    trigger: 'Trigger',
    duration: 'Duration',
    loadMore: 'Load More',
    paused: 'Paused',
    active: 'Active',
    waiting: 'Waiting',
    pinging: 'Pinging...',
    authError: 'Auth Error',
    error: 'Error',
    schedulerPaused: 'Scheduler is paused',
    requestInProgress: 'Request in progress',
    noPingsYet: 'No pings yet',
    lastPingSucceeded: 'Last ping succeeded',
    sshLogin: 'SSH in and run: claude login',
    lastPingFailed: 'Last ping failed',
    never: 'Never',
    addTime: '+ Add Time',
    clearAll: 'Clear all history?',
    settingsSaved: 'Settings saved',
    addAtLeastOneTime: 'Add at least one time slot',
    login: 'Login',
    password: 'Password',
    loginButton: 'Sign In',
    wrongPassword: 'Wrong password',
    terminal: 'Terminal',
    langSwitch: 'עב'
  },
  he: {
    title: 'רענון קלוד קוד',
    subtitle: 'מחמם מראש את חלון מגבלת השימוש',
    lastPing: 'פינג אחרון',
    nextPingIn: 'פינג הבא בעוד',
    status: 'סטטוס',
    pingNow: 'פינג עכשיו',
    pause: 'השהה',
    resume: 'המשך',
    settings: 'הגדרות',
    mode: 'מצב',
    everyInterval: 'כל פרק זמן',
    specificTimes: 'זמנים ספציפיים',
    hours: 'שעות',
    minutes: 'דקות',
    scheduledTimes: 'זמנים מתוזמנים',
    timezone: 'אזור זמן',
    saveSettings: 'שמור הגדרות',
    history: 'היסטוריה',
    clear: 'נקה',
    time: 'זמן',
    trigger: 'טריגר',
    duration: 'משך',
    loadMore: 'טען עוד',
    paused: 'מושהה',
    active: 'פעיל',
    waiting: 'ממתין',
    pinging: '...שולח פינג',
    authError: 'שגיאת אימות',
    error: 'שגיאה',
    schedulerPaused: 'המתזמן מושהה',
    requestInProgress: 'בקשה בתהליך',
    noPingsYet: 'אין פינגים עדיין',
    lastPingSucceeded: 'הפינג האחרון הצליח',
    sshLogin: 'claude login התחבר ב-SSH והרץ',
    lastPingFailed: 'הפינג האחרון נכשל',
    never: 'אף פעם',
    addTime: '+ הוסף זמן',
    clearAll: 'לנקות את כל ההיסטוריה?',
    settingsSaved: 'ההגדרות נשמרו',
    addAtLeastOneTime: 'הוסף לפחות זמן אחד',
    login: 'התחברות',
    password: 'סיסמה',
    loginButton: 'כניסה',
    wrongPassword: 'סיסמה שגויה',
    terminal: 'טרמינל',
    langSwitch: 'EN'
  }
};

let lang = localStorage.getItem('lang') || 'en';
let authToken = localStorage.getItem('authToken') || null;
let currentStatus = null;
let historyOffset = 0;
const HISTORY_PAGE = 50;

// --- Auth ---

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (authToken) h['Authorization'] = 'Bearer ' + authToken;
  return h;
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth-check', { headers: authHeaders() });
    const data = await res.json();
    if (!data.authRequired || data.authenticated) {
      showDashboard();
    } else {
      showLogin();
    }
  } catch {
    showDashboard();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (res.ok) {
      if (data.token) {
        authToken = data.token;
        localStorage.setItem('authToken', authToken);
      }
      showDashboard();
    } else {
      errEl.classList.remove('hidden');
    }
  } catch {
    errEl.classList.remove('hidden');
  }
}

function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  initDashboard();
}

// --- i18n ---

function t(key) {
  return T[lang][key] || T['en'][key] || key;
}

function applyLang() {
  const html = document.documentElement;
  html.lang = lang === 'he' ? 'he' : 'en';
  html.dir = lang === 'he' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  document.getElementById('langLabel').textContent = t('langSwitch');
  localStorage.setItem('lang', lang);
}

function toggleLang() {
  lang = lang === 'en' ? 'he' : 'en';
  applyLang();
  if (currentStatus) renderStatus();
}

// --- API ---

async function apiFetch(url, opts = {}) {
  opts.headers = { ...authHeaders(), ...opts.headers };
  const res = await fetch(url, opts);
  if (res.status === 401) {
    authToken = null;
    localStorage.removeItem('authToken');
    showLogin();
    throw new Error('unauthorized');
  }
  return res;
}

let wasRunning = false;

async function fetchStatus() {
  try {
    const res = await apiFetch('/api/status');
    currentStatus = await res.json();
    renderStatus();
    // Refresh history when a ping just finished
    if (wasRunning && !currentStatus.isRunning) {
      fetchHistory();
    }
    wasRunning = currentStatus.isRunning;
  } catch {}
}

async function fetchHistory(append = false) {
  try {
    const res = await apiFetch(`/api/history?limit=${HISTORY_PAGE}&offset=${append ? historyOffset : 0}`);
    const data = await res.json();
    if (!append) historyOffset = 0;
    renderHistory(data, append);
    historyOffset += data.entries.length;
    document.getElementById('btnLoadMore').style.display =
      historyOffset < data.total ? 'block' : 'none';
  } catch {}
}

async function fetchConfig() {
  try {
    const res = await apiFetch('/api/config');
    const config = await res.json();
    renderConfig(config);
  } catch {}
}

// --- Rendering ---

function renderStatus() {
  const s = currentStatus;
  if (!s) return;

  const lastEl = document.getElementById('lastPingTime');
  const lastSub = document.getElementById('lastPingStatus');
  if (s.lastPing) {
    lastEl.textContent = formatTime(s.lastPing.timestamp);
    lastSub.textContent = s.lastPing.status + ' (' + (s.lastPing.duration_ms / 1000).toFixed(1) + 's)';
  } else {
    lastEl.textContent = t('never');
    lastSub.textContent = t('noPingsYet');
  }

  const nextSub = document.getElementById('nextPingTime');
  if (s.nextPingTime) {
    nextSub.textContent = formatTime(s.nextPingTime);
  } else {
    nextSub.textContent = s.isPaused ? t('paused') : '--';
  }

  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const statusDetail = document.getElementById('statusDetail');
  dot.className = 'dot';

  if (s.isPaused) {
    dot.classList.add('grey');
    statusText.textContent = t('paused');
    statusDetail.textContent = t('schedulerPaused');
  } else if (s.isRunning) {
    dot.classList.add('yellow');
    statusText.textContent = t('pinging');
    statusDetail.textContent = t('requestInProgress');
  } else if (!s.lastPing) {
    dot.classList.add('grey');
    statusText.textContent = t('waiting');
    statusDetail.textContent = t('noPingsYet');
  } else if (s.lastPing.status === 'success') {
    dot.classList.add('green');
    statusText.textContent = t('active');
    statusDetail.textContent = t('lastPingSucceeded');
  } else if (s.lastPing.status === 'auth_error') {
    dot.classList.add('yellow');
    statusText.textContent = t('authError');
    statusDetail.textContent = t('sshLogin');
  } else {
    dot.classList.add('red');
    statusText.textContent = t('error');
    statusDetail.textContent = t('lastPingFailed');
  }

  const btnPause = document.getElementById('btnPause');
  btnPause.textContent = s.isPaused ? t('resume') : t('pause');

  const btnPing = document.getElementById('btnPing');
  btnPing.disabled = s.isRunning;
  if (s.isRunning) {
    btnPing.innerHTML = '<span class="spinner"></span>' + t('pinging');
  } else {
    btnPing.textContent = t('pingNow');
  }
}

function renderHistory(data, append) {
  const tbody = document.getElementById('historyBody');
  if (!append) tbody.innerHTML = '';

  data.entries.forEach(entry => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDateTime(entry.timestamp)}</td>
      <td>${entry.trigger}</td>
      <td><span class="status-badge ${entry.status}">${entry.status}</span></td>
      <td>${(entry.duration_ms / 1000).toFixed(1)}s</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderConfig(config) {
  const totalMins = config.intervalMinutes || 240;
  document.getElementById('intervalHours').value = Math.floor(totalMins / 60);
  document.getElementById('intervalMins').value = totalMins % 60;
  setTimezone(config.timezone);

  if (config.scheduleTimes && config.scheduleTimes.length > 0) {
    document.querySelector('input[name="mode"][value="times"]').checked = true;
    renderTimesSlots(config.scheduleTimes);
  } else {
    document.querySelector('input[name="mode"][value="interval"]').checked = true;
  }
  toggleMode();
}

function renderTimesSlots(times) {
  const container = document.getElementById('timesList');
  container.innerHTML = '';
  (times || []).forEach(t => addTimeSlotUI(t));
}

// --- Actions ---

async function manualPing() {
  const btn = document.getElementById('btnPing');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>' + t('pinging');

  try {
    await apiFetch('/api/ping', { method: 'POST' });
  } catch {}
  // Don't wait — the 5s status poll will pick up isRunning and result
  setTimeout(fetchStatus, 1000);
}

async function togglePause() {
  const isPaused = currentStatus?.isPaused;
  await apiFetch(isPaused ? '/api/resume' : '/api/pause', { method: 'POST' });
  await fetchStatus();
}

async function saveSettings() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const hours = parseInt(document.getElementById('intervalHours').value) || 0;
  const mins = parseInt(document.getElementById('intervalMins').value) || 0;
  const totalMins = hours * 60 + mins;

  if (mode === 'interval' && totalMins < 1) {
    alert(t('addAtLeastOneTime'));
    return;
  }

  const body = {
    intervalMinutes: totalMins,
    timezone: document.getElementById('timezone').value
  };

  if (mode === 'times') {
    const inputs = document.querySelectorAll('#timesList input[type="time"]');
    body.scheduleTimes = Array.from(inputs).map(i => i.value).filter(v => v);
    if (body.scheduleTimes.length === 0) {
      alert(t('addAtLeastOneTime'));
      return;
    }
  } else {
    body.scheduleTimes = null;
  }

  try {
    const res = await apiFetch('/api/config', {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    if (res.ok) {
      await fetchStatus();
      showToast(t('settingsSaved'));
    } else {
      const err = await res.json();
      alert('Error: ' + err.error);
    }
  } catch {}
}

async function clearHistory() {
  if (!confirm(t('clearAll'))) return;
  await apiFetch('/api/history', { method: 'DELETE' });
  await fetchHistory();
}

function loadMoreHistory() {
  fetchHistory(true);
}

// --- UI Helpers ---

function toggleMode() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  document.getElementById('intervalGroup').classList.toggle('hidden', mode !== 'interval');
  document.getElementById('timesGroup').classList.toggle('hidden', mode !== 'times');

  if (mode === 'times' && document.querySelectorAll('#timesList .time-slot').length === 0) {
    addTimeSlotUI('07:00');
  }
}

function addTimeSlot() {
  addTimeSlotUI('12:00');
}

function addTimeSlotUI(value) {
  const container = document.getElementById('timesList');
  const div = document.createElement('div');
  div.className = 'time-slot';
  div.innerHTML = `
    <input type="time" value="${value}">
    <button onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(div);
}

function setTimezone(tz) {
  const select = document.getElementById('timezone');
  if (select.options.length === 0) {
    Intl.supportedValuesOf('timeZone').forEach(z => {
      const opt = document.createElement('option');
      opt.value = z;
      opt.textContent = z.replace(/_/g, ' ');
      select.appendChild(opt);
    });
  }
  select.value = tz;
}

function formatTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDateTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${date} ${time}`;
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
    background: var(--accent); color: white; padding: 0.6rem 1.2rem;
    border-radius: 8px; font-size: 0.9rem; font-weight: 600; z-index: 1000;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// --- Countdown ---

function updateCountdown() {
  const el = document.getElementById('countdown');
  if (!currentStatus?.nextPingTime) {
    el.textContent = currentStatus?.isPaused ? t('paused') : '--:--:--';
    return;
  }

  const diff = new Date(currentStatus.nextPingTime) - Date.now();
  if (diff <= 0) {
    el.textContent = '00:00:00';
    return;
  }

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// --- Terminal ---

let lastLogId = 0;

async function fetchLogs() {
  try {
    const res = await apiFetch('/api/logs?since=' + lastLogId);
    const data = await res.json();
    if (data.lines.length > 0) {
      const terminal = document.getElementById('terminal');
      data.lines.forEach(line => {
        const div = document.createElement('div');
        const tsSpan = `<span class="log-ts">${line.ts}</span> `;

        if (line.text.startsWith('>')) {
          div.innerHTML = tsSpan + `<span class="log-cmd">${esc(line.text)}</span>`;
        } else if (line.text.startsWith('[ERROR]') || line.text.startsWith('stderr:')) {
          div.innerHTML = tsSpan + `<span class="log-err">${esc(line.text)}</span>`;
        } else if (line.text.includes('success') || line.text.startsWith('Claude:')) {
          div.innerHTML = tsSpan + `<span class="log-ok">${esc(line.text)}</span>`;
        } else {
          div.innerHTML = tsSpan + esc(line.text);
        }
        terminal.appendChild(div);
      });
      terminal.scrollTop = terminal.scrollHeight;
      lastLogId = data.lastId;
    }
  } catch {}
}

function clearTerminal() {
  document.getElementById('terminal').innerHTML = '';
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// --- Init ---

let pollInterval = null;
let countdownInterval = null;

function initDashboard() {
  if (pollInterval) return;
  fetchStatus();
  fetchConfig();
  fetchHistory();
  fetchLogs();
  pollInterval = setInterval(fetchStatus, 5000);
  countdownInterval = setInterval(updateCountdown, 1000);
  setInterval(fetchLogs, 3000);
}

applyLang();
checkAuth();
