# ⛅ 오늘 외출해도 될까? — 경기도 날씨·미세먼지

경기도 31개 시·군의 현재 날씨, 시간별 예보, 미세먼지를 보여주고
"우산 챙기세요", "마스크 챙기세요" 같은 외출 조언을 해주는 웹사이트입니다.

이 버전(1.1.0)은 **SYPlatform 서버 규격**(Windows x64, Node.js, `/apps/서비스번호/접근토큰/` 제한 프록시, iframe sandbox)에 맞게 수정했습니다.
같은 코드를 Vercel에도 그대로 배포할 수 있습니다.

---

## 1. 실행 환경 요약

| 항목 | 내용 |
|---|---|
| 실행 방식 | Node.js 운영 서버 (`npm run start` → `node server.js`). 빌드 단계 없음 |
| Node.js 버전 | **18.17.0 이상** (내장 `fetch` 사용). 개발·테스트: Node 22.23.4 |
| npm 패키지 | 없음 (외부 의존성 0개, `package-lock.json` 포함) |
| 시스템 컴포넌트 | 없음 (`systemComponents: []`) |
| DB | **사용하지 않음** (SQLite·PostgreSQL 모두 불필요, 영속 파일 없음) |
| 외부 API | 공공데이터포털(`https://apis.data.go.kr`) — 기상청 단기예보, 에어코리아 대기오염통계 |
| 로그인·첨부파일 | 없음 (공개 조회 서비스) |
| 예약 작업·메일 | 없음 (`SYAPP_DISABLE_JOBS`, `SYAPP_DISABLE_EMAIL`은 해당 없음) |

`syplatform.json`

```json
{ "runtime": "node", "entry": "package.json", "runtimeVersion": ">=18.17.0", "systemComponents": [] }
```

---

## 2. 외부 API와 인증키

| API | 공공데이터포털 이름 | 호출 주소 |
|---|---|---|
| 날씨 | 기상청_단기예보 조회서비스 (초단기실황 + 단기예보) | `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0` |
| 미세먼지 | 한국환경공단_에어코리아_대기오염통계 현황 (시군구별 실시간 평균) | `https://apis.data.go.kr/B552584/ArpltnStatsSvc` |

- 두 API 모두 공공데이터포털에서 **활용신청**한 계정의 **일반 인증키 하나**를 같이 씁니다.
- 인증키는 환경변수 **`WEATHER_API_KEY`**로 읽습니다. 기존 Vercel 설정 호환을 위해 `SERVICE_KEY`도 읽습니다.
- 인증키는 **서버에서만** 사용합니다. 화면(브라우저)으로 보내지 않고 로그에도 출력하지 않습니다.
- 서버가 `apis.data.go.kr`(443 포트)로 **외부 HTTPS 통신**을 할 수 있어야 합니다. 사내망 방화벽이나 프록시가 막고 있으면 날씨 영역에 오류가 표시됩니다.
- 공공데이터포털 개발계정은 하루 호출 한도가 있습니다(API별 약 1만 건). 응답에 `Cache-Control: s-maxage`를 붙여 두었지만, 플랫폼에서 캐시를 쓰지 않으면 접속자 수만큼 호출됩니다.

---

## 3. Windows 서버 설치·실행

> 관리자 검토 전에 시스템 프로그램을 자동 설치하지 않습니다. Node.js는 관리자가 직접 설치하세요.

1. Node.js LTS(18.17 이상) 설치: https://nodejs.org → Windows Installer (x64)
2. 설치 확인 (PowerShell): `node -v`
3. ZIP을 풀고 해당 폴더에서:
   ```powershell
   npm ci
   npm run start
   ```
   - `HOST`(기본 `127.0.0.1`)와 `PORT`(기본 7171) 환경변수를 읽습니다.
   - `--urls http://127.0.0.1:5000` 인자로 포트를 넘겨도 됩니다.
   - 개발 서버가 아닌 운영 서버(Node `http`)를 직접 실행합니다.

**수동으로 띄워볼 때 (PowerShell)**

```powershell
$env:HOST = "127.0.0.1"
$env:PORT = "7171"
$env:WEATHER_API_KEY = "공공데이터포털_일반_인증키"
npm run start
```

내 컴퓨터에서 테스트할 때는 `.env.example`을 복사해 `.env`로 만들고 값을 넣어도 됩니다 (`.env`는 ZIP·GitHub에 넣지 않음).

---

## 4. 설정 (환경변수)

| 변수 | 필수 | 설명 |
|---|---|---|
| `WEATHER_API_KEY` | 운영 시 필수 | 공공데이터포털 일반 인증키. 없으면 샘플 데이터 표시 |
| `HOST`, `PORT` | 플랫폼 전달 | 서버 주소·포트 |
| `SYAPP_PREVIEW` | 자동 검토 | `1`이면 외부 API를 부르지 않고 모의 응답 사용 |

`SYAPP_DATA_DIR`, `SYAPP_DB_*`는 사용하지 않습니다 (저장하는 데이터가 없음).

---

## 5. SYPlatform 연결 제약 대응

