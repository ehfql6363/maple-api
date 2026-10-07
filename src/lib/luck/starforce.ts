import type { StarforceHistory } from "../nexon/types";
import { normalCdf } from "./stats";

/**
 * 현재 성급별 기본 성공·파괴 확률 (KMS 스타포스 개편 이후, 최대 30성 기준).
 * 나머지 확률은 실패(유지).
 *
 * TODO(검증 필요): 공식 확률 공개 페이지(메이플스토리 홈페이지 > 확률형 아이템)의
 * 값과 대조할 것. 개편 이전 기록에는 다른 표가 적용되므로 STARFORCE_TABLE_SINCE
 * 이전 기록은 분석에서 제외한다.
 */
export const STARFORCE_TABLE_SINCE = "2025-03-20";

export const STARFORCE_RATES: { success: number; destroy: number }[] = [
  { success: 0.95, destroy: 0 }, // 0 → 1
  { success: 0.9, destroy: 0 },
  { success: 0.85, destroy: 0 },
  { success: 0.85, destroy: 0 },
  { success: 0.8, destroy: 0 },
  { success: 0.75, destroy: 0 }, // 5
  { success: 0.7, destroy: 0 },
  { success: 0.65, destroy: 0 },
  { success: 0.6, destroy: 0 },
  { success: 0.55, destroy: 0 },
  { success: 0.5, destroy: 0 }, // 10
  { success: 0.45, destroy: 0 },
  { success: 0.4, destroy: 0 },
  { success: 0.35, destroy: 0 },
  { success: 0.3, destroy: 0 },
  { success: 0.3, destroy: 0.021 }, // 15
  { success: 0.3, destroy: 0.021 },
  { success: 0.15, destroy: 0.068 },
  { success: 0.15, destroy: 0.068 },
  { success: 0.15, destroy: 0.085 },
  { success: 0.3, destroy: 0.105 }, // 20
  { success: 0.15, destroy: 0.1275 },
  { success: 0.15, destroy: 0.17 },
  { success: 0.1, destroy: 0.18 },
  { success: 0.1, destroy: 0.18 },
  { success: 0.1, destroy: 0.18 }, // 25
  { success: 0.07, destroy: 0.186 },
  { success: 0.05, destroy: 0.19 },
  { success: 0.03, destroy: 0.194 },
  { success: 0.01, destroy: 0.198 },
];

/** 스타캐치 성공 시 성공 확률에 곱해지는 배수 */
const STARCATCH_MULTIPLIER = 1.05;

/** "파괴 방지 적용" / "파괴 방지 미적용", "미사용" 같은 플래그 문자열을 해석한다. */
function isOn(flag: string | null | undefined): boolean {
  return !!flag && !/미적용|미사용|false/.test(flag);
}

export interface AttemptProbability {
  success: number;
  destroy: number;
}

/**
 * 한 번의 강화 시도에 적용된 확률. 분석 대상이 아니면 null.
 * 제외 대상: 슈페리얼 장비(별도 확률표), 찬스타임(100%), 성공 확률 이벤트, 개편 이전 기록.
 */
export function attemptProbability(h: StarforceHistory): AttemptProbability | null {
  if (h.date_create.slice(0, 10) < STARFORCE_TABLE_SINCE) return null;
  if (isOn(h.superior_item_flag) || isOn(h.chance_time)) return null;

  const events = h.starforce_event_list ?? [];
  if (events.some((e) => Number(e.success_rate) > 0)) return null;

  const base = STARFORCE_RATES[h.before_starforce_count];
  if (!base) return null;

  const caught = h.starcatch_result?.includes("성공") ?? false;
  const success = Math.min(1, caught ? base.success * STARCATCH_MULTIPLIER : base.success);

  // 실패 중 파괴가 차지하는 비율은 스타캐치 전후로 유지된다.
  let destroy = base.success < 1 ? (base.destroy * (1 - success)) / (1 - base.success) : 0;
  if (isOn(h.destroy_defence)) destroy = 0;
  const decrease = Math.max(0, ...events.map((e) => Number(e.destroy_decrease_rate) || 0));
  destroy *= 1 - decrease / 100;

  return { success, destroy };
}

export interface LuckSummary {
  attempts: number;
  excluded: number;
  successes: number;
  expectedSuccesses: number;
  destroys: number;
  expectedDestroys: number;
  /** 성공 횟수 기준 운. 0.9면 나보다 운 나쁜 사람이 90% (= 상위 10%) */
  successPercentile: number | null;
  /** 파괴 횟수 기준 운. 덜 터질수록 높다. */
  destroyPercentile: number | null;
  byStar: { star: number; attempts: number; successes: number; expected: number }[];
}

export function analyzeStarforce(history: StarforceHistory[]): LuckSummary {
  let excluded = 0;
  let successes = 0;
  let expS = 0;
  let varS = 0;
  let destroys = 0;
  let expD = 0;
  let varD = 0;
  const byStar = new Map<number, { attempts: number; successes: number; expected: number }>();

  for (const h of history) {
    const p = attemptProbability(h);
    if (!p) {
      excluded++;
      continue;
    }
    const ok = h.item_upgrade_result.includes("성공");
    const boom = h.item_upgrade_result.includes("파괴");
    successes += ok ? 1 : 0;
    destroys += boom ? 1 : 0;
    expS += p.success;
    varS += p.success * (1 - p.success);
    expD += p.destroy;
    varD += p.destroy * (1 - p.destroy);

    const s = byStar.get(h.before_starforce_count) ?? { attempts: 0, successes: 0, expected: 0 };
    s.attempts++;
    s.successes += ok ? 1 : 0;
    s.expected += p.success;
    byStar.set(h.before_starforce_count, s);
  }

  const attempts = history.length - excluded;
  return {
    attempts,
    excluded,
    successes,
    expectedSuccesses: expS,
    destroys,
    expectedDestroys: expD,
    successPercentile: varS > 0 ? normalCdf((successes - expS) / Math.sqrt(varS)) : null,
    destroyPercentile: varD > 0 ? 1 - normalCdf((destroys - expD) / Math.sqrt(varD)) : null,
    byStar: [...byStar.entries()]
      .map(([star, v]) => ({ star, ...v }))
      .sort((a, b) => a.star - b.star),
  };
}
