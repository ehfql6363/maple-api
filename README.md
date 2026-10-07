# 메이플 스펙업 로드맵

같은 직업·비슷한 전투력 유저들이 **실제로 어떤 스펙업을 했는지** 데이터로 모아 다음 스텝을 추천하고, 스타포스·큐브 **강화 운**을 분석하는 사이트입니다. 데이터는 [넥슨 Open API](https://openapi.nexon.com)를 사용합니다.

## 기능

| 기능 | 경로 | 설명 |
|---|---|---|
| 스펙업 로드맵 | `/character/[닉네임]` | 현재 스펙, 같은 구간(직업 동일·전투력 ±15%) 유저들이 다음으로 가장 많이 한 스펙업 TOP 5, 부위별 비교 |
| 강화 운 분석 | `/luck` | 본인 API 키로 스타포스·큐브 이력을 조회해 기대값 대비 운 백분위 계산 (키는 저장하지 않음) |

## 동작 방식

1. **수집기** (`scripts/collect.ts`, GitHub Actions로 매일 실행)
   - 종합 랭킹에서 캐릭터를 찾아 등록
   - 등록된 캐릭터의 전날 스펙(전투력, 부위별 장비·스타포스·잠재 등급)을 `snapshots`에 저장
   - 직전 스냅샷과 비교해 장비 교체·스타포스 상승·잠재/에디 등급 상승을 `upgrade_events`에 기록
2. **추천** (`src/lib/roadmap.ts`): 내 구간의 `upgrade_events`를 업그레이드별로 묶어, 선택한 유저 수와 전투력 상승률 중앙값으로 정렬
3. **운 분석** (`src/lib/luck/`): 시도마다 적용된 성공·파괴 확률을 계산해 기대 횟수와 비교하고, 정규근사로 백분위 계산

## 시작하기

```bash
cp .env.example .env.local   # NEXON_API_KEY, DATABASE_URL 입력
npm install
npm run db:migrate           # DB 스키마 적용
npm run collect              # 수집 1회 실행 (선택)
npm run dev
```

DB 없이도 캐릭터 현재 스펙 조회와 강화 운 분석은 동작합니다. 추천은 수집 데이터가 쌓여야 표시됩니다.

### 매일 자동 수집 설정

GitHub 저장소 설정에서 다음을 추가하면 `.github/workflows/collect.yml`이 매일 03:17(KST)에 실행됩니다.

- Secrets: `NEXON_API_KEY`, `DATABASE_URL`
- Variables(선택): `RANKING_PAGES`(기본 5, 페이지당 200명), `MAX_CHARACTERS`(기본 500)

캐릭터 1명당 하루 3회 호출합니다. 수집 규모는 API 키의 호출 한도에 맞춰 조정하세요.

## 검증이 필요한 부분

- `src/lib/luck/starforce.ts`의 **스타포스 확률표**는 공식 확률 공개 페이지와 대조가 필요합니다. 개편 이전 기록은 제외합니다(`STARFORCE_TABLE_SINCE`).
- 큐브는 아직 사용·등급 상승 횟수만 집계합니다. 공식 등급 상승 확률표를 넣으면 운 백분위를 계산할 수 있습니다.

## 개발

```bash
npm test          # 단위 테스트
npm run typecheck
npm run lint
npm run build
```
