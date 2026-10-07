import { describe, expect, it } from "vitest";
import { alreadyHas, diffSlots, type SlotState } from "@/lib/snapshot";

const slot = (s: Partial<SlotState> & { slot: string; name: string }): SlotState => ({
  starforce: 0,
  potential: null,
  additional: null,
  ...s,
});

describe("diffSlots", () => {
  it("아이템 교체, 스타포스·잠재 등급 상승을 각각 감지한다", () => {
    const before = [
      slot({ slot: "모자", name: "하이네스 워리어헬름", starforce: 17, potential: "유니크" }),
      slot({ slot: "장갑", name: "아케인셰이드 나이트글러브", starforce: 17, potential: "에픽" }),
    ];
    const after = [
      slot({ slot: "모자", name: "에테르넬 나이트헬름", starforce: 17, potential: "유니크" }),
      slot({ slot: "장갑", name: "아케인셰이드 나이트글러브", starforce: 22, potential: "레전드리" }),
    ];
    expect(diffSlots(before, after)).toEqual([
      { slot: "모자", kind: "item", target: "에테르넬 나이트헬름", from: "하이네스 워리어헬름", to: "에테르넬 나이트헬름" },
      { slot: "장갑", kind: "starforce", target: "22성", from: "17성", to: "22성" },
      { slot: "장갑", kind: "potential", target: "레전드리", from: "에픽", to: "레전드리" },
    ]);
  });

  it("스타포스 하락이나 변화 없음은 스펙업으로 세지 않는다", () => {
    const before = [slot({ slot: "신발", name: "아케인셰이드 나이트슈즈", starforce: 21 })];
    const after = [slot({ slot: "신발", name: "아케인셰이드 나이트슈즈", starforce: 20 })];
    expect(diffSlots(before, after)).toEqual([]);
    expect(diffSlots(after, after)).toEqual([]);
  });
});

describe("alreadyHas", () => {
  const mine = [slot({ slot: "장갑", name: "아케인셰이드 나이트글러브", starforce: 22, potential: "유니크" })];
  it("이미 같거나 더 높은 상태면 true", () => {
    expect(alreadyHas(mine, { slot: "장갑", kind: "starforce", to: "21성" })).toBe(true);
    expect(alreadyHas(mine, { slot: "장갑", kind: "potential", to: "레전드리" })).toBe(false);
    expect(alreadyHas(mine, { slot: "장갑", kind: "item", to: "아케인셰이드 나이트글러브" })).toBe(true);
  });
});
