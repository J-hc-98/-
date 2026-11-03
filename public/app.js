import { CITIES, nearestCity } from './cities.js';

const $ = (id) => document.getElementById(id);
const select = $('city');

// ---------- 표시용 변환 ----------
const PTY = { 1: ['🌧️', '비'], 2: ['🌨️', '비/눈'], 3: ['❄️', '눈'], 4: ['🌦️', '소나기'], 5: ['🌦️', '빗방울'], 6: ['🌨️', '빗방울·눈날림'], 7: ['❄️', '눈날림'] };
function skyInfo(sky, pty, hour = new Date().getHours()) {
  if (pty > 0 && PTY[pty]) return PTY[pty];
  const night = hour < 6 || hour >= 19;
  if (sky === 1) return [night ? '🌙' : '☀️', '맑음'];
  if (sky === 3) return [night ? '☁️' : '⛅', '구름많음'];
  return ['☁️', '흐림'];
}

// 환경부 통합대기 기준
function pmGrade(v, type) {
  if (v == null || isNaN(v)) return { label: '정보없음', cls: '', level: -1 };
  const cut = type === 'pm10' ? [30, 80, 150] : [15, 35, 75];
  if (v <= cut[0]) return { label: '좋음', cls: 'g-good', level: 0, max: cut[2] * 1.3 };
  if (v <= cut[1]) return { label: '보통', cls: 'g-ok', level: 1, max: cut[2] * 1.3 };
  if (v <= cut[2]) return { label: '나쁨', cls: 'g-warn', level: 2, max: cut[2] * 1.3 };
  return { label: '매우나쁨', cls: 'g-bad', level: 3, max: cut[2] * 1.3 };
}

// ---------- 외출 판단 ----------
function verdict(w, a) {
  let level = 0;
  const chips = [];
  const bump = (n) => { level = Math.max(level, n); };

  if (a) {
    const worst = Math.max(pmGrade(a.pm10, 'pm10').level, pmGrade(a.pm25, 'pm25').level);
    if (worst === 3) { bump(2); chips.push('😷 미세먼지 매우나쁨, KF94 마스크'); }
    else if (worst === 2) { bump(1); chips.push('😷 마스크 챙기세요'); }
  }
  if (w) {
    const t = w.current.temp, pop = w.today.pop;
    if (w.current.pty > 0) { bump(1); chips.push('☂️ 지금 비·눈이 와요'); }
    else if (pop >= 60) { bump(1); chips.push(`☂️ 우산 챙기세요 (강수 ${pop}%)`); }
    else if (pop >= 30) chips.push(`🌂 작은 우산 있으면 좋아요 (${pop}%)`);

    if (t <= -10) { bump(2); chips.push('🥶 한파, 외출 최소화'); }
    else if (t <= 0) chips.push('🧤 장갑·목도리 챙기세요');
    else if (t <= 5) chips.push('🧥 두꺼운 외투 입으세요');
    else if (t <= 12) chips.push('🧥 가벼운 겉옷 챙기세요');
    else if (t >= 33) { bump(1); chips.push('🥵 폭염, 물 꼭 챙기세요'); }
    else if (t >= 28) chips.push('💧 더워요, 물 챙기세요');

    if (w.today.min != null && w.today.max != null && w.today.max - w.today.min >= 10)
      chips.push(`🌡️ 일교차 ${Math.round(w.today.max - w.today.min)}°, 겉옷 필수`);
    if (w.current.wind >= 9) { bump(1); chips.push('💨 바람이 강해요'); }
  }
  if (chips.length === 0) chips.push('😊 가볍게 나가세요');

  const titles = ['외출하기 좋은 날이에요', '나가도 괜찮아요, 챙길 게 있어요', '오늘은 실내가 좋겠어요'];
  const emojis = ['😎', '🎒', '🏠'];
  return { level, title: titles[level], emoji: emojis[level], chips };
}

// ---------- 렌더링 ----------
function renderWeather(w) {
  const [icon, text] = skyInfo(w.current.sky, w.current.pty);
  $('nowIcon').textContent = icon;
  $('nowTemp').textContent = `${Math.round(w.current.temp)}°`;
  $('nowSky').textContent = text;
  const f = (v) => (v == null ? '--' : `${Math.round(v)}°`);
  $('minmax').textContent = `${f(w.today.min)} / ${f(w.today.max)}`;
  $('pop').textContent = `${w.today.pop}%`;
  $('hum').textContent = `${w.current.humidity}%`;
  $('wind').textContent = `${w.current.wind} m/s`;

  let lastDate = null;
  $('hours').innerHTML = w.hours.map((h, i) => {
    const hr = Number(h.time.slice(0, 2));
    const [ic] = skyInfo(h.sky, h.pty, hr);
    const dayLabel = lastDate && h.date !== lastDate ? '<div class="h-day">내일</div>' : '';
    lastDate = h.date;
    return `<li>${dayLabel}<div class="h-time">${i === 0 ? '지금' : hr + '시'}</div>
      <div class="h-icon">${ic}</div><div class="h-temp">${h.temp}°</div>
      <div class="h-pop">${h.pop >= 20 ? '💧' + h.pop + '%' : ''}</div></li>`;
  }).join('');
}

