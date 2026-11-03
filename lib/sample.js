// 인증키가 없을 때 화면을 미리 볼 수 있도록 만드는 샘플 데이터
function seed(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return () => ((h = (h * 1103515245 + 12345) >>> 0) / 2 ** 32);
}
const pad = (n) => String(n).padStart(2, '0');

export function sampleWeather(city) {
  const rnd = seed(city);
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const base = 8 + Math.round(rnd() * 8);
  const hours = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getTime() + i * 3600 * 1000);
    const h = d.getUTCHours();
    const temp = Math.round(base + 5 * Math.sin(((h - 9) / 24) * 2 * Math.PI));
    const pop = Math.min(90, Math.round(rnd() * 40 + (i > 12 ? 30 : 0)));
    hours.push({
      date: `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`,
      time: `${pad(h)}00`,
      temp, pop,
      sky: pop > 50 ? 4 : pop > 25 ? 3 : 1,
      pty: pop >= 70 ? 1 : 0,
    });
  }
  const temps = hours.map((h) => h.temp);
  return {
    city, demo: true, updated: '샘플',
    current: { temp: hours[0].temp, humidity: 55, wind: 2.1, pty: 0, rain1h: '강수없음', sky: hours[0].sky },
    today: { min: Math.min(...temps), max: Math.max(...temps), pop: Math.max(...hours.slice(0, 12).map((h) => h.pop)) },
    hours,
  };
}

export function sampleAir(city) {
  const rnd = seed(city + 'air');
  return {
    city, demo: true, time: '샘플',
    pm10: Math.round(20 + rnd() * 70),
    pm25: Math.round(8 + rnd() * 35),
    o3: Number((0.01 + rnd() * 0.04).toFixed(3)),
  };
}
