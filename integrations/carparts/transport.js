const { spawn } = require('child_process');
const path = require('path');
const { gzipSync, gunzipSync } = require('zlib');
function bridge(request, { timeout = 180000, maxBytes = 160 * 1024 * 1024 } = {}) {
  const base = process.env.CARPARTS_SSH_DIR || '/etc/carisma';
  const args = [
    '-F',
    '/dev/null',
    '-i',
    path.join(base, 'carparts_ed25519'),
    '-o',
    'IdentitiesOnly=yes',
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=yes',
    '-o',
    `UserKnownHostsFile=${path.join(base, 'carparts_known_hosts')}`,
    '-o',
    'ConnectTimeout=10',
    '-o',
    'ServerAliveInterval=30',
    '-o',
    'ServerAliveCountMax=6',
    '-p',
    '22022',
    'CACHE@127.0.0.1',
    'bridge',
  ];
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let parts = [],
      err = '',
      bytes = 0,
      settled = false;
    const fail = e => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        child.kill('SIGKILL');
        reject(e);
      }
    };
    const timer = setTimeout(
      () => fail(Error('Checkmate bridge timeout; verify state before retry')),
      timeout,
    );
    child.on('error', fail);
    child.stdin.on('error', fail);
    child.stdout.on('data', d => {
      bytes += d.length;
      if (bytes > maxBytes) return fail(Error('Checkmate response too large'));
      parts.push(d);
    });
    child.stderr.on('data', d => {
      if (err.length < 4000) err += d.toString();
    });
    child.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const text = Buffer.concat(parts)
          .toString('utf8')
          .replace(/^\uFEFF/, '')
          .trim();
        const result = JSON.parse(
          text.startsWith('gzip:')
            ? gunzipSync(Buffer.from(text.slice(5), 'base64'), {
                maxOutputLength: maxBytes,
              }).toString('utf8')
            : text,
        );
        if (code !== 0) throw Error(result.error || `Checkmate SSH exit ${code}: ${err}`);
        resolve(result);
      } catch (e) {
        reject(Error(`Checkmate bridge: ${e.message}; exit=${code}; ${err.slice(0, 1000)}`));
      }
    });
    child.stdin.end(
      'gzip:' + gzipSync(Buffer.from(JSON.stringify(request))).toString('base64') + '\n',
    );
  });
}
module.exports = { bridge };
