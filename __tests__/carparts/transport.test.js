const { EventEmitter } = require('events');
const { gzipSync, gunzipSync } = require('zlib');
jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');
const { bridge } = require('../../integrations/carparts/transport');
let child;
beforeEach(() => {
  child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = new EventEmitter();
  child.stdin.write = jest.fn();
  child.stdin.end = jest.fn();
  child.kill = jest.fn();
  spawn.mockReturnValue(child);
});
test('uses an opaque compressed command with stdin disabled and decodes chunked output', async () => {
  const request = { action: 'stock', guids: ['example'] };
  const promise = bridge(request);
  const [program, args, options] = spawn.mock.calls.at(-1);
  expect(program).toBe('ssh');
  expect(options.stdio[0]).toBe('ignore');
  const payload = args.at(-1);
  expect(payload).toMatch(/^gzip:[A-Za-z0-9+/=]+$/);
  expect(JSON.parse(gunzipSync(Buffer.from(payload.slice(5), 'base64')).toString())).toEqual(request);
  const output = 'gzip:' + gzipSync(Buffer.from('{"ok":true}')).toString('base64');
  child.stdout.emit('data', Buffer.from(output.slice(0, 10)));
  child.stdout.emit('data', Buffer.from(output.slice(10)));
  child.emit('close', 0);
  await expect(promise).resolves.toEqual({ ok: true });
  expect(child.stdin.write).not.toHaveBeenCalled();
});
test('a failed native response is propagated without an automatic transport replay', async () => {
  const promise = bridge({ action: 'stock' });
  child.stdout.emit('data', Buffer.from('{"ok":false,"error":"Unavailable"}'));
  child.emit('close', 1);
  await expect(promise).rejects.toThrow('Unavailable');
});
test('oversized response terminates the process', async () => {
  const promise = bridge({ action: 'stock' }, { maxBytes: 10 });
  child.stdout.emit('data', Buffer.alloc(11));
  await expect(promise).rejects.toThrow('response too large');
  expect(child.kill).toHaveBeenCalled();
});
