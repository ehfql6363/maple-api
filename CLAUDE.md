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
- 2026-10 실제 이력 30일치(스타포스 183회, 큐브 327회)에서 확인:
  - 스타포스 `starcatch_result`는 전부 `null`이었다. 스타캐치를 안 한 건지 필드가 비는 건지 아직 모른다. 지금은 `null`을 스타캐치 안 함으로 본다.
  - 스타포스에 `protect_shield`(`프로텍트 실드 미적용/소멸되지 않음`), `bonus_stat_upgrade`(`보너스 스탯 미적용 아이템`) 필드도 온다. 분석에는 안 쓴다.
  - 큐브 `miracle_time_flag`는 `이벤트 적용되지 않음`이다. `isOn`은 이 문구를 켜짐으로 판단하므로 큐브에 그대로 쓰면 안 된다.
- 프리셋 장비(`item_equipment_preset_N`)는 현재 장비와 다른 부위를 앞에 두는 순서로 온다. `toSlots`가 고정 부위 순서로 정렬한다.
- **프리셋**: 일일 스냅샷 시점에 사냥 프리셋(드롭률·메소 잠재)을 낀 경우가 많다. 랭커 10명×7일 표본에서 보스 프리셋 착용은 23/70일이었다.
  - 그래서 장비는 사냥 잠재 줄이 가장 적고 스타포스 합이 높은 프리셋 기준으로 본다.
  - 전투력은 현재 착용 프리셋 기준으로만 나오므로, 보스 프리셋을 끼고 있던 날만 기록한다(`combat_power` NULL 허용).
- 일부 상위 랭커는 장비를 일부만 낀 레벨업용 캐릭터다.
- 과거 날짜 조회가 된다(랭킹·캐릭터 모두 `date` 파라미터). 그래서 수집기는 `COLLECT_FROM`/`COLLECT_TO`로 백필할 수 있다.
- 호출 한도: 2026-10 세션에서 개발 키로 하루 약 900~1,000회 호출한 뒤 429 `OPENAPI00007`("Please try again later")이 났고, 몇십 초 뒤에도 계속 막혔다. 일일 한도로 보인다(공식 문서는 이 환경에서 열리지 않아 미확인). 응답 헤더에 한도 정보는 없다.
- 로컬 Postgres 16으로 마이그레이션(두 번 실행해도 안전)·수집·백필 전체 흐름을 실제 API로 확인했다. 15명 × 9일 백필에서 스냅샷 139건 중 전투력 기록 52건, 스펙업 2건.

## Next.js 16 주의 (`cacheComponents: true`)

- 요청 시점 데이터(params, fetch, `connection()`)는 `<Suspense>` 안에서 접근해야 빌드가 된다.
- 서버 컴포넌트 렌더 중 `Date.now()`나 `new Date()`를 쓰면 프리렌더 오류가 난다. 날짜가 필요하면 `connection()` 뒤에서 쓰거나 SQL `CURRENT_DATE`를 쓴다.
- `PageProps`/`LayoutProps`는 생성 타입이다. `npm run typecheck`가 `next typegen`을 먼저 돌린다.

## 개발 환경

- 키는 `NEXON_API_KEY`(환경 변수 또는 git에서 제외된 `.env.local`), DB는 `DATABASE_URL`. 키를 커밋하거나 채팅·로그에 출력하지 않는다.
- 2026-10 세션부터 Node(`fetch`)에서도 `open.api.nexon.com`이 열린다(이전 세션은 "Host not in allowlist"로 막혔다). 다시 막히면 curl로 받은 응답 JSON을 로직에 넣어 검증한다.
- 실제 데이터 확인: `npm run build && npx next start -p 3123` 후 `curl localhost:3123/character/<이름>`, `/api/luck`에 POST.
- 로컬 DB: 클라우드 컨테이너에 Postgres 16(`/usr/lib/postgresql/16/bin`)이 있다. `initdb`·`pg_ctl`은 `postgres` 사용자로 실행해야 한다.
- 수집 테스트는 호출을 많이 쓴다. 개발 키 일일 한도를 다 쓰면 그날은 화면 확인도 막히니 `RANKING_PAGES=0`, 작은 `MAX_CHARACTERS`로 돌린다.
- 검증 순서: `npm run lint && npm run typecheck && npm test && npm run build`

## 남은 일

1. ~~`/character/[name]`, `/luck` 실제 데이터 확인~~ (2026-10 완료. 보스 프리셋 판정·사냥 프리셋 안내·없는 캐릭터·잘못된 키 처리 확인, 부위 순서 수정)
2. 수집 시작 — 코드 준비 완료(백필, 한도 도달 시 정상 종료, 개발 키 기준 기본값). 사용자가 할 일:
   - Neon/Supabase에서 DB를 만들고 GitHub Secrets에 `NEXON_API_KEY`, `DATABASE_URL` 등록
   - 이 브랜치를 `main`에 머지(스케줄 워크플로는 기본 브랜치에서만 돈다)
   - 원하면 Run workflow로 백필
5번(호출 한도)과 묶여 있다. 개발 키로는 하루 250명 정도라, 추천 품질을 높이려면 서비스 단계 키가 필요할 수 있다.
3. 스타포스 확률표(`src/lib/luck/starforce.ts`, 개편 기준일 `STARFORCE_TABLE_SINCE`)를 공식 확률 공개 페이지와 대조. 15성 이상과 스타캐치 문구는 실제 기록으로 아직 검증하지 못했다(본인 키 이력은 14성까지, 스타캐치 `null`뿐).
4. 큐브 등급 상승 공식 확률표를 넣어 운 백분위 계산
5. 개발 키 호출 한도를 공식 문서로 확인(일일 약 1,000회로 추정)하고, 서비스 단계 키 신청 여부를 정한 뒤 수집 규모(`RANKING_PAGES`, `MAX_CHARACTERS`)를 조정. 캐릭터당 하루치에 3회 호출한다.
6. 보스 프리셋을 거의 안 끼는 캐릭터는 전투력이 오래 갱신되지 않는다. 데이터가 쌓이면 장비 점수 기반 구간 분할을 검토한다.
