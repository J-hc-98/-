# ⛅ 오늘 외출해도 될까? — 경기도 날씨·미세먼지

경기도 31개 시·군의 현재 날씨, 시간별 예보, 미세먼지를 보여주고
"우산 챙기세요", "마스크 챙기세요" 같은 외출 조언을 해주는 웹사이트입니다.

## 폴더 구조
```
public/      화면 (index.html, style.css, app.js, cities.js)
api/         서버 함수 — 인증키를 숨긴 채 공공 API를 대신 호출
  weather.js   기상청 초단기실황 + 단기예보
  air.js       에어코리아 시군구별 미세먼지
lib/sample.js  인증키가 없을 때 쓰는 샘플 데이터
server.js    내 컴퓨터에서 테스트할 때만 쓰는 서버
```

## 1. 인증키 발급 (공공데이터포털)
1. https://www.data.go.kr 회원가입 후 로그인
2. 아래 두 API를 검색해서 각각 **활용신청** (개발계정은 보통 바로 승인)
   - `기상청_단기예보 ((구)_동네예보) 조회서비스`
   - `한국환경공단_에어코리아_대기오염통계 현황`
3. 마이페이지 → 일반 인증키 **(Decoding)** 값 복사
   (한 계정의 인증키 하나로 두 API를 모두 사용해요)
4. `.env.example`을 복사해 `.env`로 이름을 바꾸고 키를 붙여넣기

> 승인 직후에는 키가 활성화되기까지 1~2시간 정도 걸릴 수 있어요.
> 그동안은 "SERVICE_KEY_IS_NOT_REGISTERED_ERROR"가 나와도 정상이에요.

## 2. 내 컴퓨터에서 실행
1. [Node.js](https://nodejs.org) LTS 버전 설치 (18 이상)
2. 이 폴더에서 터미널(PowerShell)을 열고:
   ```
   node server.js
   ```
3. 브라우저에서 http://localhost:7171 열기

인증키가 없으면 샘플 데이터로 화면이 나와요.

## 3. 인터넷에 배포 (Vercel, 무료)
1. 이 폴더를 GitHub 저장소에 올리기 (`.env`는 자동으로 제외됨)
2. https://vercel.com 에 GitHub로 로그인 → **Add New → Project** → 저장소 선택
3. **Environment Variables**에 `SERVICE_KEY` = 인증키 입력
4. **Deploy** → `프로젝트이름.vercel.app` 주소가 생기면 누구나 접속 가능

Vercel은 `public/` 폴더를 화면으로, `api/` 폴더를 서버 함수로 자동 인식해요.
응답은 10~20분간 캐시되어 API 일일 호출 한도(개발계정 1만 건)를 아껴줍니다.