| 제약 | 대응 |
|---|---|
| `/apps/서비스번호/접근토큰/` 프록시 | 화면·API·자산을 모두 **상대 경로**로 불러옵니다 (`api/weather`, `app.js`, `cities.js`). 프록시가 접두어를 그대로 넘겨도 서버가 제거하고 처리합니다 |
| iframe sandbox (origin `null`) | 화면의 모듈 스크립트와 API 요청이 막히지 않도록 `Access-Control-Allow-Origin: *`를 보냅니다. 로그인·쿠키가 없어 이 허용은 위험을 만들지 않습니다 |
| localStorage 사용 불가 | 마지막으로 고른 시·군 기억 기능만 영향. 실패해도 오류 없이 기본값(수원시)으로 시작 |
| `alert()` 차단 | 사용하지 않음. 위치 오류는 버튼 글자로 안내 |
| 위치(📍 내 위치) | iframe에 위치 권한이 없으면 브라우저가 차단 → "위치 사용 불가 · 목록에서 선택" 표시. 목록 선택은 정상 |
| WebSocket | 사용하지 않음 |

---

## 6. 자동 검토 환경 (SYAPP_PREVIEW=1)

- 외부 API를 호출하지 않고 시·군별로 일정한 **모의 날씨·미세먼지 데이터**를 반환합니다.
- 화면 위쪽에 "미리보기 모드" 안내가 표시됩니다.
- DB를 쓰지 않으므로 SQLite 데이터 폴더는 필요 없습니다.
- 헬스 체크: `GET api/health` → `{"ok":true}`

---

## 7. 검증 결과 (2026-11-03)

> SYPlatform 실제 배포는 아직 하지 않았습니다. 아래는 플랫폼 조건을 로컬에서 재현해 직접 실행한 결과입니다.
> Linux(Node 22.23.4)에서 실행했으며 **Windows 서버 실행은 아직 확인하지 못했습니다.**

| # | 항목 | 방법 | 결과 |
|---|---|---|---|
| 1 | 자동 테스트 5건 | `npm test` (상대 경로, 프록시 접두어, 미리보기 모의 응답, CORS, 인증키 비노출) | 통과 |
| 2 | ZIP에서 새로 설치·실행 | ZIP 해제 → `npm ci` → `npm test` → `npm run start` | 통과 |
| 3 | 실제 API 응답 처리 | 공공데이터포털 응답 형식의 모의 응답으로 날씨·미세먼지 파싱 확인 | 통과 |
| 4 | 실제 공공데이터 연동 | 같은 코드를 Vercel에 배포해 기상청·에어코리아 실제 데이터 표시 확인 | 통과 (사내 서버에서의 외부 통신은 미확인) |
| 5 | **sandbox iframe + 프록시** | `sandbox="allow-scripts allow-forms"` iframe, `/apps/9/tok123/` 프록시 뒤에서 Chromium으로 조작 | origin `null` 상태에서 화면 로딩, 시·군 변경 정상. 위치 버튼은 권한 차단 안내 표시 |
| 6 | `--urls` 인자, `HOST` 기본값 | `node server.js --urls http://127.0.0.1:<포트>` | 통과 |

---

## 8. 미완료·확인 필요 항목

1. **SYPlatform 실제 배포 미확인** — 관리자 원문 로그(비밀값 제거본)를 받으면 원인 확인과 재테스트가 필요합니다.
2. **Windows 서버 실행 미확인** — OS 중립 API만 사용했지만 Windows x64에서 `npm ci` → `npm run start` 확인이 필요합니다.
3. **사내 서버 → `apis.data.go.kr` 외부 통신 미확인** — 막혀 있으면 방화벽 허용이 필요합니다.
4. **글꼴** — 화면 글꼴(Pretendard)을 외부 CDN(`cdn.jsdelivr.net`)에서 불러옵니다. 사용자 PC에서 CDN이 막히면 맑은 고딕 등 기본 글꼴로 표시됩니다 (기능 영향 없음).
5. **위치 기능** — 플랫폼 iframe에 위치 권한이 없으면 동작하지 않습니다.
6. 이 서비스는 DB를 쓰지 않으므로 DB 관련 항목은 해당 없음. Cloudflare Workers/D1/R2도 사용하지 않습니다.

---

## 9. 폴더 구조

```
server.js          운영 서버 (HOST/PORT/--urls, 프록시 접두어 처리, CORS, 정적 파일)
api/weather.js     기상청 초단기실황 + 단기예보 (서버에서 인증키로 호출)
api/air.js         에어코리아 시군구별 미세먼지
lib/sample.js      인증키가 없거나 SYAPP_PREVIEW=1일 때 쓰는 모의 데이터
public/            화면 (index.html, style.css, app.js, cities.js — 모두 상대 경로)
test/              자동 테스트 (npm test)
syplatform.json, .env.example, package.json, package-lock.json
```

## 10. Vercel 배포 (기존 방식, 그대로 사용 가능)

Vercel은 `public/`을 화면으로, `api/`를 서버 함수로 자동 인식합니다. 환경변수에 `WEATHER_API_KEY`(또는 기존 `SERVICE_KEY`)를 넣으면 됩니다.
