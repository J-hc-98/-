// 경기도 31개 시·군 (시청·군청 위치 기준 좌표)
export const CITIES = [
  { name: '수원시', lat: 37.2636, lon: 127.0286 },
  { name: '성남시', lat: 37.4200, lon: 127.1267 },
  { name: '고양시', lat: 37.6584, lon: 126.8320 },
  { name: '용인시', lat: 37.2411, lon: 127.1776 },
  { name: '부천시', lat: 37.5034, lon: 126.7660 },
  { name: '화성시', lat: 37.1995, lon: 126.8312 },
  { name: '안산시', lat: 37.3219, lon: 126.8309 },
  { name: '남양주시', lat: 37.6360, lon: 127.2165 },
  { name: '안양시', lat: 37.3943, lon: 126.9568 },
  { name: '평택시', lat: 36.9921, lon: 127.1129 },
  { name: '시흥시', lat: 37.3800, lon: 126.8029 },
  { name: '파주시', lat: 37.7600, lon: 126.7800 },
  { name: '의정부시', lat: 37.7381, lon: 127.0337 },
  { name: '김포시', lat: 37.6152, lon: 126.7156 },
  { name: '광주시', lat: 37.4295, lon: 127.2550 },
  { name: '광명시', lat: 37.4786, lon: 126.8646 },
  { name: '군포시', lat: 37.3616, lon: 126.9352 },
  { name: '하남시', lat: 37.5393, lon: 127.2148 },
  { name: '오산시', lat: 37.1498, lon: 127.0772 },
  { name: '양주시', lat: 37.7853, lon: 127.0458 },
  { name: '이천시', lat: 37.2720, lon: 127.4350 },
  { name: '구리시', lat: 37.5943, lon: 127.1296 },
  { name: '안성시', lat: 37.0080, lon: 127.2797 },
  { name: '포천시', lat: 37.8949, lon: 127.2003 },
  { name: '의왕시', lat: 37.3447, lon: 126.9683 },
  { name: '양평군', lat: 37.4917, lon: 127.4876 },
  { name: '여주시', lat: 37.2984, lon: 127.6370 },
  { name: '동두천시', lat: 37.9036, lon: 127.0606 },
  { name: '과천시', lat: 37.4292, lon: 126.9876 },
  { name: '가평군', lat: 37.8315, lon: 127.5105 },
  { name: '연천군', lat: 38.0966, lon: 127.0748 },
];

// 위경도 → 기상청 격자(nx, ny) 변환 (기상청 Lambert Conformal Conic)
export function toGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0;
  const OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const D = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * D, slat2 = SLAT2 * D, olon = OLON * D, olat = OLAT * D;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * D - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

// 가장 가까운 시·군 찾기
export function nearestCity(lat, lon) {
  let best = CITIES[0], bestD = Infinity;
  for (const c of CITIES) {
    const d = (c.lat - lat) ** 2 + ((c.lon - lon) * Math.cos(lat * Math.PI / 180)) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
