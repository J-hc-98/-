// GET /api/weather?city=수원시
// 기상청 초단기실황(현재 날씨) + 단기예보(시간별 예보, 최저/최고기온)
import { CITIES, toGrid } from '../public/cities.js';
import { sampleWeather } from '../lib/sample.js';

const BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';

// 서버가 어느 나라에 있든 한국 시간 기준으로 계산
function kstNow() {
  return new Date(Date.now() + 9 * 3600 * 1000); // getUTC*()로 읽으면 KST 값
}
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

// 초단기실황: 매시 정각 기준, 약 40분 후 제공
function ncstBase(now) {
  const d = new Date(now);
  if (d.getUTCMinutes() < 45) d.setUTCHours(d.getUTCHours() - 1);
  return { base_date: ymd(d), base_time: `${pad(d.getUTCHours())}00` };
}

// 단기예보: 02,05,08,11,14,17,20,23시 발표, 약 10분 후 제공
function fcstBase(now) {
  const d = new Date(now);
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  const slots = [2, 5, 8, 11, 14, 17, 20, 23].filter((h) => mins >= h * 60 + 15);
  if (slots.length === 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    return { base_date: ymd(d), base_time: '2300' };
  }
  return { base_date: ymd(d), base_time: `${pad(slots.at(-1))}00` };
}

async function callKma(op, params, key) {
  const qs = new URLSearchParams({
    serviceKey: key, pageNo: '1', numOfRows: '1000', dataType: 'JSON', ...params,
  });
  const r = await fetch(`${BASE}/${op}?${qs}`);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch {
    // 인증키 오류 등은 XML로 옴
    const msg = text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/)?.[1]
      || text.match(/<resultMsg>(.*?)<\/resultMsg>/)?.[1] || text.slice(0, 200);
    throw new Error(`기상청 API 오류: ${msg}`);
  }
  const header = json?.response?.header;
  if (Number(header?.resultCode) !== 0) throw new Error(`기상청 API 오류: ${header?.resultMsg}`);
  return json.response.body.items.item;
}

export default async function handler(req, res) {
  const city = CITIES.find((c) => c.name === req.query.city) || CITIES[0];
  const key = process.env.SERVICE_KEY;

  if (!key) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(sampleWeather(city.name));
  }

  try {
    const { nx, ny } = toGrid(city.lat, city.lon);
    const now = kstNow();
    const today = ymd(now);
    const fb = fcstBase(now);
    const grid = { nx: String(nx), ny: String(ny) };

    const jobs = [
      callKma('getUltraSrtNcst', { ...ncstBase(now), ...grid }, key),
      callKma('getVilageFcst', { ...fb, ...grid }, key),
    ];
    // 오늘 최저/최고는 02시 발표분에 확실히 들어 있음
    const needEarly = fb.base_date === today && fb.base_time !== '0200';
    if (needEarly) {
      jobs.push(callKma('getVilageFcst', { base_date: today, base_time: '0200', ...grid }, key).catch(() => []));
    }
    const [ncst, fcst, early = []] = await Promise.all(jobs);

    // 현재 날씨
    const cur = Object.fromEntries(ncst.map((i) => [i.category, i.obsrValue]));

    // 시간별 예보로 정리
    const byTime = {};
    for (const i of fcst) {
      const k = i.fcstDate + i.fcstTime;
      (byTime[k] ||= { date: i.fcstDate, time: i.fcstTime })[i.category] = i.fcstValue;
    }
    const nowKey = today + pad(now.getUTCHours()) + '00';
    const hours = Object.keys(byTime).sort().filter((k) => k >= nowKey).slice(0, 24).map((k) => {
      const h = byTime[k];
      return {
        date: h.date, time: h.time,
        temp: Number(h.TMP), sky: Number(h.SKY), pty: Number(h.PTY), pop: Number(h.POP),
      };
    });

    // 오늘 최저/최고
    const findToday = (cat) =>
      [...fcst, ...early].find((i) => i.category === cat && i.fcstDate === today)?.fcstValue;
    const todayTemps = Object.values(byTime).filter((h) => h.date === today && h.TMP).map((h) => Number(h.TMP));
    const tmn = findToday('TMN') ?? (todayTemps.length ? Math.min(...todayTemps) : null);
    const tmx = findToday('TMX') ?? (todayTemps.length ? Math.max(...todayTemps) : null);
    const todayPop = Math.max(0, ...Object.values(byTime).filter((h) => h.date === today).map((h) => Number(h.POP) || 0));

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=600');
    return res.status(200).json({
      city: city.name,
      demo: false,
      updated: `${fb.base_date} ${fb.base_time}`,
      current: {
        temp: Number(cur.T1H),
        humidity: Number(cur.REH),
        wind: Number(cur.WSD),
        pty: Number(cur.PTY),
        rain1h: cur.RN1,
        sky: hours[0]?.sky ?? 1,
      },
      today: { min: tmn != null ? Number(tmn) : null, max: tmx != null ? Number(tmx) : null, pop: todayPop },
      hours,
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
