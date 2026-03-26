const { exec } = require('child_process');

const TIMEOUT_MS = 60_000;

function ping() {
  return new Promise((resolve) => {
    const start = Date.now();

    console.log('> claude -p hi');

    exec('claude -p hi', { timeout: TIMEOUT_MS, env: { ...process.env, NO_COLOR: '1' } }, (err, stdout, stderr) => {
      const duration_ms = Date.now() - start;
      const timestamp = new Date().toISOString();

      if (stdout && stdout.trim()) console.log('Claude: ' + stdout.trim());
      if (stderr && stderr.trim()) console.log('stderr: ' + stderr.trim());

      if (err && err.killed) {
        console.log('TIMEOUT after ' + duration_ms + 'ms');
        return resolve({
          success: false,
          status: 'timeout',
          exitCode: null,
          stdout: (stdout || '').slice(0, 500),
          stderr: (stderr || '').slice(0, 500),
          duration_ms,
          timestamp
        });
      }

      if (err && err.code === 'ENOENT') {
        console.log('CLI not found: ' + err.message);
        return resolve({
          success: false,
          status: 'cli_error',
          exitCode: null,
          stdout: '',
          stderr: err.message,
          duration_ms,
          timestamp
        });
      }

      const exitCode = err ? err.code : 0;
      const isAuthError = /auth|credential|oauth|login/i.test(stderr || '');
      const gotResponse = stdout && stdout.trim().length > 0;
      const status = gotResponse ? 'success' : (isAuthError ? 'auth_error' : (err ? 'error' : 'success'));

      console.log(`Result: ${status} (exit=${exitCode}, ${duration_ms}ms)`);

      resolve({
        success: gotResponse || !err,
        status,
        exitCode,
        stdout: (stdout || '').slice(0, 500),
        stderr: (stderr || '').slice(0, 500),
        duration_ms,
        timestamp
      });
    });
  });
}

module.exports = { ping };
