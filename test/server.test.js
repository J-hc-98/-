// 서버 테스트: npm test
// SYAPP_PREVIEW=1 로 서버를 띄워 외부 API 없이 확인합니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAKE_KEY = 'test-key-should-never-appear-0000';
let proc, base;

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});

test.before(async () => {
  const port = await freePort();
  proc = spawn(process.execPath, ['server.js', '--urls', `http://127.0.0.1:${port}`], {
    cwd: ROOT, env: { ...process.env, HOST: '', PORT: '', SYAPP_PREVIEW: '1', WEATHER_API_KEY: FAKE_KEY, SERVICE_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  proc.stdout.on('data', (d) => { log += d; });
  proc.stderr.on('data', (d) => { log += d; });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(base + '/api/health')).ok) { proc.log = () => log; return; } } catch { /* 대기 */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('서버가 시작되지 않았습니다:\n' + log);
});
test.after(() => proc?.kill());

test('화면은 상대 경로만 사용', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /오늘 외출해도 될까/);
  assert.doesNotMatch(html, /(src|href)="\/(?!\/)/);
  const js = await (await fetch(base + '/app.js')).text();
  assert.doesNotMatch(js, /fetch\(\s*[`'"]\//);
  assert.doesNotMatch(js, /getJSON\(\s*[`'"]\//);
});

test('/apps/번호/토큰/ 프록시 접두어', async () => {
  assert.equal((await fetch(base + '/apps/7/tok_x/')).status, 200);
  assert.equal((await fetch(base + '/apps/7/tok_x/cities.js')).status, 200);
  const r = await (await fetch(base + '/apps/7/tok_x/api/weather?city=' + encodeURIComponent('성남시'))).json();
  assert.equal(r.city, '성남시');
});

test('SYAPP_PREVIEW=1 이면 모의 응답', async () => {
  const w = await (await fetch(base + '/api/weather?city=' + encodeURIComponent('수원시'))).json();
  assert.equal(w.demo, true);
  assert.equal(w.demoReason, 'preview');
  assert.ok(w.hours.length >= 12);
  const a = await (await fetch(base + '/api/air?city=' + encodeURIComponent('수원시'))).json();
  assert.equal(a.demoReason, 'preview');
});

test('sandbox iframe 대응 CORS', async () => {
  const r = await fetch(base + '/app.js', { headers: { Origin: 'null' } });
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
});

test('인증키가 응답·로그에 노출되지 않음', async () => {
  for (const p of ['/', '/app.js', '/api/weather', '/api/air', '/api/health']) {
    assert.doesNotMatch(await (await fetch(base + p)).text(), new RegExp(FAKE_KEY));
  }
  assert.doesNotMatch(proc.log(), new RegExp(FAKE_KEY));
});
