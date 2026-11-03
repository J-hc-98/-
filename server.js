// 운영 서버 (SYPlatform·Windows 서버·내 컴퓨터 공용)
// 실행: npm run start
//   - HOST(기본 127.0.0.1), PORT 환경변수 또는 --urls http://127.0.0.1:5000 인자를 사용
//   - Vercel에 배포할 때는 이 파일을 쓰지 않고 api/ 폴더의 함수가 직접 실행됨
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');

// 내 컴퓨터 테스트용: .env 파일이 있으면 읽기 (운영 서버에서는 플랫폼이 환경변수를 전달)
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] !== '' && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env 없음 */ }

// --urls 인자 (예: --urls http://127.0.0.1:5000)
function parseUrlsArg(argv) {
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i] === '--urls' ? argv[i + 1] : argv[i].startsWith('--urls=') ? argv[i].slice(7) : null;
    if (!v) continue;
    try {
      const u = new URL(v.split(/[;,]/)[0].trim().replace('://+', '://0.0.0.0').replace('://*', '://0.0.0.0'));
      return { host: u.hostname.replace(/^\[|\]$/g, ''), port: Number(u.port) || 80 };
    } catch { /* 무시 */ }
  }
  return null;
}
const urlsArg = parseUrlsArg(process.argv.slice(2));
const HOST = process.env.HOST || urlsArg?.host || '127.0.0.1';
const PORT = Number(process.env.PORT || urlsArg?.port || 7171);

const apis = {
  '/api/weather': (await import('./api/weather.js')).default,
  '/api/air': (await import('./api/air.js')).default,
};
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
};

// SYPlatform 제한 프록시(/apps/<서비스번호>/<접근토큰>/...)가 접두어를 그대로 넘겨도 동작하도록 제거
function stripPlatformPrefix(p) {
  const m = p.match(/^\/apps\/[^/]+\/[^/]+(\/.*)?$/);
  return m ? (m[1] || '/') : p;
}

const server = http.createServer(async (req, res) => {
  // iframe sandbox(origin "null")에서도 화면 모듈 스크립트와 API를 불러올 수 있게 허용.
  // 이 서비스는 쿠키·로그인을 쓰지 않으므로 '*' 허용이 위험을 만들지 않습니다.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  let pathname = '/';
  try {
    const url = new URL(req.url, 'http://localhost');
    pathname = stripPlatformPrefix(url.pathname);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      return res.end();
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }

    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (apis[pathname]) {
      // Vercel 함수와 같은 모양(req.query, res.status().json())으로 맞춰 호출
      req.query = Object.fromEntries(url.searchParams);
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
      return await apis[pathname](req, res);
    }

    const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const file = path.resolve(PUBLIC_DIR, rel);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
      const ext = path.extname(file);
      res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
      res.end(data);
    });
  } catch (e) {
    console.error(`[error] ${req.method} ${pathname}: ${e.message}`);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '서버 오류가 발생했습니다.' }));
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.log(`\n  ⚠️  ${PORT}번 포트를 이미 다른 프로그램이 쓰고 있어요. 실행 중인 다른 서버 창을 닫고 다시 실행하세요.\n`);
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const preview = ['1', 'true'].includes(String(process.env.SYAPP_PREVIEW || '').toLowerCase());
  const hasKey = Boolean(process.env.WEATHER_API_KEY || process.env.SERVICE_KEY);
  console.log(`\n  ⛅ 경기도 날씨 사이트 실행 중: http://${HOST}:${PORT}`);
  if (preview) console.log('  🧪 미리보기 모드(SYAPP_PREVIEW=1): 외부 API 대신 모의 응답을 사용합니다.\n');
  else console.log(hasKey ? '  ✅ 인증키 적용됨 (실제 데이터)\n' : '  ⚠️  인증키(WEATHER_API_KEY) 없음 → 샘플 데이터로 표시\n');
});

const stop = () => { server.close(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
