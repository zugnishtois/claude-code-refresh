const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const HISTORY_PATH = path.join(DATA_DIR, 'history.json');
const MAX_HISTORY = 200;

const DEFAULT_CONFIG = {
  intervalMinutes: 245,
  scheduleTimes: null,
  paused: false,
  timezone: 'UTC'
};

const DEFAULT_HISTORY = { entries: [] };

let configCache = null;
let historyCache = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filePath, defaults) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { ...defaults };
  }
}

function writeJSON(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function loadConfig() {
  if (!configCache) {
    ensureDataDir();
    configCache = readJSON(CONFIG_PATH, DEFAULT_CONFIG);
    // Migrate old intervalHours to intervalMinutes
    if (configCache.intervalHours && !configCache.intervalMinutes) {
      configCache.intervalMinutes = configCache.intervalHours * 60;
      delete configCache.intervalHours;
      writeJSON(CONFIG_PATH, configCache);
    }
  }
  return configCache;
}

function saveConfig(config) {
  configCache = { ...config };
  writeJSON(CONFIG_PATH, configCache);
  return configCache;
}

function loadHistory() {
  if (!historyCache) {
    ensureDataDir();
    historyCache = readJSON(HISTORY_PATH, DEFAULT_HISTORY);
  }
  return historyCache;
}

function addHistoryEntry(entry) {
  const history = loadHistory();
  history.entries.unshift(entry);
  if (history.entries.length > MAX_HISTORY) {
    history.entries = history.entries.slice(0, MAX_HISTORY);
  }
  historyCache = history;
  writeJSON(HISTORY_PATH, historyCache);
  return entry;
}

function clearHistory() {
  historyCache = { entries: [] };
  writeJSON(HISTORY_PATH, historyCache);
}

module.exports = { loadConfig, saveConfig, loadHistory, addHistoryEntry, clearHistory, DEFAULT_CONFIG };
