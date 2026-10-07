import { describe, expect, it } from "vitest";
import { summarizeCubes } from "@/lib/luck/cube";
import type { CubeHistory } from "@/lib/nexon/types";

const c = (cube_type: string, item_upgrade_result: string, upgrade_guarantee = false): CubeHistory => ({
  id: Math.random().toString(),
  character_name: "테스트",
  date_create: "2026-09-01T12:00:00+09:00",
  cube_type,
  item_upgrade_result,
  item_equipment_part: "장갑",
  target_item: "아케인셰이드 시프글러브",
  potential_option_grade: "유니크",
  additional_potential_option_grade: "에픽",
  upgrade_guarantee,
  upgrade_guarantee_count: 0,
});

describe("summarizeCubes", () => {
  it("큐브 종류별 사용·등급 상승(\"성공\")·천장 횟수를 센다", () => {
    const r = summarizeCubes([
      c("수상한 큐브", "실패"),
      c("수상한 큐브", "성공"),
      c("수상한 큐브", "실패"),
      c("카르마 블랙 큐브", "성공", true),
    ]);
    expect(r).toEqual([
      { cubeType: "수상한 큐브", uses: 3, tierUps: 1, guaranteed: 0 },
      { cubeType: "카르마 블랙 큐브", uses: 1, tierUps: 1, guaranteed: 1 },
    ]);
  });
});
