const MAX_LINES = 500;
const lines = [];
let lineId = 0;

function add(text) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const entry = { id: ++lineId, ts, text };
  lines.push(entry);
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
}

function getSince(sinceId) {
  const newLines = lines.filter(l => l.id > sinceId);
  return { lines: newLines, lastId: lineId };
}

// Intercept console.log and console.error
const origLog = console.log;
const origError = console.error;

console.log = function (...args) {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  add(msg);
  origLog.apply(console, args);
};

console.error = function (...args) {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  add('[ERROR] ' + msg);
  origError.apply(console, args);
};

module.exports = { add, getSince };
