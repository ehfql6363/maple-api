@AGENTS.md

# 메이플 스펙업 로드맵

넥슨 Open API(메이플스토리 KMS)로 만드는 웹사이트. 사용자와의 대화는 한국어로 한다.

## 제품 방향 (확정된 결정과 이유)

- **스펙업 로드맵**: 같은 직업·비슷한 보스 전투력(±15%) 유저들이 *실제로 한* 스펙업을 모아 다음 스텝 TOP 5를 추천한다.
  - 처음엔 계산식 기반 "어떤 템을 사/직작해야 환산 효율이 높은가"를 검토했지만 버렸다.
    - 넥슨 API에 경매장 시세가 없어 구매가를 자동화할 수 없다. 2026-07 래퍼 라이브러리 `maplestory-openapi` 3.11.0에도 경매장 엔드포인트가 없다.
    - 스타포스·큐브 기대비용 계산은 기존 사이트 "환산주스탯"에 이미 있다.
  - 데이터 기반 방식의 장점: 시세가 필요 없고, 메타 변화(예: 앱솔 건너뛰고 아케인, 모자·상의·하의는 루타→에테르넬)를 자동으로 따라간다. 직업별 공식 없이 게임의 `전투력`으로 비교하므로 **모든 직업**을 지원한다.
- **강화 운 분석**: 사용자 본인 API 키로 스타포스·큐브 이력을 조회해 기대값 대비 백분위를 보여준다. 확률 이력 API는 키를 발급한 *계정* 기준이라 사용자 키가 필요하다. 키는 저장·로그하지 않는다.

## 구조

- `src/lib/nexon/` — API 클라이언트(재시도, 호출 간격), 응답 타입
- `src/lib/snapshot.ts` — 장비 요약, **보스 프리셋 선택**, 스냅샷 간 스펙업 감지
- `src/lib/roadmap.ts` — 추천(빈도·전투력 상승률 중앙값), 부위별 구간 비교
- `src/lib/luck/` — 스타포스 확률표·운 분석, 큐브 집계, 이력 수집
- `src/lib/db.ts`, `db/schema.sql` — Postgres(`postgres` 드라이버, ORM 없음)
- `scripts/collect.ts` — 일일 수집기(랭킹으로 캐릭터 등록 → 전날 스냅샷 저장 → 스펙업 기록). `.github/workflows/collect.yml`로 매일 03:17 KST 실행
- 화면: `/`(검색), `/character/[name]`, `/luck`, `POST /api/luck`

## 실제 API로 확인한 사실 (추측 아님)

- 기본 URL `https://open.api.nexon.com/maplestory/v1`, 헤더 `x-nxopen-api-key`
- 오류는 HTTP 상태가 아니라 **코드**로 구분한다. 잘못된 키는 400 `OPENAPI00005`, 잘못된 파라미터(없는 캐릭터 이름 포함)는 400 `OPENAPI00004`.
- 랭킹 `class_name`/`sub_class_name`: 키네시스는 `프렌즈 월드`/`키네시스`, 카이저·아델·에반 등은 `sub_class_name`이 빈 문자열. 캐릭터 직업은 `character/basic`의 `character_class`를 쓴다.
- `starforce`는 문자열 숫자, 잠재 등급은 `레어/에픽/유니크/레전드리`, 전투력은 `character/stat`의 `final_stat` 중 `stat_name === "전투력"`.
- 스타포스 이력 플래그 문구: `슈페리얼 장비 미해당`, `찬스타임 미적용`, `파괴 방지 미적용`, `파괴 방지 이벤트맵 미적용`. 결과는 `성공` / `실패(유지)`. "미적용·미사용·미해당"이 꺼짐이다(`isOn`).
- 큐브 이력 `item_upgrade_result`는 `성공`(등급 상승) / `실패`.
- **프리셋**: 일일 스냅샷 시점에 사냥 프리셋(드롭률·메소 잠재)을 낀 경우가 많다. 랭커 10명×7일 표본에서 보스 프리셋 착용은 23/70일이었다.
  - 그래서 장비는 사냥 잠재 줄이 가장 적고 스타포스 합이 높은 프리셋 기준으로 본다.
  - 전투력은 현재 착용 프리셋 기준으로만 나오므로, 보스 프리셋을 끼고 있던 날만 기록한다(`combat_power` NULL 허용).
- 일부 상위 랭커는 장비를 일부만 낀 레벨업용 캐릭터다.

## Next.js 16 주의 (`cacheComponents: true`)

- 요청 시점 데이터(params, fetch, `connection()`)는 `<Suspense>` 안에서 접근해야 빌드가 된다.
- 서버 컴포넌트 렌더 중 `Date.now()`나 `new Date()`를 쓰면 프리렌더 오류가 난다. 날짜가 필요하면 `connection()` 뒤에서 쓰거나 SQL `CURRENT_DATE`를 쓴다.
- `PageProps`/`LayoutProps`는 생성 타입이다. `npm run typecheck`가 `next typegen`을 먼저 돌린다.

## 개발 환경

- 키는 `NEXON_API_KEY`(환경 변수 또는 git에서 제외된 `.env.local`), DB는 `DATABASE_URL`. 키를 커밋하거나 채팅·로그에 출력하지 않는다.
- 이전 클라우드 세션 기준: `open.api.nexon.com`이 curl로는 열렸지만 Node(`fetch`)는 "Host not in allowlist"로 막혀서 앱 화면을 실제 데이터로 확인하지 못했다. 막히면 curl로 받은 응답 JSON을 로직에 넣어 검증한다.
- 검증 순서: `npm run lint && npm run typecheck && npm test && npm run build`

## 남은 일

1. Node에서 API가 열리면 `/character/[name]`, `/luck`을 실제 데이터로 확인
2. Postgres 연결(Neon/Supabase), `npm run db:migrate`, GitHub Secrets(`NEXON_API_KEY`, `DATABASE_URL`) 등록 후 수집 시작. 데이터가 몇 주 쌓여야 추천 품질이 나온다.
3. 스타포스 확률표(`src/lib/luck/starforce.ts`, 개편 기준일 `STARFORCE_TABLE_SINCE`)를 공식 확률 공개 페이지와 대조. 15성 이상과 스타캐치 문구는 실제 기록으로 아직 검증하지 못했다.
4. 큐브 등급 상승 공식 확률표를 넣어 운 백분위 계산
5. 개발 키 호출 한도 확인 후 수집 규모(`RANKING_PAGES`, `MAX_CHARACTERS`) 조정. 캐릭터당 하루 3회 호출한다.
6. 보스 프리셋을 거의 안 끼는 캐릭터는 전투력이 오래 갱신되지 않는다. 데이터가 쌓이면 장비 점수 기반 구간 분할을 검토한다.
