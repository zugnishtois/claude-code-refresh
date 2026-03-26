const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const pinger = require('./pinger');
const store = require('./store');

let cronTask = null;
let intervalTimer = null;
let state = {
  nextPingTime: null,
  lastPingResult: null,
  isRunning: false,
  isPaused: false
};

function buildCronExpression(config) {
  const minutes = [...new Set(config.scheduleTimes.map(t => parseInt(t.split(':')[1])))];
  const hours = [...new Set(config.scheduleTimes.map(t => parseInt(t.split(':')[0])))];
  return `${minutes.join(',')} ${hours.join(',')} * * *`;
}

function computeNextScheduledTime(config) {
  const now = new Date();
  const times = config.scheduleTimes
    .map(t => {
      const [h, m] = t.split(':').map(Number);
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      return d;
    })
    .sort((a, b) => a - b);

  const next = times.find(t => t > now);
  if (next) return next.toISOString();

  const tomorrow = new Date(times[0]);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString();
}

function scheduleNextInterval(config) {
  if (state.isPaused) return;

  const intervalMs = config.intervalMinutes * 60 * 1000;
  const history = store.loadHistory();
  const lastPing = history.entries.length > 0 ? history.entries[0] : null;

  let nextTime;
  if (lastPing) {
    nextTime = new Date(lastPing.timestamp).getTime() + intervalMs;
    if (nextTime <= Date.now()) {
      nextTime = Date.now() + 3000;
    }
  } else {
    nextTime = Date.now() + intervalMs;
  }

  state.nextPingTime = new Date(nextTime).toISOString();
  const delay = Math.max(nextTime - Date.now(), 1000);

  console.log(`Next interval ping in ${Math.round(delay / 60000)}m at ${state.nextPingTime}`);

  intervalTimer = setTimeout(async () => {
    await executePing('scheduled');
    const freshConfig = store.loadConfig();
    if (!freshConfig.paused && !freshConfig.scheduleTimes) {
      scheduleNextInterval(freshConfig);
    }
  }, delay);
}

async function executePing(trigger = 'scheduled') {
  if (state.isRunning) return state.lastPingResult;

  state.isRunning = true;
  console.log(`[${new Date().toISOString()}] Pinging Claude (${trigger})...`);

  try {
    const result = await pinger.ping();
    result.id = uuidv4();
    result.trigger = trigger;

    state.lastPingResult = result;
    store.addHistoryEntry(result);

    console.log(`[${result.timestamp}] Ping ${result.status} (${result.duration_ms}ms)`);
    return result;
  } catch (err) {
    console.error('Ping execution error:', err.message);
    return null;
  } finally {
    state.isRunning = false;
    const config = store.loadConfig();
    if (!config.paused) {
      if (config.scheduleTimes && config.scheduleTimes.length > 0) {
        state.nextPingTime = computeNextScheduledTime(config);
      }
      // For interval mode, nextPingTime is set by scheduleNextInterval
    } else {
      state.nextPingTime = null;
    }
  }
}

function start(config) {
  stop();

  state.isPaused = config.paused;
  if (config.paused) {
    state.nextPingTime = null;
    console.log('Scheduler started in PAUSED state');
    return;
  }

  if (config.scheduleTimes && config.scheduleTimes.length > 0) {
    const expression = buildCronExpression(config);
    console.log(`Scheduler starting with cron: ${expression} (tz: ${config.timezone})`);
    cronTask = cron.schedule(expression, () => executePing('scheduled'), {
      timezone: config.timezone
    });
    state.nextPingTime = computeNextScheduledTime(config);
  } else {
    console.log(`Scheduler starting with interval: ${config.intervalMinutes}m (tz: ${config.timezone})`);
    scheduleNextInterval(config);
  }

  console.log(`Next ping: ${state.nextPingTime}`);
}

function stop() {
  if (cronTask) { cronTask.stop(); cronTask = null; }
  if (intervalTimer) { clearTimeout(intervalTimer); intervalTimer = null; }
}

function reschedule(config) {
  start(config);
}

function pause() {
  const config = store.loadConfig();
  config.paused = true;
  store.saveConfig(config);
  state.isPaused = true;
  stop();
  state.nextPingTime = null;
}

function resume() {
  const config = store.loadConfig();
  config.paused = false;
  store.saveConfig(config);
  start(config);
}

function getState() {
  return { ...state };
}

module.exports = { start, stop, reschedule, pause, resume, executePing, getState };
