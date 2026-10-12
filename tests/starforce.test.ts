import { describe, expect, it } from "vitest";
import { analyzeStarforce, attemptProbability, isOn, STARFORCE_RATES } from "@/lib/luck/starforce";
import { normalCdf } from "@/lib/luck/stats";
import type { StarforceHistory } from "@/lib/nexon/types";

const h = (star: number, result: string, extra: Partial<StarforceHistory> = {}): StarforceHistory => ({
  id: Math.random().toString(),
  item_upgrade_result: result,
  before_starforce_count: star,
  after_starforce_count: result === "성공" ? star + 1 : star,
  starcatch_result: "실패",
  superior_item_flag: "슈페리얼 장비 미해당",
  destroy_defence: "파괴 방지 미적용",
  chance_time: "찬스타임 미적용",
  event_field_flag: "파괴 방지 이벤트맵 미적용",
  target_item: "아케인셰이드 나이트글러브",
  character_name: "테스트",
  date_create: "2026-09-01T12:00:00+09:00",
  starforce_event_list: null,
  ...extra,
});

describe("isOn", () => {
  it("실제 응답 문구를 해석한다", () => {
    for (const off of ["슈페리얼 장비 미해당", "찬스타임 미적용", "파괴 방지 미적용", "파괴 방지 이벤트맵 미적용"]) {
      expect(isOn(off)).toBe(false);
    }
    expect(isOn("파괴 방지 적용")).toBe(true);
    expect(isOn(null)).toBe(false);
  });
});

describe("normalCdf", () => {
  it("대표값", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe("attemptProbability", () => {
  it("기본 확률표를 쓴다", () => {
    expect(attemptProbability(h(17, "성공"))).toEqual(STARFORCE_RATES[17]);
  });

  it("스타캐치 성공 시 성공 확률 ×1.05, 파괴 비율은 실패 중 비중 유지", () => {
    const p = attemptProbability(h(17, "성공", { starcatch_result: "성공" }))!;
    expect(p.success).toBeCloseTo(0.1575);
    expect(p.destroy).toBeCloseTo((0.068 * (1 - 0.1575)) / 0.85);
  });

  it("파괴 방지 적용 시 파괴 확률 0", () => {
    expect(attemptProbability(h(15, "실패(유지)", { destroy_defence: "파괴 방지 적용" }))!.destroy).toBe(0);
  });

  it("찬스타임, 슈페리얼, 이벤트맵, 성공률 이벤트, 개편 이전 기록은 제외", () => {
    expect(attemptProbability(h(15, "성공", { event_field_flag: "파괴 방지 이벤트맵 적용" }))).toBeNull();
    expect(attemptProbability(h(15, "성공", { chance_time: "찬스타임 적용" }))).toBeNull();
    expect(attemptProbability(h(15, "성공", { superior_item_flag: "슈페리얼 장비" }))).toBeNull();
    expect(
      attemptProbability(
        h(10, "성공", {
          starforce_event_list: [
            { success_rate: "100", destroy_decrease_rate: null, cost_discount_rate: "0", plus_value: "0", starforce_event_range: "5,10,15" },
          ],
        }),
      ),
    ).toBeNull();
    expect(attemptProbability(h(15, "성공", { date_create: "2024-05-01T12:00:00+09:00" }))).toBeNull();
  });
});

describe("analyzeStarforce", () => {
  it("기대보다 많이 성공하면 백분위가 0.5보다 높다", () => {
    const lucky = Array.from({ length: 20 }, (_, i) => h(17, i < 10 ? "성공" : "실패(유지)"));
    const r = analyzeStarforce(lucky);
    expect(r.attempts).toBe(20);
    expect(r.successes).toBe(10);
    expect(r.expectedSuccesses).toBeCloseTo(3);
    expect(r.successPercentile!).toBeGreaterThan(0.99);
    expect(r.byStar).toEqual([{ star: 17, attempts: 20, successes: 10, expected: expect.closeTo(3) }]);
  });

  it("파괴가 기대보다 많으면 파괴 운 백분위가 낮다", () => {
    const unlucky = Array.from({ length: 10 }, () => h(22, "파괴"));
    expect(analyzeStarforce(unlucky).destroyPercentile!).toBeLessThan(0.01);
  });
});
