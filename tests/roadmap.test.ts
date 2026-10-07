import { describe, expect, it } from "vitest";
import { compareSlots, recommend, type UpgradeEvent } from "@/lib/roadmap";
import type { SlotState } from "@/lib/snapshot";

const ev = (ocid: string, e: Partial<UpgradeEvent>): UpgradeEvent => ({
  ocid,
  slot: "장갑",
  kind: "starforce",
  target: "22성",
  to: "22성",
  cpBefore: 100,
  cpAfter: 110,
  ...e,
});

const mine: SlotState[] = [
  { slot: "장갑", name: "아케인셰이드 나이트글러브", starforce: 17, potential: "유니크", additional: null },
  { slot: "모자", name: "하이네스 워리어헬름", starforce: 22, potential: "레전드리", additional: null },
];

describe("recommend", () => {
  it("많이 선택된 순으로 정렬하고 이미 갖춘 업그레이드는 뺀다", () => {
    const events = [
      ev("a", {}),
      ev("b", { cpAfter: 104 }),
      ev("c", {}),
      ev("a", { slot: "모자", kind: "item", target: "에테르넬 나이트헬름", to: "에테르넬 나이트헬름", cpAfter: 120 }),
      ev("d", { slot: "모자", kind: "starforce", target: "21성", to: "21성" }), // 이미 22성
    ];
    const recs = recommend(events, mine);
    expect(recs.map((r) => [r.slot, r.target, r.users])).toEqual([
      ["장갑", "22성", 3],
      ["모자", "에테르넬 나이트헬름", 1],
    ]);
    expect(recs[0].share).toBeCloseTo(3 / 4);
    expect(recs[0].medianGain).toBeCloseTo(0.1);
  });

  it("데이터가 없으면 빈 배열", () => {
    expect(recommend([], mine)).toEqual([]);
  });
});

describe("compareSlots", () => {
  it("구간 중앙값보다 스타포스가 낮으면 behind", () => {
    const peers = [22, 22, 21].map((sf) => [{ ...mine[0], starforce: sf }]);
    const [glove] = compareSlots(peers, mine);
    expect(glove.medianStarforce).toBe(22);
    expect(glove.behind).toBe(true);
  });
});