function renderAir(a) {
  for (const type of ['pm10', 'pm25']) {
    const el = $(type), v = a[type], g = pmGrade(v, type);
    el.className = `air-item ${g.cls}`;
    el.querySelector('.air-grade').textContent = g.label;
    el.querySelector('.air-val').textContent = v == null ? '측정값 없음' : `${v} ㎍/㎥`;
    el.querySelector('.bar i').style.width = v == null ? '0' : `${Math.min(100, (v / g.max) * 100)}%`;
  }
}

function renderVerdict(city, w, a) {
  const v = verdict(w, a);
  $('verdict').className = `verdict lv-${v.level}`;
  $('vEmoji').textContent = v.emoji;
  $('vCity').textContent = `경기도 ${city}`;
  $('vTitle').textContent = v.title;
  $('vChips').innerHTML = v.chips.map((c) => `<li>${c}</li>`).join('');
}

async function getJSON(url) {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({ error: '응답을 읽을 수 없어요' }));
  if (!r.ok || j.error) throw new Error(j.error || `요청 실패 (${r.status})`);
  return j;
}

let reqId = 0;
async function load(city) {
  const id = ++reqId;
  document.body.classList.add('loading');
  $('wErr').hidden = $('aErr').hidden = true;
  const q = encodeURIComponent(city);
  const [wr, ar] = await Promise.allSettled([getJSON(`api/weather?city=${q}`), getJSON(`api/air?city=${q}`)]);
  if (id !== reqId) return; // 그 사이 다른 지역을 골랐으면 무시
  document.body.classList.remove('loading');

  const w = wr.status === 'fulfilled' ? wr.value : null;
  const a = ar.status === 'fulfilled' ? ar.value : null;
  if (w) renderWeather(w); else { $('wErr').textContent = wr.reason.message; $('wErr').hidden = false; }
  if (a) renderAir(a); else { $('aErr').textContent = ar.reason.message; $('aErr').hidden = false; }

  if (w || a) renderVerdict(city, w, a);
  else {
    $('verdict').className = 'verdict lv-1';
    $('vEmoji').textContent = '⚠️'; $('vTitle').textContent = '정보를 불러오지 못했어요'; $('vChips').innerHTML = '';
  }
  const demo = (w && w.demo) ? w : (a && a.demo) ? a : null;
  $('demo').hidden = !demo;
  if (demo) {
    $('demo').innerHTML = demo.demoReason === 'preview'
      ? '<b>미리보기 모드</b>(SYAPP_PREVIEW=1) — 외부 API 대신 모의 데이터를 보여주고 있어요.'
      : '지금은 <b>샘플 데이터</b>를 보여주고 있어요. 서버에 인증키(<code>WEATHER_API_KEY</code>)를 설정하면 실제 날씨가 나와요.';
  }

  const parts = [];
  if (w && !w.demo) parts.push(`예보 발표 ${w.updated.slice(4, 6)}/${w.updated.slice(6, 8)} ${w.updated.slice(9, 11)}시`);
  if (a && !a.demo) parts.push(`미세먼지 ${a.time}`);
  $('updated').textContent = parts.join(' · ');
}

// ---------- 시작 ----------
const sorted = [...CITIES].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
select.innerHTML = sorted.map((c) => `<option>${c.name}</option>`).join('');

let saved = null;
try { saved = localStorage.getItem('gg-city'); } catch {}
select.value = CITIES.some((c) => c.name === saved) ? saved : '수원시';

function choose(name) {
  select.value = name;
  try { localStorage.setItem('gg-city', name); } catch {}
  load(name);
}
select.addEventListener('change', () => choose(select.value));

// alert()는 iframe sandbox에서 막히므로 버튼 글자로 잠깐 안내
function locateFail(msg) {
  const btn = $('locate');
  btn.disabled = false;
  btn.textContent = `📍 ${msg} · 목록에서 선택`;
  setTimeout(() => { btn.textContent = '📍 내 위치'; }, 4000);
}

$('locate').addEventListener('click', () => {
  if (!navigator.geolocation) return locateFail('위치 기능 없음');
  const btn = $('locate');
  btn.disabled = true; btn.textContent = '📍 찾는 중…';
  navigator.geolocation.getCurrentPosition(
    (p) => {
      btn.disabled = false; btn.textContent = '📍 내 위치';
      choose(nearestCity(p.coords.latitude, p.coords.longitude).name);
    },
    () => locateFail('위치 사용 불가'),
    { timeout: 8000 },
  );
});

load(select.value);
