import { describe, expect, it } from "vitest";
import { alreadyHas, diffSlots, pickBossEquipment, type SlotState } from "@/lib/snapshot";

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

describe("pickBossEquipment", () => {
  const item = (slot: string, name: string, starforce: number, lines: string[] = []) => ({
    item_equipment_part: slot,
    item_equipment_slot: slot,
    item_name: name,
    item_icon: "",
    starforce: String(starforce),
    potential_option_grade: "레전드리",
    additional_potential_option_grade: "유니크",
    potential_option_1: lines[0] ?? "STR : +12%",
    potential_option_2: lines[1] ?? null,
    potential_option_3: lines[2] ?? null,
    additional_potential_option_1: null,
    additional_potential_option_2: null,
    additional_potential_option_3: null,
  });
  // 실제 랭커 데이터에서 본 패턴: 사냥 프리셋은 드롭/메소 줄이 많고 스타포스가 낮다
  const boss = [item("모자", "에테르넬 시프반다나", 22), item("장갑", "아케인셰이드 시프글러브", 22)];
  const hunting = [
    item("모자", "하이네스 어새신보닛", 17, ["아이템 드롭률 : +20%", "아이템 드롭률 : +20%"]),
    item("장갑", "아케인셰이드 시프글러브", 22, ["메소 획득량 : +20%"]),
  ];
  const eq = (presetNo: number, current: typeof boss) => ({
    date: null,
    character_class: "나이트로드",
    preset_no: presetNo,
    item_equipment: current,
    item_equipment_preset_1: hunting,
    item_equipment_preset_2: boss,
    item_equipment_preset_3: null,
  });

  it("사냥 프리셋을 끼고 있어도 보스 프리셋 장비를 고르고, 착용 중이 아님을 알린다", () => {
    const r = pickBossEquipment(eq(1, hunting));
    expect(r.presetNo).toBe(2);
    expect(r.slots.map((s) => s.name)).toEqual(["에테르넬 시프반다나", "아케인셰이드 시프글러브"]);
    expect(r.wearing).toBe(false);
  });

  it("보스 프리셋을 끼고 있으면 wearing = true", () => {
    expect(pickBossEquipment(eq(2, boss)).wearing).toBe(true);
  });

  it("사냥 줄이 같으면 스타포스 합이 높은 프리셋", () => {
    const low = [item("모자", "하이네스 어새신보닛", 17)];
    const r = pickBossEquipment({ ...eq(1, low), item_equipment_preset_1: low, item_equipment_preset_2: boss });
    expect(r.presetNo).toBe(2);
  });

  it("프리셋 장비를 현재 장비와 같은 부위 순서로 정렬한다", () => {
    // 실제 응답: 프리셋은 현재와 다른 부위(귀고리·장갑)를 앞에 두고 내려온다
    const preset = [item("귀고리", "마이스터 이어링", 22), item("장갑", "앱솔랩스 파이렛글러브", 20), item("모자", "하이네스 원더러햇", 18)];
    const r = pickBossEquipment({ ...eq(1, hunting), item_equipment_preset_2: preset });
    expect(r.slots.map((s) => s.slot)).toEqual(["모자", "귀고리", "장갑"]);
  });
});
