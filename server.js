// 내 컴퓨터에서 테스트하는 서버 (Vercel에 올릴 때는 사용되지 않음)
// 실행: node server.js  →  http://localhost:3000
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// .env 파일 읽기 (외부 패키지 없이)
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const apis = {
  '/api/weather': (await import('./api/weather.js')).default,
  '/api/air': (await import('./api/air.js')).default,
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (apis[url.pathname]) {
    // Vercel 함수와 같은 모양으로 맞춰주기
    req.query = Object.fromEntries(url.searchParams);
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
    try { await apis[url.pathname](req, res); }
    catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  const file = path.join(ROOT, 'public', url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!file.startsWith(path.join(ROOT, 'public'))) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});

const PORT = process.env.PORT || 7171;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`\n  ⚠️  ${PORT}번 포트를 이미 다른 프로그램이 쓰고 있어요.`);
    console.log('  이미 실행 중인 검은 창이 있다면 그 창을 닫고 다시 실행하세요.\n');
  } else console.log(e);
});
server.listen(PORT, () => {
  console.log(`\n  ⛅ 경기도 날씨 사이트 실행 중: http://localhost:${PORT}`);
  console.log(process.env.SERVICE_KEY ? '  ✅ 인증키 적용됨 (실제 데이터)\n' : '  ⚠️  인증키 없음 → 샘플 데이터로 표시 (.env 파일을 만들어 주세요)\n');
});
