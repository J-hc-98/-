// GET /api/air?city=수원시
// 에어코리아 대기오염통계 - 시군구별 실시간 평균정보
import { CITIES } from '../public/cities.js';
import { sampleAir } from '../lib/sample.js';

const URL_ = 'https://apis.data.go.kr/B552584/ArpltnStatsSvc/getCtprvnMesureSidoLIst';

export default async function handler(req, res) {
  const city = CITIES.find((c) => c.name === req.query.city) || CITIES[0];
  // 인증키: WEATHER_API_KEY (SYPlatform 규격). 기존 Vercel 설정 호환을 위해 SERVICE_KEY도 읽음.
  const key = process.env.WEATHER_API_KEY || process.env.SERVICE_KEY;
  // SYAPP_PREVIEW=1(자동 검토 환경)이면 외부 API를 부르지 않고 모의 응답 사용
  const preview = ['1', 'true'].includes(String(process.env.SYAPP_PREVIEW || '').toLowerCase());

  if (preview || !key) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...sampleAir(city.name), demoReason: preview ? 'preview' : 'nokey' });
  }

  try {
    const qs = new URLSearchParams({
      serviceKey: key, returnType: 'json', numOfRows: '100', pageNo: '1',
      sidoName: '경기', searchCondition: 'HOUR',
    });
    const r = await fetch(`${URL_}?${qs}`);
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch {
      const msg = text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/)?.[1] || text.slice(0, 200);
      throw new Error(`에어코리아 API 오류: ${msg}`);
    }
    const header = json?.response?.header;
    if (Number(header?.resultCode) !== 0) throw new Error(`에어코리아 API 오류: ${header?.resultMsg}`);

    const items = json.response.body.items || [];
    // 같은 시·군이 여러 시간대로 오면 가장 최근 값 사용
    const rows = items
      .filter((i) => i.cityName === city.name || i.cityName?.startsWith(city.name.slice(0, -1)))
      .sort((a, b) =>
        (b.cityName === city.name) - (a.cityName === city.name) ||
        (b.dataTime || '').localeCompare(a.dataTime || ''));
    const it = rows[0];
    if (!it) throw new Error(`${city.name} 미세먼지 정보가 없어요`);

    const num = (v) => (v === '' || v == null || v === '-' ? null : Number(v));
    res.setHeader('Cache-Control', 's-maxage=1200, stale-while-revalidate=1200');
    return res.status(200).json({
      city: city.name,
      demo: false,
      time: it.dataTime,
      pm10: num(it.pm10Value),
      pm25: num(it.pm25Value),
      o3: num(it.o3Value),
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
