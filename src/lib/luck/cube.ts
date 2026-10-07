import type { CubeHistory } from "../nexon/types";

export interface CubeSummary {
  cubeType: string;
  uses: number;
  tierUps: number;
  /** 천장(등급 상승 보장)으로 오른 횟수 */
  guaranteed: number;
}

/**
 * 큐브 종류별 사용 횟수와 등급 상승 횟수.
 * TODO: 공식 등급 상승 확률표를 넣으면 스타포스처럼 운 백분위를 계산할 수 있다.
 */
export function summarizeCubes(history: CubeHistory[]): CubeSummary[] {
  const map = new Map<string, CubeSummary>();
  for (const h of history) {
    let s = map.get(h.cube_type);
    if (!s) map.set(h.cube_type, (s = { cubeType: h.cube_type, uses: 0, tierUps: 0, guaranteed: 0 }));
    s.uses++;
    // 실제 응답: 등급이 오르면 "성공", 아니면 "실패"
    if (h.item_upgrade_result === "성공") {
      s.tierUps++;
      if (h.upgrade_guarantee) s.guaranteed++;
    }
  }
  return [...map.values()].sort((a, b) => b.uses - a.uses);
}
